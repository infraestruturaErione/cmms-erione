package com.grash.service;

import com.grash.mapper.TaskBaseMapperImpl;
import com.grash.mapper.TaskOptionMapperImpl;
import com.grash.model.Checklist;
import com.grash.model.Company;
import com.grash.model.CompanySettings;
import com.grash.model.Role;
import com.grash.model.TaskBase;
import com.grash.model.TaskOption;
import com.grash.model.User;
import com.grash.model.enums.RoleType;
import com.grash.repository.CheckListRepository;
import com.grash.repository.TaskBaseRepository;
import com.grash.repository.TaskOptionRepository;
import com.grash.security.CustomUserDetail;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Secao 4 da tarefa - prova, com persistencia REAL (H2 via @DataJpaTest, nao
 * mocks), que o congelamento historico funciona exatamente como desenhado:
 *
 * Questionario v1 -&gt; OS #1 clona v1 (TaskBase proprio, id novo)
 * Questionario editado -&gt; v2 (nova pergunta adicionada)
 * OS #1 continua com v1 (nao ganha a pergunta nova, nao perde nada)
 * OS #2 (novo clone, simulando nova OS apos a edicao) recebe v2
 *
 * Exercita TaskBaseService.cloneForNewOwner diretamente - o metodo real
 * usado por WorkOrderService.applyCategoryDefaults() pra clonar o
 * defaultChecklist da Category pra cada OS nova. Nao mocka esse metodo,
 * porque a garantia que queremos provar (linha nova/independente no banco)
 * so existe se ele rodar de verdade contra um banco real.
 */
