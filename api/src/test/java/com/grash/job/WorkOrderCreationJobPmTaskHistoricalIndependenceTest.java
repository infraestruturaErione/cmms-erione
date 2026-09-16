package com.grash.job;

import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.mapper.TaskBaseMapperImpl;
import com.grash.mapper.TaskOptionMapperImpl;
import com.grash.model.*;
import com.grash.model.enums.TaskType;
import com.grash.repository.PreventiveMaintenanceRepository;
import com.grash.repository.ScheduleRepository;
import com.grash.repository.TaskBaseRepository;
import com.grash.repository.TaskOptionRepository;
import com.grash.repository.TaskRepository;
import com.grash.service.CompanyService;
import com.grash.service.FileService;
import com.grash.service.ScheduleService;
import com.grash.service.TaskBaseService;
import com.grash.service.TaskService;
import com.grash.service.UserService;
import com.grash.service.WorkOrderService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Prova, com persistencia REAL (nao mock), que a Task copiada de uma
 * PreventiveMaintenance pra uma OS gerada e' historicamente independente E
 * que ela chega ao banco com a company correta.
 *
 * IMPORTANTE - este teste roda SEM SecurityContext, de proposito.
 *
 * A versao anterior montava um usuario autenticado no
 * SecurityContextHolder antes de executar o job. Isso nao representava o
 * Quartz (que nao roda em nome de usuario nenhum) e mascarou um P0: o
 * @PrePersist de CompanyAudit so consegue preencher "company" a partir do
 * usuario autenticado, entao no runtime real o clone criado por
 * cloneForNewOwner ia pro INSERT com company_id null, o Postgres rejeitava
 * ("null value in column company_id of relation task_base violates not-null
 * constraint") e a transacao inteira caia - NENHUMA OS era gerada quando a
 * PM tinha pergunta propria. Com SecurityContext montado, o teste passava.
 *
 * Por isso o setUp limpa o contexto explicitamente: qualquer regressao que
 * volte a depender de usuario logado pra descobrir a empresa falha aqui.
 *
 * Cobre:
 * 1) PM possui Task propria;
 * 2) gera OS #1 (cenario A - sem Category/defaultChecklist);
 * 3) TaskBase.id da PM e da OS #1 sao DIFERENTES (clone real, nao
 *    referencia compartilhada);
 * 4) TaskBase, TaskOption e Task clonados persistem com a company da PM
 *    (nao null) - a regressao P0 propriamente dita;
 * 5) editar label/tipo/opcoes da pergunta na PM NAO altera a Task da OS #1
 *    ja gerada;
 * 6) gerar uma OS #2 DEPOIS da edicao recebe a versao NOVA;
 * 7) excluir a pergunta da PM (e a propria linha de TaskBase da PM) NAO
 *    remove nem modifica a pergunta ja' clonada na OS #1 - prova que sao
 *    linhas totalmente independentes no banco, sem FK de volta.
 */
@DataJpaTest
@org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase(
        replace = org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = WorkOrderCreationJobPmTaskHistoricalIndependenceTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        // Task.value bate com a palavra reservada VALUE do H2 em modo
        // default, quebrando o create-drop automatico deste teste (schema
        // real via Liquibase/Postgres nao tem esse problema - e' so' do H2
        // do @DataJpaTest). NON_KEYWORDS e' cirurgico (so' libera VALUE),
        // ao contrario de globally_quoted_identifiers=true, que quebra as
        // tabelas de auditoria do Envers (REV/rev colidindo).
        "spring.datasource.url=jdbc:h2:mem:pmTaskHistIndepTest;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.liquibase.enabled=false"
})
class WorkOrderCreationJobPmTaskHistoricalIndependenceTest {

    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    @org.springframework.data.jpa.repository.config.EnableJpaAuditing
    static class TestJpaConfig {
        @Bean
        TaskOptionMapperImpl taskOptionMapper() {
            return new TaskOptionMapperImpl();
        }

        @Bean
        TaskBaseMapperImpl taskBaseMapper() {
            return new TaskBaseMapperImpl();
        }

        @Bean
        com.grash.service.TaskOptionService taskOptionService(TaskOptionRepository taskOptionRepository,
                                                                CompanyService companyService,
                                                                TaskOptionMapperImpl taskOptionMapper) {
            return new com.grash.service.TaskOptionService(taskOptionRepository, companyService, taskOptionMapper);
        }

        @Bean
        TaskBaseService taskBaseService(TaskBaseRepository taskBaseRepository, CompanyService companyService,
                                         TaskBaseMapperImpl taskBaseMapper,
                                         com.grash.service.TaskOptionService taskOptionService,
                                         UserService userService, com.grash.service.MeterService meterService,
                                         com.grash.service.AssetService assetService, EntityManager entityManager) {
            return new TaskBaseService(taskBaseRepository, companyService, taskBaseMapper, taskOptionService,
                    userService, meterService, assetService, entityManager);
        }

