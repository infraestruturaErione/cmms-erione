package com.grash.controller;

import com.grash.dto.license.LicenseEntitlement;
import com.grash.dto.webhookEndpoint.WebhookEndpointPatchDTO;
import com.grash.dto.webhookEndpoint.WebhookEndpointPostDTO;
import com.grash.dto.webhookEndpoint.WebhookEndpointShowDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.WebhookEndpointMapper;
import com.grash.mapper.WebhookEndpointMapperImpl;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.Subscription;
import com.grash.model.SubscriptionPlan;
import com.grash.model.User;
import com.grash.model.WebhookEndpoint;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.PlanFeatures;
import com.grash.model.enums.RoleType;
import com.grash.model.enums.webhook.WebhookEvent;
import com.grash.repository.WebhookEndpointRepository;
import com.grash.security.CustomUserDetail;
import com.grash.service.LicenseService;
import com.grash.service.WebhookEndpointService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * P0/P1 - /webhook-endpoints: toda operacao e' company-scoped E permission-scoped.
 * <p>
 * Antes: PATCH e DELETE buscavam o webhook so' por id (IDOR entre empresas) e nenhum metodo alem de
 * POST exigia SETTINGS/licenca/plano. Agora todos passam pela mesma regra
 * (WebhookEndpointService.assertCanManage) e pelo mesmo lookup por (id, company).
 * <p>
 * Estes testes rodam SEM SecurityContext de proposito: a protecao tem que estar no codigo da
 * operacao, nao depender do @PostLoad de CompanyAudit (que so' age quando ha principal logado).
 * Integracao real: H2 + WebhookEndpointService/Repository/Mapper reais; so' a licenca e' dubla.
 */
@DataJpaTest
@ContextConfiguration(classes = WebhookEndpointTenantAuthorizationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class WebhookEndpointTenantAuthorizationTest {

    @Configuration
    @EnableAutoConfiguration
    @EnableJpaAuditing
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
    }

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private WebhookEndpointRepository webhookEndpointRepository;

    private LicenseService licenseService;
    private WebhookEndpointService service;
    private WebhookEndpointController controller;

    private Company companyA;
    private Company companyB;
    private User adminA;     // SETTINGS, empresa A
    private User plainA;     // sem SETTINGS, empresa A
    private User adminB;     // SETTINGS, empresa B
    private WebhookEndpoint webhookA;
    private WebhookEndpoint webhookB;

    @BeforeEach
    void setUp() {
        licenseService = mock(LicenseService.class);
        when(licenseService.hasEntitlement(LicenseEntitlement.WEBHOOK)).thenReturn(true);

        WebhookEndpointMapper mapper = new WebhookEndpointMapperImpl();
        service = new WebhookEndpointService(webhookEndpointRepository, mapper, licenseService);
        ReflectionTestUtils.setField(service, "managementEnabled", true);
        controller = new WebhookEndpointController(service, mapper);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setName("Business");
        plan.setFeatures(new HashSet<>(Set.of(PlanFeatures.WEBHOOK)));
        entityManager.persist(plan);

        companyA = persistCompany("Erione", plan);
        companyB = persistCompany("Outra Empresa", plan);

        Role settingsRole = persistRole("Admin", Set.of(PermissionEntity.SETTINGS));
        Role plainRole = persistRole("Tecnico", Set.of());

        adminA = persistUser("admin-a", companyA, settingsRole);
        plainA = persistUser("plain-a", companyA, plainRole);
        adminB = persistUser("admin-b", companyB, settingsRole);

        webhookA = persistWebhook(companyA, "https://a.example/hook", "whsec_A");
        webhookB = persistWebhook(companyB, "https://b.example/hook", "whsec_B");
        entityManager.flush();
        entityManager.clear();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private Company persistCompany(String name, SubscriptionPlan plan) {
        Subscription subscription = Subscription.builder().usersCount(10).subscriptionPlan(plan).build();
        entityManager.persist(subscription);
        Company company = new Company();
        company.setName(name);
        company.setSubscription(subscription);
        entityManager.persist(company);
        return company;
    }

    private Role persistRole(String name, Set<PermissionEntity> viewPermissions) {
        Role role = new Role();
        role.setName(name);
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setViewPermissions(new HashSet<>(viewPermissions));
        entityManager.persist(role);
        return role;
    }

    private User persistUser(String username, Company company, Role role) {
        User user = new User();
        user.setFirstName(username);
        user.setLastName("Teste");
        user.setEmail(username + "@erione.test");
        user.setUsername(username);
        user.setPassword("x");
        user.setRole(role);
        user.setCompany(company);
        user.setEnabled(true);
        entityManager.persist(user);
        return user;
    }

    private WebhookEndpoint persistWebhook(Company company, String url, String secret) {
        WebhookEndpoint webhook = new WebhookEndpoint();
        webhook.setUrl(url);
        webhook.setSecret(secret);
        webhook.setEvent(WebhookEvent.NEW_WORK_ORDER);
        webhook.setEnabled(true);
        webhook.setCompany(company);
        entityManager.persist(webhook);
        return webhook;
    }

    private WebhookEndpoint reload(Long id) {
        entityManager.flush();
        entityManager.clear();
        return webhookEndpointRepository.findById(id).orElse(null);
    }

    private WebhookEndpointPatchDTO patch(String url) {
        WebhookEndpointPatchDTO dto = new WebhookEndpointPatchDTO();
        dto.setUrl(url);
        // O mapper de PATCH nao ignora nulos: sem "event" o update viola o @NotNull do modelo.
        dto.setEvent(WebhookEvent.NEW_WORK_ORDER);
        return dto;
    }

    private CustomException failure(Runnable action) {
        return assertThrows(CustomException.class, action::run);
    }

    // 1 - lista so' os webhooks da propria empresa.
    @Test
    void list_returnsOnlyOwnCompanyWebhooks() {
        List<WebhookEndpointShowDTO> listed = controller.listEndpoints(adminA).getBody();

        assertEquals(1, listed.size());
        assertEquals(webhookA.getId().intValue(), listed.get(0).getId().intValue());
        assertEquals(webhookB.getId().intValue(),
                controller.listEndpoints(adminB).getBody().get(0).getId().intValue());
    }

    // 2 - atualiza o proprio webhook.
    @Test
    void update_ownWebhook_withPermission_succeeds() {
        ResponseEntity<WebhookEndpointShowDTO> response =
                controller.updateEndpoint(adminA, webhookA.getId(), patch("https://a.example/novo"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("https://a.example/novo", reload(webhookA.getId()).getUrl());
    }

    // 3 - NAO atualiza o webhook de outra empresa; o registro alheio fica intacto.
    @Test
    void update_otherCompanyWebhook_isNotFound_andLeavesItUntouched() {
        CustomException error =
                failure(() -> controller.updateEndpoint(adminA, webhookB.getId(), patch("https://evil.example")));

        assertEquals(HttpStatus.NOT_FOUND, error.getHttpStatus());
        assertEquals("https://b.example/hook", reload(webhookB.getId()).getUrl());
    }

    // 4 - exclui o proprio webhook.
    @Test
    void delete_ownWebhook_withPermission_succeeds() {
        ResponseEntity<?> response = controller.deleteEndpoint(adminA, webhookA.getId());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(null, reload(webhookA.getId()));
    }

    // 5 - NAO exclui o webhook de outra empresa.
    @Test
    void delete_otherCompanyWebhook_isNotFound_andKeepsIt() {
        CustomException error = failure(() -> controller.deleteEndpoint(adminA, webhookB.getId()));

        assertEquals(HttpStatus.NOT_FOUND, error.getHttpStatus());
        assertTrue(reload(webhookB.getId()) != null);
    }

    // 6 - NAO rotaciona o segredo de outra empresa; o proprio rotaciona.
    @Test
    void rotateSecret_otherCompany_isNotFound_ownWorks() {
        CustomException error = failure(() -> controller.rotateSecret(adminA, webhookB.getId()));
        assertEquals(HttpStatus.NOT_FOUND, error.getHttpStatus());
        assertEquals("whsec_B", reload(webhookB.getId()).getSecret());

        String rotated = controller.rotateSecret(adminA, webhookA.getId()).getBody().getMessage();
        assertNotEquals("whsec_A", rotated);
        assertEquals(rotated, reload(webhookA.getId()).getSecret());
    }

    // Criar segue funcionando com permissao, e o webhook nasce na empresa do usuario logado.
    @Test
    void create_withPermission_succeeds_inCallersCompany() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                CustomUserDetail.builder().user(adminA).build(), "", List.of()));
        WebhookEndpointPostDTO request = new WebhookEndpointPostDTO();
        request.setUrl("https://a.example/criado");
        request.setEvent(WebhookEvent.NEW_WORK_ORDER);

        WebhookEndpointShowDTO created = controller.create(adminA, request).getBody();

        SecurityContextHolder.clearContext();
        assertEquals(companyA.getId(), reload(created.getId().longValue()).getCompany().getId());
    }

    // 7, 8, 9 (+ listar e rotacionar) - sem SETTINGS nada e' permitido, nem no PROPRIO webhook.
    @Test
    void withoutSettingsPermission_everyOperationIsForbidden() {
        WebhookEndpointPostDTO request = new WebhookEndpointPostDTO();
        request.setUrl("https://a.example/x");
        request.setEvent(WebhookEvent.NEW_WORK_ORDER);

        assertEquals(HttpStatus.FORBIDDEN, failure(() -> controller.create(plainA, request)).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN,
                failure(() -> controller.updateEndpoint(plainA, webhookA.getId(), patch("https://x"))).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN,
                failure(() -> controller.deleteEndpoint(plainA, webhookA.getId())).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN,
                failure(() -> controller.rotateSecret(plainA, webhookA.getId())).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN, failure(() -> controller.listEndpoints(plainA)).getHttpStatus());

        WebhookEndpoint unchanged = reload(webhookA.getId());
        assertEquals("https://a.example/hook", unchanged.getUrl());
        assertEquals("whsec_A", unchanged.getSecret());
    }

    // 10 - licenca WEBHOOK desligada: gerenciamento inteiro negado, mesmo para admin no proprio recurso.
    @Test
    void withoutWebhookLicense_everyOperationIsForbidden() {
        when(licenseService.hasEntitlement(LicenseEntitlement.WEBHOOK)).thenReturn(false);

        assertAllOperationsForbiddenFor(adminA);
        assertEquals("whsec_A", reload(webhookA.getId()).getSecret());
    }

    // 10b - plano da empresa sem a feature WEBHOOK: negado.
    @Test
    void withoutWebhookPlanFeature_everyOperationIsForbidden() {
        companyA.getSubscription().getSubscriptionPlan().setFeatures(new HashSet<>());

        assertAllOperationsForbiddenFor(adminA);
    }

    // 10c - modulo desligado na instalacao (WEBHOOK_MANAGEMENT_ENABLED=false, o padrao): negado.
    @Test
    void whenModuleDisabledOnInstallation_everyOperationIsForbidden() {
        ReflectionTestUtils.setField(service, "managementEnabled", false);

        assertAllOperationsForbiddenFor(adminA);
        assertAllOperationsForbiddenFor(adminB);
    }

    // O padrao de fabrica e' FECHADO.
    @Test
    void defaultConfiguration_isClosed() {
        WebhookEndpointService fresh =
                new WebhookEndpointService(webhookEndpointRepository, new WebhookEndpointMapperImpl(), licenseService);

        assertFalse((Boolean) ReflectionTestUtils.getField(fresh, "managementEnabled"));
        assertEquals(HttpStatus.FORBIDDEN, failure(() -> fresh.getActiveEndpoints(adminA)).getHttpStatus());
    }

    // 11 - id inexistente e id de outra empresa sao INDISTINGUIVEIS (mesmo status e mesma mensagem).
    @Test
    void nonexistentAndForeignIds_areIndistinguishable() {
        CustomException foreignUpdate =
                failure(() -> controller.updateEndpoint(adminA, webhookB.getId(), patch("https://x")));
        CustomException missingUpdate =
                failure(() -> controller.updateEndpoint(adminA, 999_999L, patch("https://x")));
        CustomException foreignDelete = failure(() -> controller.deleteEndpoint(adminA, webhookB.getId()));
        CustomException missingDelete = failure(() -> controller.deleteEndpoint(adminA, 999_999L));
        CustomException foreignRotate = failure(() -> controller.rotateSecret(adminA, webhookB.getId()));
        CustomException missingRotate = failure(() -> controller.rotateSecret(adminA, 999_999L));

        assertEquals(missingUpdate.getHttpStatus(), foreignUpdate.getHttpStatus());
        assertEquals(missingUpdate.getMessage(), foreignUpdate.getMessage());
        assertEquals(missingDelete.getHttpStatus(), foreignDelete.getHttpStatus());
        assertEquals(missingDelete.getMessage(), foreignDelete.getMessage());
        assertEquals(missingRotate.getHttpStatus(), foreignRotate.getHttpStatus());
        assertEquals(missingRotate.getMessage(), foreignRotate.getMessage());
        assertEquals(HttpStatus.NOT_FOUND, foreignRotate.getHttpStatus());
    }

    private void assertAllOperationsForbiddenFor(User user) {
        Long ownId = user == adminB ? webhookB.getId() : webhookA.getId();
        WebhookEndpointPostDTO request = new WebhookEndpointPostDTO();
        request.setUrl("https://x.example/y");
        request.setEvent(WebhookEvent.NEW_WORK_ORDER);

        assertEquals(HttpStatus.FORBIDDEN, failure(() -> controller.create(user, request)).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN, failure(() -> controller.listEndpoints(user)).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN,
                failure(() -> controller.updateEndpoint(user, ownId, patch("https://x"))).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN, failure(() -> controller.deleteEndpoint(user, ownId)).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN, failure(() -> controller.rotateSecret(user, ownId)).getHttpStatus());
    }
}