@DataJpaTest
@ContextConfiguration(classes = TaskBaseCloningIntegrityTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class TaskBaseCloningIntegrityTest {

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
        TaskOptionService taskOptionService(TaskOptionRepository taskOptionRepository,
                                             CompanyService companyService, TaskOptionMapperImpl taskOptionMapper) {
            return new TaskOptionService(taskOptionRepository, companyService, taskOptionMapper);
        }

        @Bean
        TaskBaseService taskBaseService(TaskBaseRepository taskBaseRepository, CompanyService companyService,
                                         TaskBaseMapperImpl taskBaseMapper, TaskOptionService taskOptionService,
                                         UserService userService, MeterService meterService,
                                         AssetService assetService, EntityManager entityManager) {
            return new TaskBaseService(taskBaseRepository, companyService, taskBaseMapper, taskOptionService,
                    userService, meterService, assetService, entityManager);
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
        MeterService meterService() {
            return mock(MeterService.class);
        }

        @Bean
        AssetService assetService() {
            return mock(AssetService.class);
        }
    }

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private CheckListRepository checklistRepository;
    @Autowired
    private TaskBaseRepository taskBaseRepository;
    @Autowired
    private TaskBaseService taskBaseService;

    private Company company;
    private CompanySettings companySettings;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setName("Erione");
        stamp(company);
        entityManager.persist(company);
        companySettings = company.getCompanySettings(); // ja inicializado com cascade=ALL
        entityManager.flush();

        // CompanyAudit.beforePersist/afterLoad (TaskBase/TaskOption/Checklist)
        // preenchem/validam "company" a partir do usuario autenticado no
        // SecurityContext - sem isso, o clone criado por
        // TaskBaseService.cloneForNewOwner (que nunca seta company
        // manualmente, confia nesse hook, igual em producao) fica com
        // company=null e viola a constraint NOT NULL. Simula uma sessao
        // autenticada real.
        Role role = new Role();
        role.setId(1L);
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setName("Admin");
        User user = new User();
        user.setId(1L);
        user.setEmail("admin@test.local");
        user.setPassword("test");
        user.setRole(role);
        user.setCompany(company);
        CustomUserDetail principal = CustomUserDetail.builder().user(user).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
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

    private TaskBase persistTaskBase(String label, List<String> options) {
        TaskBase taskBase = TaskBase.builder().label(label)
                .taskType(com.grash.model.enums.TaskType.TEXT).build();
        taskBase.setCompany(company);
        stamp(taskBase);
        TaskBase saved = taskBaseRepository.save(taskBase);
        if (options != null) {
            for (String optionLabel : options) {
                TaskOption option = new TaskOption(optionLabel, saved);
                option.setCompany(company);
                stamp(option);
                entityManager.persist(option);
            }
        }
        entityManager.flush();
        entityManager.clear();
        return taskBaseRepository.findById(saved.getId()).orElseThrow();
    }

    // 1/2/11/12 - clonar 2x a mesma TaskBase (simulando OS #1 e OS #2
    // clonando o mesmo Questionario) produz 2 linhas INDEPENDENTES no
    // banco, com ids diferentes.
    @Test
    void cloningTwice_producesTwoIndependentRows() {
        TaskBase original = persistTaskBase("Tensao medida?", List.of("Normal", "Alta", "Baixa"));

        TaskBase clone1 = taskBaseService.cloneForNewOwner(original);
        TaskBase clone2 = taskBaseService.cloneForNewOwner(original);

        assertNotEquals(original.getId(), clone1.getId());
        assertNotEquals(original.getId(), clone2.getId());
        assertNotEquals(clone1.getId(), clone2.getId(), "duas OS clonando o mesmo Questionario devem gerar Tasks/TaskBase independentes");
        assertEquals("Tensao medida?", clone1.getLabel());
        assertEquals("Tensao medida?", clone2.getLabel());
    }

    // 3 - editar a TaskBase original DEPOIS de clonada nao afeta o clone
    // ja feito (simula: OS #1 criada com v1, Questionario editado depois).
    @Test
    void editingOriginalAfterCloning_doesNotAffectAlreadyClonedCopy() {
        TaskBase original = persistTaskBase("Tensao medida?", null);
        TaskBase clone = taskBaseService.cloneForNewOwner(original); // simula OS #1

        // "edita o Questionario original" (equivalente ao que
        // ChecklistService.update() faz ao reescrever o label de um item)
        original.setLabel("Tensao medida (v2, corrigido)?");
        taskBaseRepository.save(original);
        entityManager.flush();
        entityManager.clear();

        TaskBase clonePersisted = taskBaseRepository.findById(clone.getId()).orElseThrow();
        assertEquals("Tensao medida?", clonePersisted.getLabel(),
                "OS #1 (clone) deve continuar com o texto de quando foi criada, mesmo apos editar o original");
    }

    // 4 - clonar de novo DEPOIS da edicao (simulando "criar nova OS #2")
    // traz a versao NOVA - o clone antigo (OS #1) continua intocado.
    @Test
    void cloningAfterEdit_newCloneGetsUpdatedVersion_oldCloneStaysFrozen() {
        TaskBase original = persistTaskBase("Tensao medida?", null);
        TaskBase os1Clone = taskBaseService.cloneForNewOwner(original); // "OS #1" na v1

        original.setLabel("Tensao medida (com nova instrucao)?");
        taskBaseRepository.save(original);
        entityManager.flush();

        TaskBase os2Clone = taskBaseService.cloneForNewOwner(original); // "OS #2", apos a edicao
        entityManager.flush();
        entityManager.clear();

        TaskBase os1Reloaded = taskBaseRepository.findById(os1Clone.getId()).orElseThrow();
        TaskBase os2Reloaded = taskBaseRepository.findById(os2Clone.getId()).orElseThrow();

        assertEquals("Tensao medida?", os1Reloaded.getLabel(), "OS #1 continua congelada na v1");
        assertEquals("Tensao medida (com nova instrucao)?", os2Reloaded.getLabel(), "OS #2 recebe a v2 atual");
    }

    // Opcoes (alternativas de MULTIPLE/etc.) sao copiadas por VALOR, nao
    // por referencia - editar as opcoes do original depois nao muda as
    // opcoes ja clonadas.
    @Test
    void options_areCopiedByValue_notSharedAfterCloning() {
        TaskBase original = persistTaskBase("Disjuntor em boas condicoes?", List.of("Sim", "Nao"));
        TaskBase clone = taskBaseService.cloneForNewOwner(original);
        entityManager.flush();
        entityManager.clear();

        TaskBase clonePersisted = taskBaseRepository.findById(clone.getId()).orElseThrow();
        List<String> cloneOptionLabels = new ArrayList<>();
        clonePersisted.getOptions().forEach(o -> cloneOptionLabels.add(o.getLabel()));

        assertEquals(2, cloneOptionLabels.size());
        assertTrue(cloneOptionLabels.contains("Sim"));
        assertTrue(cloneOptionLabels.contains("Nao"));

        // As TaskOption clonadas tem ID proprio, diferente do original.
        TaskBase originalReloaded = taskBaseRepository.findById(original.getId()).orElseThrow();
        List<Long> originalOptionIds = originalReloaded.getOptions().stream().map(TaskOption::getId).toList();
        List<Long> cloneOptionIds = clonePersisted.getOptions().stream().map(TaskOption::getId).toList();
        assertTrue(cloneOptionIds.stream().noneMatch(originalOptionIds::contains),
                "opcoes clonadas devem ser linhas novas, nao reaproveitar o id das opcoes originais");
    }

    // Tipo de resposta (taskType) e' preservado no clone.
    @Test
    void taskType_isPreservedOnClone() {
        TaskBase original = TaskBase.builder().label("Ha ruido anormal?")
                .taskType(com.grash.model.enums.TaskType.MULTIPLE).build();
        original.setCompany(company);
        stamp(original);
        TaskBase saved = taskBaseRepository.save(original);

        TaskBase clone = taskBaseService.cloneForNewOwner(saved);

        assertEquals(com.grash.model.enums.TaskType.MULTIPLE, clone.getTaskType());
    }

    // 2 - Checklist com varios TaskBase: clonar todos (simulando
    // applyCategoryDefaults percorrendo defaultChecklist.getTaskBases())
    // preserva a ordem em que estavam na colecao original.
    @Test
    void cloningAllTaskBasesFromChecklist_preservesOrder() {
        TaskBase tb1 = persistTaskBase("Tensao medida?", null);
        TaskBase tb2 = persistTaskBase("Ha aquecimento?", null);
        TaskBase tb3 = persistTaskBase("Disjuntor em boas condicoes?", null);

        Checklist checklist = new Checklist();
        checklist.setName("Preventiva Eletrica");
        checklist.setCompanySettings(companySettings);
        stamp(checklist);
        checklist.setTaskBases(List.of(tb1, tb2, tb3));
        Checklist savedChecklist = checklistRepository.save(checklist);
        entityManager.flush();
        entityManager.clear();

        Checklist reloaded = checklistRepository.findById(savedChecklist.getId()).orElseThrow();
        List<TaskBase> clones = new ArrayList<>();
        reloaded.getTaskBases().forEach(sourceTaskBase -> clones.add(taskBaseService.cloneForNewOwner(sourceTaskBase)));

        assertEquals(3, clones.size());
        assertEquals("Tensao medida?", clones.get(0).getLabel());
        assertEquals("Ha aquecimento?", clones.get(1).getLabel());
        assertEquals("Disjuntor em boas condicoes?", clones.get(2).getLabel());
    }
}