        @Bean
        TaskService taskService(TaskRepository taskRepository, CompanyService companyService,
                                 FileService fileService, com.grash.mapper.TaskMapper taskMapper,
                                 EntityManager entityManager) {
            return new TaskService(taskRepository, companyService, fileService, taskMapper, entityManager);
        }

        @Bean
        CompanyService companyService() {
            return mock(CompanyService.class);
        }

        @Bean
        UserService userService() {
            return mock(UserService.class);
        }

        @Bean
        com.grash.service.MeterService meterService() {
            return mock(com.grash.service.MeterService.class);
        }

        @Bean
        com.grash.service.AssetService assetService() {
            return mock(com.grash.service.AssetService.class);
        }

        @Bean
        FileService fileService() {
            return mock(FileService.class);
        }

        @Bean
        com.grash.mapper.TaskMapper taskMapper() {
            return mock(com.grash.mapper.TaskMapper.class);
        }
    }

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private TaskBaseRepository taskBaseRepository;
    @Autowired
    private TaskOptionRepository taskOptionRepository;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskBaseService taskBaseService;
    @MockBean
    private WorkOrderService workOrderService;
    @MockBean
    private ScheduleRepository scheduleRepository;
    @MockBean
    private ScheduleService scheduleService;
    @Autowired
    private PreventiveMaintenanceRepository preventiveMaintenanceRepository;

    private Company company;
    private WorkOrderCreationJob job;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setName("Erione");
        stamp(company);
        entityManager.persist(company);
        entityManager.flush();

        // ZERO usuario autenticado - e' assim que o Quartz executa de verdade.
        // Nao montar SecurityContext aqui e' o ponto central deste teste: com
        // um usuario fake o P0 de company_id null ficava invisivel.
        SecurityContextHolder.clearContext();

        job = new WorkOrderCreationJob(scheduleRepository, workOrderService, taskService, scheduleService,
                taskBaseService);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void stamp(com.grash.model.abstracts.DateAudit entity) {
        Date now = new Date();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
    }

    private WorkOrder persistWorkOrder(String title) {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setTitle(title);
        workOrder.setCompany(company);
        stamp(workOrder);
        entityManager.persist(workOrder);
        entityManager.flush();
        return workOrder;
    }

    // Roda o job de verdade pra' gerar uma OS a partir da PM - mesmo codigo
    // de producao (WorkOrderCreationJob.executeInternal), so' com
    // workOrderService.create() mockado pra' nao precisar da cadeia inteira
    // de dependencias de WorkOrderService (o que ele cria de verdade,
    // applyCategoryDefaults, nao e' o alvo deste teste - ja' coberto por
    // WorkOrderServiceCompletionRequirementsSnapshotTest/
    // TaskBaseCloningIntegrityTest).
    private WorkOrder generateWorkOrderFromPm(PreventiveMaintenance pm, long scheduleId, String woTitle) throws Exception {
        Schedule schedule = new Schedule(pm);
        schedule.setId(scheduleId);
        schedule.setDisabled(false);
        when(scheduleRepository.findById(scheduleId)).thenReturn(Optional.of(schedule));

        WorkOrderPostDTO postDto = new WorkOrderPostDTO();
        postDto.setTitle(woTitle);
        when(workOrderService.getWorkOrderFromWorkOrderBase(pm)).thenReturn(postDto);

        WorkOrder generatedWorkOrder = persistWorkOrder(woTitle);
        when(workOrderService.create(any(WorkOrderPostDTO.class), eq(company))).thenReturn(generatedWorkOrder);

        org.quartz.JobExecutionContext context = mock(org.quartz.JobExecutionContext.class);
        org.quartz.JobDataMap jobDataMap = new org.quartz.JobDataMap();
        jobDataMap.put("scheduleId", scheduleId);
        when(context.getMergedJobDataMap()).thenReturn(jobDataMap);

        job.executeInternal(context);
        entityManager.flush();
        entityManager.clear();
        return generatedWorkOrder;
    }

