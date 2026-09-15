package com.grash.job;

import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.model.*;
import com.grash.repository.ScheduleRepository;
import com.grash.service.ScheduleService;
import com.grash.service.TaskBaseService;
import com.grash.service.TaskService;
import com.grash.service.WorkOrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * CORRECAO (esta rodada, Parte 1) - WorkOrderCreationJob.executeInternal
 * agora compara o CONTEUDO (label/tipo/user/asset/meter/opcoes) de cada Task
 * propria da PreventiveMaintenance contra as Tasks que
 * workOrderService.create() ja criou na OS (via
 * WorkOrderService.applyCategoryDefaults, clonando category.defaultChecklist)
 * - so' copia a Task da PM se ela NAO bater com nada que a categoria ja
 * clonou. Mesmo criterio de comparacao de TaskController.tasksMatch, agora
 * entre dois TaskBase.
 *
 * Cobre os 4 casos mapeados na investigacao:
 * A) Category sem Questionario, PM com Tasks proprias -&gt; OS recebe as
 *    Tasks da PM (comportamento pre-existente, preservado).
 * B) Category com Questionario, PM sem Tasks proprias -&gt; OS recebe o
 *    Questionario da Category uma vez (ja' funcionava, preservado).
 * C) Category com Questionario, PM configurada com EXATAMENTE esse
 *    Questionario -&gt; OS recebe cada pergunta uma unica vez (BUG
 *    corrigido - antes duplicava).
 * D) Category com Questionario, PM tem uma pergunta ADICIONAL especifica
 *    (conteudo diferente) -&gt; OS recebe o Questionario da Category UMA
 *    vez + a pergunta especifica da PM (nao pode perder customizacao
 *    legitima).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderCreationJobChecklistDuplicationTest {

    @Mock
    private ScheduleRepository scheduleRepository;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private TaskService taskService;
    @Mock
    private ScheduleService scheduleService;
    @Mock
    private TaskBaseService taskBaseService;
    @Mock
    private JobExecutionContext jobExecutionContext;

    private WorkOrderCreationJob job;
    private Company company;
    private long nextClonedTaskBaseId;

    @BeforeEach
    void setUp() {
        job = new WorkOrderCreationJob(scheduleRepository, workOrderService, taskService, scheduleService,
                taskBaseService);
        company = new Company();
        company.setId(1L);
        nextClonedTaskBaseId = 900L;
    }

    private TaskBase taskBase(Long id, String label) {
        TaskBase taskBase = TaskBase.builder().label(label).build();
        taskBase.setId(id);
        return taskBase;
    }

    // Estuba o clone (mesmo padrao real de TaskBaseService.cloneForNewOwner:
    // linha nova, mesmo conteudo) pra' cada TaskBase que o job pode vir a
    // clonar - a correcao desta rodada faz o job clonar toda Task propria
    // da PM que sobrevive a deduplicacao, entao os testes precisam saber o
    // que o clone devolve.
    private void stubCloneReturnsNewTaskBaseWithSameLabel(TaskBase source) {
        TaskBase clone = taskBase(nextClonedTaskBaseId++, source.getLabel());
        when(taskBaseService.cloneForNewOwner(source)).thenReturn(clone);
    }

    private Schedule scheduleFor(PreventiveMaintenance pm) {
        Schedule schedule = new Schedule(pm);
        schedule.setId(200L);
        schedule.setDisabled(false);
        JobDataMap jobDataMap = new JobDataMap();
        jobDataMap.put("scheduleId", 200L);
        when(jobExecutionContext.getMergedJobDataMap()).thenReturn(jobDataMap);
        when(scheduleRepository.findById(200L)).thenReturn(Optional.of(schedule));
        return schedule;
    }

    // Simula o efeito real de workOrderService.create(): retorna a OS
    // criada E deixa taskService.findByWorkOrder(woId) refletir as Tasks
    // que applyCategoryDefaults teria clonado do defaultChecklist da
    // Category (vazio se a Category nao tiver checklist).
    private WorkOrder stubCreate(PreventiveMaintenance pm, WorkOrder createdWorkOrder,
                                  List<TaskBase> categoryClonedTaskBases) {
        WorkOrderPostDTO expectedPostDto = new WorkOrderPostDTO();
        when(workOrderService.getWorkOrderFromWorkOrderBase(pm)).thenReturn(expectedPostDto);
        when(workOrderService.create(any(WorkOrderPostDTO.class), eq(company))).thenReturn(createdWorkOrder);
        List<Task> clonedTasks = new ArrayList<>();
        for (TaskBase tb : categoryClonedTaskBases) {
            Task t = new Task(tb, createdWorkOrder, null, "");
            clonedTasks.add(t);
        }
        when(taskService.findByWorkOrder(createdWorkOrder.getId())).thenReturn(clonedTasks);
        return createdWorkOrder;
    }

    // CASO A - Category sem Questionario, PM com Tasks proprias -> nada pra
    // deduplicar (lista de "ja na OS" vazia), todas as Tasks da PM sao
    // copiadas normalmente.
    @Test
    void caseA_categoryWithoutChecklist_pmOwnTasksAreCopiedNormally() throws Exception {
        PreventiveMaintenance pm = new PreventiveMaintenance();
        pm.setId(100L);
        pm.setCompany(company);
        // sem category

        TaskBase pmTaskBase1 = taskBase(30L, "Verificar oleo");
        TaskBase pmTaskBase2 = taskBase(31L, "Verificar filtro");
        Task pmTask1 = new Task(pmTaskBase1, null, pm, "");
        Task pmTask2 = new Task(pmTaskBase2, null, pm, "");

        scheduleFor(pm);
        when(taskService.findByPreventiveMaintenance(100L)).thenReturn(List.of(pmTask1, pmTask2));
        stubCloneReturnsNewTaskBaseWithSameLabel(pmTaskBase1);
        stubCloneReturnsNewTaskBaseWithSameLabel(pmTaskBase2);

        WorkOrder createdWorkOrder = new WorkOrder();
        createdWorkOrder.setId(500L);
        stubCreate(pm, createdWorkOrder, Collections.emptyList());

        job.executeInternal(jobExecutionContext);

        // As Tasks criadas usam o CLONE (linha nova), nao a TaskBase
        // original da PM - confere por conteudo (label) e confirma que a
        // TaskBase usada e' diferente da original (correcao desta rodada).
        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskService, times(2)).create(captor.capture());
        List<TaskBase> createdTaskBases = captor.getAllValues().stream().map(Task::getTaskBase).toList();
        assertEquals(List.of("Verificar oleo", "Verificar filtro"),
                createdTaskBases.stream().map(TaskBase::getLabel).toList());
        assertTrue(createdTaskBases.stream().noneMatch(tb -> tb == pmTaskBase1 || tb == pmTaskBase2),
                "Task da OS deve usar a TaskBase CLONADA, nunca a referencia original da PM");
    }

    // CASO B - Category com Questionario, PM SEM Tasks proprias -> so' o
    // clone da categoria existe (2 Tasks, ja criadas dentro de create(),
    // fora do escopo deste job) - o loop do job nao copia nada extra
    // porque a PM nao tem Tasks proprias.
    @Test
    void caseB_categoryWithChecklist_pmWithNoOwnTasks_noDuplication() throws Exception {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        PreventiveMaintenance pm = new PreventiveMaintenance();
        pm.setId(101L);
        pm.setCompany(company);
        pm.setCategory(category);

        scheduleFor(pm);
        when(taskService.findByPreventiveMaintenance(101L)).thenReturn(Collections.emptyList());

        WorkOrder createdWorkOrder = new WorkOrder();
        createdWorkOrder.setId(501L);
        TaskBase categoryTaskBase1 = taskBase(30L, "Tensao medida?");
        TaskBase categoryTaskBase2 = taskBase(31L, "Ha aquecimento?");
        stubCreate(pm, createdWorkOrder, List.of(categoryTaskBase1, categoryTaskBase2));

        job.executeInternal(jobExecutionContext);

        // O job em si nao cria nenhuma Task extra - o clone da categoria
        // (2 Tasks) ja aconteceu dentro do create() simulado.
        verify(taskService, never()).create(any());
    }

    // CASO C - Category com Questionario, PM configurada com EXATAMENTE
    // esse Questionario (mesmo label/tipo) -> cada pergunta deve aparecer
    // uma unica vez na OS. Este e' o BUG original, agora corrigido.
    @Test
    void caseC_pmConfiguredWithSameChecklistAsCategory_noDuplication() throws Exception {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        PreventiveMaintenance pm = new PreventiveMaintenance();
        pm.setId(102L);
        pm.setCompany(company);
        pm.setCategory(category);

        TaskBase pmTaskBase1 = taskBase(40L, "Tensao medida?"); // mesmo label/tipo da categoria
        TaskBase pmTaskBase2 = taskBase(41L, "Ha aquecimento?");
        Task pmTask1 = new Task(pmTaskBase1, null, pm, "");
        Task pmTask2 = new Task(pmTaskBase2, null, pm, "");

        scheduleFor(pm);
        when(taskService.findByPreventiveMaintenance(102L)).thenReturn(List.of(pmTask1, pmTask2));

        WorkOrder createdWorkOrder = new WorkOrder();
        createdWorkOrder.setId(502L);
        TaskBase categoryTaskBase1 = taskBase(30L, "Tensao medida?");
        TaskBase categoryTaskBase2 = taskBase(31L, "Ha aquecimento?");
        stubCreate(pm, createdWorkOrder, List.of(categoryTaskBase1, categoryTaskBase2));

        job.executeInternal(jobExecutionContext);

        // Nenhuma copia extra - as 2 perguntas da PM batem em conteudo com
        // as 2 ja clonadas pela categoria, entao sao consideradas
        // duplicatas e puladas (nem chegam a ser clonadas).
        verify(taskService, never()).create(any());
        verify(taskBaseService, never()).cloneForNewOwner(any());
    }

    // CASO D - Category com Questionario, PM tem uma pergunta ADICIONAL
    // (conteudo diferente) -> a pergunta especifica da PM NAO pode ser
    // perdida, mesmo com a categoria contribuindo suas proprias 2.
    @Test
    void caseD_pmHasAdditionalSpecificQuestion_isPreserved() throws Exception {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        PreventiveMaintenance pm = new PreventiveMaintenance();
        pm.setId(103L);
        pm.setCompany(company);
        pm.setCategory(category);

        TaskBase pmTaskBaseMatching = taskBase(40L, "Tensao medida?"); // duplicata da categoria
        TaskBase pmTaskBaseSpecific = taskBase(42L, "Nivel de oleo do transformador?"); // exclusiva da PM
        Task pmTaskMatching = new Task(pmTaskBaseMatching, null, pm, "");
        Task pmTaskSpecific = new Task(pmTaskBaseSpecific, null, pm, "");

        scheduleFor(pm);
        when(taskService.findByPreventiveMaintenance(103L)).thenReturn(List.of(pmTaskMatching, pmTaskSpecific));
        stubCloneReturnsNewTaskBaseWithSameLabel(pmTaskBaseSpecific);

        WorkOrder createdWorkOrder = new WorkOrder();
        createdWorkOrder.setId(503L);
        TaskBase categoryTaskBase1 = taskBase(30L, "Tensao medida?");
        TaskBase categoryTaskBase2 = taskBase(31L, "Ha aquecimento?");
        stubCreate(pm, createdWorkOrder, List.of(categoryTaskBase1, categoryTaskBase2));

        job.executeInternal(jobExecutionContext);

        // So' a pergunta especifica da PM e' copiada (via TaskBase clonada,
        // nao a referencia original) - a duplicata e' descartada, mas a
        // customizacao legitima sobrevive.
        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskService, times(1)).create(captor.capture());
        TaskBase createdTaskBase = captor.getValue().getTaskBase();
        assertEquals("Nivel de oleo do transformador?", createdTaskBase.getLabel());
        assertTrue(createdTaskBase != pmTaskBaseSpecific,
                "Task da OS deve usar a TaskBase CLONADA, nunca a referencia original da PM");
        verify(taskBaseService, never()).cloneForNewOwner(pmTaskBaseMatching);
    }
}
