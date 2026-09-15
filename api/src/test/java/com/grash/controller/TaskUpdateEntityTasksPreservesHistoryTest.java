package com.grash.controller;

import com.grash.dto.TaskBaseDTO;
import com.grash.model.*;
import com.grash.model.enums.TaskType;
import com.grash.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * F5 - bulk sync do checklist de uma WorkOrder (TaskController.updateEntityTasks,
 * usado por PATCH /tasks/work-order/{id} e /tasks/preventive-maintenance/{id})
 * nao pode apagar resposta/foto ja registrada pelo tecnico so porque o item
 * mudou de texto ou saiu da lista enviada.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TaskUpdateEntityTasksPreservesHistoryTest {

    @Mock
    private TaskService taskService;
    @Mock
    private UserService userService;
    @Mock
    private TaskBaseService taskBaseService;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private WorkflowService workflowService;
    @Mock
    private com.grash.mapper.TaskMapper taskMapper;
    @Mock
    private PreventiveMaintenanceService preventiveMaintenanceService;

    @InjectMocks
    private TaskController taskController;

    private Company company;
    private User user;
    private WorkOrder workOrder;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(1L);
        user = new User();
        user.setId(1L);
        user.setCompany(company);
        workOrder = new WorkOrder();
        workOrder.setId(500L);
    }

    private TaskBase taskBaseOf(Long id, String label, TaskType type) {
        TaskBase taskBase = TaskBase.builder().label(label).taskType(type).build();
        taskBase.setId(id);
        taskBase.setOptions(new ArrayList<>());
        return taskBase;
    }

    private Task taskOf(Long id, TaskBase taskBase, String value, String notes, List<File> images) {
        Task task = new Task();
        task.setId(id);
        task.setTaskBase(taskBase);
        task.setWorkOrder(workOrder);
        task.setValue(value);
        task.setNotes(notes);
        task.setImages(images != null ? images : new ArrayList<>());
        return task;
    }

    private TaskBaseDTO dtoOf(Long id, String label) {
        TaskBaseDTO dto = new TaskBaseDTO();
        dto.setId(id);
        dto.setLabel(label);
        dto.setTaskType(TaskType.TEXT);
        dto.setOptions(Collections.emptyList());
        return dto;
    }

    // 1) Editar so o label de um item ja respondido (id informado) preserva
    // a mesma Task (mesmo id) e nao toca value/notes/images - atualiza a
    // TaskBase em vez de deletar/recriar.
    @Test
    void editingLabelWithId_preservesTaskIdentityAndAnswer() {
        TaskBase savedTaskBase = taskBaseOf(10L, "Old label", TaskType.TEXT);
        Task savedTask = taskOf(100L, savedTaskBase, "answered by technician", "some notes", null);

        TaskBaseDTO incoming = dtoOf(100L, "New corrected label");

        List<Task> result = taskController.updateEntityTasks(
                Collections.singletonList(incoming), new ArrayList<>(Collections.singletonList(savedTask)),
                user, null, workOrder);

        assertEquals(1, result.size());
        assertSame(savedTask, result.get(0), "deve reutilizar a mesma Task, nao criar uma nova");
        assertEquals(100L, result.get(0).getId());
        assertEquals("answered by technician", result.get(0).getValue(), "resposta nao pode ser apagada");
        assertEquals("some notes", result.get(0).getNotes(), "notas nao podem ser apagadas");
        verify(taskBaseService).updateFromTaskBaseDTO(eq(savedTaskBase), eq(incoming), eq(company));
        verify(taskService, never()).delete(any());
        verify(taskService, never()).create(any());
    }

    // 2) Item sem id, mas com conteudo identico ao existente, continua
    // casando por conteudo (fallback preservado para o fluxo de criacao,
    // quando nenhuma Task tem id ainda do lado do cliente).
    @Test
    void matchingByContent_stillWorksWhenNoIdProvided() {
        TaskBase savedTaskBase = TaskBase.builder().label("Same label").taskType(TaskType.TEXT).build();
        savedTaskBase.setId(20L);
        savedTaskBase.setOptions(new ArrayList<>());
        savedTaskBase.setUser(null);
        savedTaskBase.setAsset(null);
        savedTaskBase.setMeter(null);
        Task savedTask = taskOf(200L, savedTaskBase, "", null, null);

        TaskBaseDTO incoming = new TaskBaseDTO();
        incoming.setLabel("Same label");
        incoming.setTaskType(TaskType.TEXT);
        incoming.setOptions(Collections.emptyList());

        List<Task> result = taskController.updateEntityTasks(
                Collections.singletonList(incoming), new ArrayList<>(Collections.singletonList(savedTask)),
                user, null, workOrder);

        assertEquals(1, result.size());
        assertSame(savedTask, result.get(0));
        verify(taskBaseService, never()).updateFromTaskBaseDTO(any(), any(), any());
        verify(taskService, never()).delete(any());
    }

    // 3) Item que sai do payload e NUNCA foi respondido continua sendo
    // deletado normalmente (comportamento antigo preservado).
    @Test
    void unmatchedTaskWithNoRecordedData_isStillDeleted() {
        TaskBase savedTaskBase = taskBaseOf(30L, "Unused question", TaskType.TEXT);
        Task savedTask = taskOf(300L, savedTaskBase, "", null, null);

        List<Task> result = taskController.updateEntityTasks(
                Collections.emptyList(), new ArrayList<>(Collections.singletonList(savedTask)),
                user, null, workOrder);

        assertTrue(result.isEmpty());
        verify(taskService).delete(300L);
    }

    // 4) Item que sai do payload MAS ja tem resposta registrada (value
    // diferente de vazio/OPEN) NAO pode ser deletado - preserva historico.
    @Test
    void unmatchedTaskWithAnswer_isNeverDeleted() {
        TaskBase savedTaskBase = taskBaseOf(40L, "Answered question", TaskType.TEXT);
        Task savedTask = taskOf(400L, savedTaskBase, "technician answer", null, null);

        List<Task> result = taskController.updateEntityTasks(
                Collections.emptyList(), new ArrayList<>(Collections.singletonList(savedTask)),
                user, null, workOrder);

        assertTrue(result.isEmpty(), "nao deve aparecer no resultado sincronizado, mas tambem nao pode ser apagada");
        verify(taskService, never()).delete(400L);
    }

    // 5) Item que sai do payload MAS tem foto anexada NAO pode ser deletado,
    // mesmo com value vazio.
    @Test
    void unmatchedTaskWithPhoto_isNeverDeleted() {
        TaskBase savedTaskBase = taskBaseOf(50L, "Photo question", TaskType.TEXT);
        File photo = new File();
        photo.setId(999L);
        Task savedTask = taskOf(500L, savedTaskBase, "", null, Collections.singletonList(photo));

        List<Task> result = taskController.updateEntityTasks(
                Collections.emptyList(), new ArrayList<>(Collections.singletonList(savedTask)),
                user, null, workOrder);

        assertTrue(result.isEmpty());
        verify(taskService, never()).delete(500L);
    }

    // 6) SUBTASK recem-criada (value="OPEN", nunca tocada pelo tecnico) ainda
    // conta como "nao usada" e pode ser deletada normalmente se sair do
    // payload - "OPEN" e o default inicial, nao uma resposta.
    @Test
    void unmatchedFreshSubtask_stillOpen_isDeleted() {
        TaskBase savedTaskBase = taskBaseOf(60L, "Subtask", TaskType.SUBTASK);
        Task savedTask = taskOf(600L, savedTaskBase, "OPEN", null, null);

        List<Task> result = taskController.updateEntityTasks(
                Collections.emptyList(), new ArrayList<>(Collections.singletonList(savedTask)),
                user, null, workOrder);

        assertTrue(result.isEmpty());
        verify(taskService).delete(600L);
    }

    // 7) Item novo (sem id, sem match de conteudo) continua sendo criado
    // normalmente.
    @Test
    void newItemWithoutMatch_isCreated() {
        TaskBase newTaskBase = taskBaseOf(70L, "Brand new question", TaskType.TEXT);
        when(taskBaseService.createFromTaskBaseDTO(any(), eq(company))).thenReturn(newTaskBase);
        Task createdTask = taskOf(700L, newTaskBase, "", null, null);
        when(taskService.create(any())).thenReturn(createdTask);

        TaskBaseDTO incoming = dtoOf(null, "Brand new question");

        List<Task> result = taskController.updateEntityTasks(
                Collections.singletonList(incoming), new ArrayList<>(),
                user, null, workOrder);

        assertEquals(1, result.size());
        assertSame(createdTask, result.get(0));
        verify(taskService).create(any());
    }

    // 8) Um id informado que nao pertence a esta WorkOrder/PM (nao esta em
    // savedTasks) nunca e usado pra casar - cai no fallback por conteudo ou
    // vira item novo, nunca atualiza uma Task de outro dono.
    @Test
    void idNotBelongingToSavedTasks_isIgnored_fallsBackToNewItem() {
        TaskBase newTaskBase = taskBaseOf(80L, "Some label", TaskType.TEXT);
        when(taskBaseService.createFromTaskBaseDTO(any(), eq(company))).thenReturn(newTaskBase);
        Task createdTask = taskOf(800L, newTaskBase, "", null, null);
        when(taskService.create(any())).thenReturn(createdTask);

        TaskBaseDTO incoming = dtoOf(999999L, "Some label"); // id de outra OS/inexistente

        List<Task> result = taskController.updateEntityTasks(
                Collections.singletonList(incoming), new ArrayList<>(),
                user, null, workOrder);

        assertEquals(1, result.size());
        assertSame(createdTask, result.get(0));
        verify(taskBaseService, never()).updateFromTaskBaseDTO(any(), any(), any());
    }
}