    @Test
    void pmTaskIsClonedIndependently_editingOrDeletingThePmQuestionNeverAffectsAlreadyGeneratedWorkOrders() throws Exception {
        // 1) PM possui Task propria, com opcoes (pergunta MULTIPLE).
        TaskBase pmTaskBase = TaskBase.builder()
                .label("Nivel de oleo do transformador?")
                .taskType(TaskType.MULTIPLE)
                .build();
        pmTaskBase.setCompany(company);
        stamp(pmTaskBase);
        pmTaskBase = taskBaseRepository.save(pmTaskBase);
        TaskOption optionOk = new TaskOption("Normal", pmTaskBase);
        optionOk.setCompany(company);
        stamp(optionOk);
        entityManager.persist(optionOk);
        TaskOption optionLow = new TaskOption("Baixo", pmTaskBase);
        optionLow.setCompany(company);
        stamp(optionLow);
        entityManager.persist(optionLow);
        entityManager.flush();

        PreventiveMaintenance pm = new PreventiveMaintenance();
        pm.setTitle("Preventiva Transformador");
        pm.setCompany(company);
        stamp(pm);
        pm = preventiveMaintenanceRepository.save(pm);

        Task pmOwnTask = new Task(pmTaskBase, null, pm, "");
        pmOwnTask.setCompany(company);
        stamp(pmOwnTask);
        taskRepository.save(pmOwnTask);
        entityManager.flush();
        entityManager.clear();

        pm = preventiveMaintenanceRepository.findById(pm.getId()).orElseThrow();
        final Long pmTaskBaseId = pmTaskBase.getId();

        // 2) Gera OS #1.
        WorkOrder workOrder1 = generateWorkOrderFromPm(pm, 200L, "OS #1 gerada pela Preventiva");

        List<Task> os1Tasks = taskService.findByWorkOrder(workOrder1.getId());
        assertEquals(1, os1Tasks.size(), "OS #1 deve ter recebido a pergunta propria da PM");
        Task os1Task = os1Tasks.get(0);
        Long os1TaskBaseId = os1Task.getTaskBase().getId();

        // 3) TaskBase.id da PM e da OS #1 devem ser DIFERENTES (clone real).
        assertNotEquals(pmTaskBaseId, os1TaskBaseId,
                "a Task da OS #1 deve usar uma TaskBase CLONADA, com id proprio - nunca a mesma linha da PM");
        assertEquals("Nivel de oleo do transformador?", os1Task.getTaskBase().getLabel());
        assertEquals(TaskType.MULTIPLE, os1Task.getTaskBase().getTaskType());
        List<String> os1OptionLabels = os1Task.getTaskBase().getOptions().stream()
                .map(TaskOption::getLabel).sorted().toList();
        assertEquals(List.of("Baixo", "Normal"), os1OptionLabels, "opcoes tambem devem ter sido clonadas");

        // 4) P0: company persistida corretamente mesmo sem usuario autenticado.
        // Nao basta a OS "aparecer" - o INSERT do clone precisa levar
        // company_id. Antes da correcao este bloco era inalcancavel: a
        // transacao explodia antes, em cloneForNewOwner.
        assertNotNull(os1Task.getTaskBase().getCompany(),
                "TaskBase clonada NAO pode ficar com company null - era exatamente o P0 "
                        + "(null value in column company_id of relation task_base)");
        assertEquals(company.getId(), os1Task.getTaskBase().getCompany().getId(),
                "TaskBase clonada deve pertencer a empresa da Preventiva");
        assertNotNull(os1Task.getCompany(), "Task da OS nao pode ficar com company null");
        assertEquals(company.getId(), os1Task.getCompany().getId(),
                "Task da OS deve pertencer a empresa da Preventiva");
        os1Task.getTaskBase().getOptions().forEach(option -> {
            assertNotNull(option.getCompany(),
                    "TaskOption clonada nao pode ficar com company null (TaskOption tambem e CompanyAudit)");
            assertEquals(company.getId(), option.getCompany().getId(),
                    "TaskOption clonada deve pertencer a empresa da Preventiva");
        });
        // Prova direta no banco, sem passar pelo cache de 1o nivel do Hibernate:
        // garante que nao existe linha com company_id null.
        Long taskBasesWithoutCompany = (Long) entityManager
                .createQuery("select count(tb) from TaskBase tb where tb.company is null")
                .getSingleResult();
        assertEquals(0L, taskBasesWithoutCompany, "nenhuma TaskBase pode ter company_id null no banco");
        Long taskOptionsWithoutCompany = (Long) entityManager
                .createQuery("select count(o) from TaskOption o where o.company is null")
                .getSingleResult();
        assertEquals(0L, taskOptionsWithoutCompany, "nenhuma TaskOption pode ter company_id null no banco");
        Long tasksWithoutCompany = (Long) entityManager
                .createQuery("select count(t) from Task t where t.company is null")
                .getSingleResult();
        assertEquals(0L, tasksWithoutCompany, "nenhuma Task pode ter company_id null no banco");
        // E o contexto continua sem usuario: a company veio da operacao, nao de sessao.
        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "o job deve ter rodado sem nenhum usuario autenticado");

