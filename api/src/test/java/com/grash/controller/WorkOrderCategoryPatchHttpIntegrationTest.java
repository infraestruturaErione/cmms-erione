package com.grash.controller;

import com.grash.mapper.WorkOrderCategoryMapperImpl;
import com.grash.model.Checklist;
import com.grash.model.Company;
import com.grash.model.CompanySettings;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrderCategory;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.repository.CheckListRepository;
import com.grash.repository.PreventiveMaintenanceRepository;
import com.grash.repository.RequestRepository;
import com.grash.repository.WorkOrderCategoryRepository;
import com.grash.repository.WorkOrderMeterTriggerRepository;
import com.grash.repository.WorkOrderRepository;
import com.grash.repository.WorkflowActionRepository;
import com.grash.repository.WorkflowConditionRepository;
import com.grash.service.CompanySettingsService;
import com.grash.service.UserService;
import com.grash.service.WorkOrderCategoryService;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prova, passando pela desserializacao HTTP/Jackson REAL (nao DTO construido
 * na mao), que PATCH /work-order-categories/{id} agora diferencia campo
 * omitido (preserva) de false/true explicito (aplica) para os 7 require*.
 * Complementa WorkOrderCategoryPatchSemanticsTest (unitario, mais cenarios,
 * mais rapido) com o caminho HTTP real pedido explicitamente nesta rodada.
 */
