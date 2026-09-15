package com.grash.controller;

import com.grash.mapper.RoleMapperImpl;
import com.grash.model.Company;
import com.grash.model.CompanySettings;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.repository.RoleRepository;
import com.grash.service.CompanySettingsService;
import com.grash.service.LicenseService;
import com.grash.service.RoleService;
import com.grash.service.UserService;
import jakarta.persistence.EntityManager;
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
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prova, passando pela desserializacao HTTP/Jackson REAL, que
 * PATCH /roles/{id} preserva as 5 listas de permissao quando omitidas, e
 * diferencia [] explicito (limpa) de lista com valores (substitui) - so no
 * grupo enviado, nunca nos outros 4.
 */
@DataJpaTest
@ContextConfiguration(classes = RolePatchHttpIntegrationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class RolePatchHttpIntegrationTest {

    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
        @Bean
        RoleMapperImpl roleMapper() {
            return new RoleMapperImpl();
        }

        @Bean
        RoleService roleService(RoleRepository roleRepository, RoleMapperImpl mapper,
                                 CompanySettingsService companySettingsService, LicenseService licenseService) {
            return new RoleService(roleRepository, mapper, companySettingsService, licenseService);
        }

        @Bean
        CompanySettingsService companySettingsService() {
            return mock(CompanySettingsService.class);
        }

        @Bean
        LicenseService licenseService() {
            return mock(LicenseService.class);
        }
    }

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private RoleService roleService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("Erione");
        stamp(company);
        // Company.companySettings ja vem inicializado com cascade=ALL -
        // persistir a company basta.
        entityManager.persist(company);

        Role adminRole = new Role();
        adminRole.setName("Admin");
        adminRole.setRoleType(RoleType.ROLE_CLIENT);
        adminRole.setViewPermissions(new HashSet<>(List.of(PermissionEntity.SETTINGS)));
        entityManager.persist(adminRole);

        User admin = new User();
        admin.setFirstName("Admin");
        admin.setLastName("User");
        admin.setEmail("admin@test.local");
        admin.setUsername("admin@test.local");
        admin.setPassword("test");
        admin.setRole(adminRole);
        admin.setCompany(company);
        stamp(admin);
        entityManager.persist(admin);
        entityManager.flush();

        UserService userService = mock(UserService.class);
        when(userService.whoami(org.mockito.ArgumentMatchers.any())).thenReturn(admin);

        RoleController controller = new RoleController(roleService, userService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new com.grash.exception.GlobalExceptionHandlerController())
                .build();
    }

    private Role persistRole() {
        Role role = new Role();
        role.setName("Supervisor");
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setCreatePermissions(new HashSet<>(List.of(PermissionEntity.WORK_ORDERS)));
        role.setViewPermissions(new HashSet<>(List.of(PermissionEntity.WORK_ORDERS, PermissionEntity.ASSETS)));
        role.setViewOtherPermissions(new HashSet<>(List.of(PermissionEntity.ASSETS)));
        role.setEditOtherPermissions(new HashSet<>(List.of(PermissionEntity.CATEGORIES)));
        role.setDeleteOtherPermissions(new HashSet<>(List.of(PermissionEntity.LOCATIONS)));
        entityManager.persist(role);
        entityManager.flush();
        entityManager.clear();
        return role;
    }

    private void stamp(com.grash.model.abstracts.DateAudit entity) {
        java.util.Date now = new java.util.Date();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
    }

    // 1 - PATCH real (name apenas) via JSON cru preserva os 5 grupos.
    @Test
    void httpPatch_onlyName_preservesAllPermissionGroups() throws Exception {
        Role role = persistRole();

        mockMvc.perform(patch("/roles/" + role.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Supervisor N2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Supervisor N2"))
                .andExpect(jsonPath("$.createPermissions", org.hamcrest.Matchers.contains("WORK_ORDERS")))
                .andExpect(jsonPath("$.viewPermissions", org.hamcrest.Matchers.containsInAnyOrder("WORK_ORDERS", "ASSETS")))
                .andExpect(jsonPath("$.editOtherPermissions", org.hamcrest.Matchers.contains("CATEGORIES")))
                .andExpect(jsonPath("$.deleteOtherPermissions", org.hamcrest.Matchers.contains("LOCATIONS")));

        Role persisted = roleRepository.findById(role.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(1, persisted.getCreatePermissions().size());
        org.junit.jupiter.api.Assertions.assertEquals(1, persisted.getDeleteOtherPermissions().size());
    }

    // 4 - [] explicito via JSON real limpa SOMENTE o grupo enviado.
    @Test
    void httpPatch_explicitEmptyArray_clearsOnlyThatGroup() throws Exception {
        Role role = persistRole();

        mockMvc.perform(patch("/roles/" + role.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Supervisor\",\"viewOtherPermissions\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewOtherPermissions", org.hamcrest.Matchers.empty()))
                .andExpect(jsonPath("$.createPermissions", org.hamcrest.Matchers.contains("WORK_ORDERS")))
                .andExpect(jsonPath("$.editOtherPermissions", org.hamcrest.Matchers.contains("CATEGORIES")));

        Role persisted = roleRepository.findById(role.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(persisted.getViewOtherPermissions().isEmpty());
        org.junit.jupiter.api.Assertions.assertEquals(1, persisted.getCreatePermissions().size());
    }

    // 5 - lista explicita via JSON real SUBSTITUI somente o grupo enviado.
    @Test
    void httpPatch_explicitList_replacesOnlyThatGroup() throws Exception {
        Role role = persistRole();

        mockMvc.perform(patch("/roles/" + role.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Supervisor\",\"editOtherPermissions\":[\"LOCATIONS\",\"METERS\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editOtherPermissions",
                        org.hamcrest.Matchers.containsInAnyOrder("LOCATIONS", "METERS")))
                .andExpect(jsonPath("$.createPermissions", org.hamcrest.Matchers.contains("WORK_ORDERS")));
    }

    // 7 - autorizacao existente continua funcionando: usuario sem SETTINGS
    // continua bloqueado (nada mudou na regra de autorizacao do controller).
    @Test
    void httpPatch_userWithoutSettingsPermission_isForbidden() throws Exception {
        Company company = new Company();
        company.setName("Erione 2");
        stamp(company);
        entityManager.persist(company);

        Role technicianRole = new Role();
        technicianRole.setName("Tecnico");
        technicianRole.setRoleType(RoleType.ROLE_CLIENT);
        technicianRole.setViewPermissions(new HashSet<>());
        entityManager.persist(technicianRole);

        User technician = new User();
        technician.setFirstName("Tec");
        technician.setLastName("User");
        technician.setEmail("tec@test.local");
        technician.setUsername("tec@test.local");
        technician.setPassword("test");
        technician.setRole(technicianRole);
        technician.setCompany(company);
        stamp(technician);
        entityManager.persist(technician);
        entityManager.flush();

        UserService userServiceNoAccess = mock(UserService.class);
        when(userServiceNoAccess.whoami(org.mockito.ArgumentMatchers.any())).thenReturn(technician);
        RoleController controllerNoAccess = new RoleController(roleService, userServiceNoAccess);
        MockMvc mockMvcNoAccess = MockMvcBuilders.standaloneSetup(controllerNoAccess)
                .setControllerAdvice(new com.grash.exception.GlobalExceptionHandlerController())
                .build();

        Role role = persistRole();

        mockMvcNoAccess.perform(patch("/roles/" + role.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Hackeado\"}"))
                .andExpect(status().isForbidden());

        Role persisted = roleRepository.findById(role.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("Supervisor", persisted.getName(), "PATCH bloqueado nao deve ter mudado nada");
    }
}