        // 4) Editar label/tipo/opcoes da pergunta na PM.
        TaskBase pmTaskBaseToEdit = taskBaseRepository.findById(pmTaskBaseId).orElseThrow();
        pmTaskBaseToEdit.setLabel("Nivel de oleo do transformador (corrigido)?");
        pmTaskBaseToEdit.setTaskType(TaskType.TEXT);
        // troca as opcoes: remove "Baixo", adiciona "Critico"
        List<TaskOption> optionsToRemove = new ArrayList<>(pmTaskBaseToEdit.getOptions());
        optionsToRemove.stream()
                .filter(o -> "Baixo".equals(o.getLabel()))
                .forEach(o -> {
                    pmTaskBaseToEdit.getOptions().remove(o);
                    taskOptionRepository.delete(o);
                });
        TaskOption optionCritical = new TaskOption("Critico", pmTaskBaseToEdit);
        optionCritical.setCompany(company);
        stamp(optionCritical);
        entityManager.persist(optionCritical);
        pmTaskBaseToEdit.getOptions().add(optionCritical);
        taskBaseRepository.save(pmTaskBaseToEdit);
        entityManager.flush();
        entityManager.clear();

        // NAO pode alterar a Task da OS #1 ja gerada.
        Task os1TaskReloaded = taskRepository.findById(os1Task.getId()).orElseThrow();
        assertEquals("Nivel de oleo do transformador?", os1TaskReloaded.getTaskBase().getLabel(),
                "label da OS #1 deve continuar congelado apos editar a pergunta na PM");
        assertEquals(TaskType.MULTIPLE, os1TaskReloaded.getTaskBase().getTaskType(),
                "tipo da OS #1 deve continuar congelado apos editar a pergunta na PM");
        List<String> os1OptionLabelsAfterEdit = os1TaskReloaded.getTaskBase().getOptions().stream()
                .map(TaskOption::getLabel).sorted().toList();
        assertEquals(List.of("Baixo", "Normal"), os1OptionLabelsAfterEdit,
                "opcoes da OS #1 devem continuar congeladas apos editar a pergunta na PM");

        // 5) Gerar uma OS #2 DEPOIS da edicao deve receber a versao NOVA.
        pm = preventiveMaintenanceRepository.findById(pm.getId()).orElseThrow();
        WorkOrder workOrder2 = generateWorkOrderFromPm(pm, 201L, "OS #2 gerada pela Preventiva");

        List<Task> os2Tasks = taskService.findByWorkOrder(workOrder2.getId());
        assertEquals(1, os2Tasks.size(), "OS #2 tambem deve ter recebido a pergunta da PM");
        Task os2Task = os2Tasks.get(0);
        assertEquals("Nivel de oleo do transformador (corrigido)?", os2Task.getTaskBase().getLabel(),
                "OS #2 deve receber a versao NOVA (pos-edicao) da pergunta");
        assertEquals(TaskType.TEXT, os2Task.getTaskBase().getTaskType());
        List<String> os2OptionLabels = os2Task.getTaskBase().getOptions().stream()
                .map(TaskOption::getLabel).sorted().toList();
        assertEquals(List.of("Critico", "Normal"), os2OptionLabels);
        // OS #1 e OS #2 usam TaskBase completamente diferentes entre si.
        assertNotEquals(os1Task.getTaskBase().getId(), os2Task.getTaskBase().getId());

        // 6) Excluir a pergunta da PM (TaskBase + Task propria) NAO pode
        // remover nem modificar a pergunta ja clonada nas OS antigas.
        final Long pmIdForLookup = pm.getId();
        Task pmOwnTaskToDelete = taskRepository.findAll().stream()
                .filter(t -> t.getPreventiveMaintenance() != null
                        && t.getPreventiveMaintenance().getId().equals(pmIdForLookup))
                .findFirst().orElseThrow();
        Long pmOwnTaskId = pmOwnTaskToDelete.getId();
        taskRepository.deleteById(pmOwnTaskId);
        taskBaseRepository.deleteById(pmTaskBaseId);
        entityManager.flush();
        entityManager.clear();

        assertFalse(taskBaseRepository.existsById(pmTaskBaseId), "a TaskBase original da PM foi realmente excluida");

        Task os1TaskAfterPmDeletion = taskRepository.findById(os1Task.getId()).orElseThrow();
        assertEquals("Nivel de oleo do transformador?", os1TaskAfterPmDeletion.getTaskBase().getLabel(),
                "excluir a pergunta da PM nao pode remover/alterar a pergunta ja clonada na OS #1");
        Task os2TaskAfterPmDeletion = taskRepository.findById(os2Task.getId()).orElseThrow();
        assertEquals("Nivel de oleo do transformador (corrigido)?", os2TaskAfterPmDeletion.getTaskBase().getLabel(),
                "excluir a pergunta da PM nao pode remover/alterar a pergunta ja clonada na OS #2");
    }
}