@DataJpaTest
@ContextConfiguration(classes = WorkOrderCategoryPatchHttpIntegrationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class WorkOrderCategoryPatchHttpIntegrationTest {

    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
        @Bean
        WorkOrderCategoryMapperImpl workOrderCategoryMapper() {
            return new WorkOrderCategoryMapperImpl();
        }

        @Bean
        WorkOrderCategoryService workOrderCategoryService(
                WorkOrderCategoryRepository workOrderCategoryRepository,
                CompanySettingsService companySettingsService,
                WorkOrderCategoryMapperImpl mapper,
                WorkOrderRepository workOrderRepository,
                PreventiveMaintenanceRepository preventiveMaintenanceRepository,
                RequestRepository requestRepository,
                WorkOrderMeterTriggerRepository workOrderMeterTriggerRepository,
                WorkflowActionRepository workflowActionRepository,
                WorkflowConditionRepository workflowConditionRepository) {
            return new WorkOrderCategoryService(workOrderCategoryRepository, companySettingsService, mapper,
                    workOrderRepository, preventiveMaintenanceRepository, requestRepository,
                    workOrderMeterTriggerRepository, workflowActionRepository, workflowConditionRepository);
        }

        @Bean
        CompanySettingsService companySettingsService() {
            return mock(CompanySettingsService.class);
        }
    }

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private WorkOrderCategoryRepository workOrderCategoryRepository;
    @Autowired
    private CheckListRepository checklistRepository;
    @Autowired
    private WorkOrderCategoryService workOrderCategoryService;

    private MockMvc mockMvc;
    private User editor;
    private CompanySettings companySettings;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("Erione");
        stamp(company);
        // Company.companySettings ja vem inicializado com
        // "new CompanySettings(this)" e cascade=ALL - persistir a company
        // ja persiste esse companySettings default automaticamente. Criar
        // um CompanySettings separado e' o que causava a violacao de
        // unique constraint em company_settings.company_id.
        entityManager.persist(company);
        entityManager.flush();
        companySettings = company.getCompanySettings();

        Role role = new Role();
        role.setName("Admin");
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setEditOtherPermissions(new HashSet<>(java.util.List.of(PermissionEntity.CATEGORIES)));
        role.setViewOtherPermissions(new HashSet<>(java.util.List.of(PermissionEntity.CATEGORIES)));
        role.setDeleteOtherPermissions(new HashSet<>());
        entityManager.persist(role);

        editor = new User();
        editor.setFirstName("Admin");
        editor.setLastName("User");
        editor.setEmail("admin@test.local");
        editor.setUsername("admin@test.local");
        editor.setPassword("test");
        editor.setRole(role);
        editor.setCompany(company);
        stamp(editor);
        entityManager.persist(editor);

        entityManager.flush();

        UserService userService = mock(UserService.class);
        when(userService.whoami(org.mockito.ArgumentMatchers.any())).thenReturn(editor);

        WorkOrderCategoryController controller = new WorkOrderCategoryController(workOrderCategoryService, userService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    private WorkOrderCategory persistCategory(boolean allRequireFlags) {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setName("Eletrica");
        category.setCompanySettings(companySettings);
        category.setCreatedBy(editor.getId());
        category.setRequireSignature(allRequireFlags);
        category.setRequireSignerName(allRequireFlags);
        category.setRequireSignerDocument(allRequireFlags);
        category.setRequirePhotos(allRequireFlags);
        category.setRequireFieldReport(allRequireFlags);
        category.setRequireMileage(allRequireFlags);
        category.setRequireChecklistCompletion(allRequireFlags);
        stamp(category);
        entityManager.persist(category);
        entityManager.flush();
        entityManager.clear();
        return category;
    }

    private void stamp(com.grash.model.abstracts.DateAudit entity) {
        java.util.Date now = new java.util.Date();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
    }

    // PATCH real via JSON cru (so "name") preserva os 7 require* - prova
    // passando pela desserializacao Jackson de verdade, nao um DTO montado
    // na mao.
    @Test
    void httpPatch_onlyName_preservesAllSevenRequireFlags() throws Exception {
        WorkOrderCategory category = persistCategory(true);

        mockMvc.perform(patch("/work-order-categories/" + category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Eletrica Predial\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Eletrica Predial"))
                .andExpect(jsonPath("$.requireSignature").value(true))
                .andExpect(jsonPath("$.requireSignerName").value(true))
                .andExpect(jsonPath("$.requireSignerDocument").value(true))
                .andExpect(jsonPath("$.requirePhotos").value(true))
                .andExpect(jsonPath("$.requireFieldReport").value(true))
                .andExpect(jsonPath("$.requireMileage").value(true))
                .andExpect(jsonPath("$.requireChecklistCompletion").value(true));

        WorkOrderCategory persisted = workOrderCategoryRepository.findById(category.getId()).orElseThrow();
        assertTrue(persisted.isRequireSignature());
        assertTrue(persisted.isRequireChecklistCompletion());
    }

    // false explicito via JSON real muda true -> false; os demais (omitidos)
    // continuam true.
    @Test
    void httpPatch_explicitFalse_appliesAndPreservesOthers() throws Exception {
        WorkOrderCategory category = persistCategory(true);

        mockMvc.perform(patch("/work-order-categories/" + category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Eletrica\",\"requireSignature\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requireSignature").value(false))
                .andExpect(jsonPath("$.requirePhotos").value(true));

        WorkOrderCategory persisted = workOrderCategoryRepository.findById(category.getId()).orElseThrow();
        assertFalse(persisted.isRequireSignature());
        assertTrue(persisted.isRequirePhotos());
    }

    // true explicito via JSON real muda false -> true.
    @Test
    void httpPatch_explicitTrue_appliesCorrectly() throws Exception {
        WorkOrderCategory category = persistCategory(false);

        mockMvc.perform(patch("/work-order-categories/" + category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Eletrica\",\"requirePhotos\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requirePhotos").value(true))
                .andExpect(jsonPath("$.requireSignature").value(false));
    }

    // Payload misturando true/false/omitido via JSON real.
    @Test
    void httpPatch_mixedPayload_onlyTouchedFieldsChange() throws Exception {
        WorkOrderCategory category = persistCategory(false);
        // liga alguns manualmente antes do teste pra ter um baseline misto
        category.setRequireFieldReport(true);
        category.setRequireMileage(true);
        entityManager.merge(category);
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(patch("/work-order-categories/" + category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Eletrica\",\"requireSignature\":true,\"requireMileage\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requireSignature").value(true))   // alterado
                .andExpect(jsonPath("$.requireMileage").value(false))    // alterado
                .andExpect(jsonPath("$.requireFieldReport").value(true)) // omitido, preservado
                .andExpect(jsonPath("$.requirePhotos").value(false));    // omitido, preservado
    }

    // defaultChecklist continua podendo ser associado via JSON real.
    @Test
    void httpPatch_defaultChecklist_canBeAssociated() throws Exception {
        WorkOrderCategory category = persistCategory(false);
        Checklist checklist = new Checklist();
        checklist.setName("Checklist padrao");
        checklist.setCompanySettings(companySettings);
        stamp(checklist);
        checklist = checklistRepository.save(checklist);
        entityManager.flush();

        mockMvc.perform(patch("/work-order-categories/" + category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Eletrica\",\"defaultChecklist\":{\"id\":" + checklist.getId() + "}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultChecklist.id").value(checklist.getId()));
    }

    // defaultChecklist continua podendo ser desassociado (null explicito)
    // via JSON real - comportamento pre-existente, nao quebrado por esta
    // correcao.
    @Test
    void httpPatch_defaultChecklist_explicitNullStillDisassociates() throws Exception {
        WorkOrderCategory category = persistCategory(false);
        Checklist checklist = new Checklist();
        checklist.setName("Checklist padrao");
        checklist.setCompanySettings(companySettings);
        stamp(checklist);
        checklist = checklistRepository.save(checklist);
        category.setDefaultChecklist(checklist);
        entityManager.merge(category);
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(patch("/work-order-categories/" + category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Eletrica\",\"defaultChecklist\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultChecklist").doesNotExist());
    }
}
