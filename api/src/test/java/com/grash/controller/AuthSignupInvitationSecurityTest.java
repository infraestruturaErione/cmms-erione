package com.grash.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.dto.UserResponseDTO;
import com.grash.exception.CustomException;
import com.grash.exception.GlobalExceptionHandlerController;
import com.grash.mapper.RoleMapperImpl;
import com.grash.mapper.UserMapper;
import com.grash.mapper.UserMapperImpl;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.UserInvitation;
import com.grash.model.enums.RoleType;
import com.grash.repository.CompanyRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.RoleRepository;
import com.grash.repository.SuperAccountRelationRepository;
import com.grash.repository.UserInvitationRepository;
import com.grash.repository.UserRepository;
import com.grash.repository.VerificationTokenRepository;
import com.grash.security.JwtTokenProvider;
import com.grash.service.BrandingService;
import com.grash.service.CacheService;
import com.grash.service.CompanyService;
import com.grash.service.CompanySettingsService;
import com.grash.service.CurrencyService;
import com.grash.service.DemoDataService;
import com.grash.service.LdapService;
import com.grash.service.LicenseService;
import com.grash.factory.MailServiceFactory;
import com.grash.service.RoleService;
import com.grash.service.SubscriptionPlanService;
import com.grash.service.SubscriptionService;
import com.grash.service.UserInvitationService;
import com.grash.service.UserService;
import com.grash.service.VerificationTokenService;
import com.grash.utils.Utils;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * P0 - POST /auth/signup nao pode criar conta sem autorizacao server-side.
 * <p>
 * Regra: o unico jeito de entrar numa empresa existente e' um convite registrado por um admin
 * (UserInvitation: email + role). O role.id enviado pelo cliente so' escolhe QUAL convite procurar;
 * nunca concede autorizacao. INVITATION_VIA_EMAIL controla so' o envio do e-mail de convite, nao a
 * exigencia do convite. E COMPANY_SIGNUP_ENABLED=false impede criar empresa nova.
 * <p>
 * Integracao real: H2 + repositorios/servicos reais (UserService, RoleService, UserInvitationService).
 * So' e-mail, licenca, JWT e servicos de criacao de company sao dublês.
 */
@DataJpaTest
@ContextConfiguration(classes = AuthSignupInvitationSecurityTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class AuthSignupInvitationSecurityTest {

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
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private CompanyRepository companyRepository;
    @Autowired
    private UserInvitationRepository userInvitationRepository;

    private final AtomicInteger usernameSeq = new AtomicInteger();

    private CompanyService companyService;
    private UserService userService;
    private MockMvc mockMvc;

    private Company companyA;
    private Company companyB;
    private Role technicianRoleA;
    private Role adminRoleA;
    private Role adminRoleB;
    private User inviterA;

    @BeforeEach
    void setUp() {
        companyA = persistCompany("Erione");
        companyB = persistCompany("Outra Empresa");

        technicianRoleA = persistRole("Tecnico", companyA, RoleType.ROLE_CLIENT);
        adminRoleA = persistRole("Administrador", companyA, RoleType.ROLE_CLIENT);
        adminRoleB = persistRole("Administrador B", companyB, RoleType.ROLE_CLIENT);

        inviterA = new User();
        inviterA.setFirstName("Admin");
        inviterA.setLastName("A");
        inviterA.setEmail("admin-a@erione.test");
        inviterA.setUsername("admin-a");
        inviterA.setPassword("x");
        inviterA.setRole(adminRoleA);
        inviterA.setCompany(companyA);
        inviterA.setEnabled(true);
        entityManager.persist(inviterA);
        entityManager.flush();

        companyService = mock(CompanyService.class);
        Utils utils = mock(Utils.class);
        when(utils.generateStringId()).thenAnswer(i -> "user-" + usernameSeq.incrementAndGet());

        RoleService roleService = new RoleService(roleRepository, new RoleMapperImpl(),
                mock(CompanySettingsService.class), mock(LicenseService.class));
        UserMapper userMapper = new UserMapperImpl();

        userService = new UserService(
                userRepository,
                mock(CustomerRepository.class),
                new BCryptPasswordEncoder(4),
                mock(JwtTokenProvider.class),
                entityManager,
                mock(AuthenticationManager.class),
                utils,
                mock(MessageSource.class),
                mock(MailServiceFactory.class),
                roleService,
                companyService,
                mock(CurrencyService.class),
                new UserInvitationService(userInvitationRepository),
                mock(VerificationTokenRepository.class),
                mock(SubscriptionPlanService.class),
                mock(SubscriptionService.class),
                userMapper,
                mock(BrandingService.class),
                mock(DemoDataService.class),
                mock(ApplicationEventPublisher.class),
                mock(LicenseService.class),
                mock(CacheService.class));
        // Configuracao da instalacao Erione: sem cadastro de empresa, sem e-mail.
        configure(false, false);

        UserMapper controllerMapper = mock(UserMapper.class);
        when(controllerMapper.toResponseDto(any(User.class))).thenAnswer(invocation -> {
            User created = invocation.getArgument(0);
            UserResponseDTO dto = new UserResponseDTO();
            dto.setEmail(created.getEmail());
            return dto;
        });
        AuthController controller = new AuthController(userService, new BCryptPasswordEncoder(4),
                mock(VerificationTokenService.class), controllerMapper, mock(SuperAccountRelationRepository.class),
                mock(JwtTokenProvider.class), mock(MailServiceFactory.class), mock(LdapService.class));
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandlerController())
                .build();
    }

    private void configure(boolean companySignupEnabled, boolean invitationViaEmail) {
        ReflectionTestUtils.setField(userService, "companySignupEnabled", companySignupEnabled);
        ReflectionTestUtils.setField(userService, "enableInvitationViaEmail", invitationViaEmail);
        ReflectionTestUtils.setField(userService, "enableMails", false);
        ReflectionTestUtils.setField(userService, "cloudVersion", false);
        ReflectionTestUtils.setField(userService, "allowedOrganizationAdmins", new String[0]);
        ReflectionTestUtils.setField(userService, "PUBLIC_API_URL", "http://localhost:8080");
        ReflectionTestUtils.setField(userService, "frontendUrl", "http://localhost:3000");
    }

    private Company persistCompany(String name) {
        Company company = new Company();
        company.setName(name);
        entityManager.persist(company);
        return company;
    }

    private Role persistRole(String name, Company company, RoleType roleType) {
        Role role = new Role();
        role.setName(name);
        role.setRoleType(roleType);
        role.setCompanySettings(company.getCompanySettings());
        entityManager.persist(role);
        entityManager.flush();
        return role;
    }

    private Map<String, Object> signupBody(String email, Long roleId) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", "Senha#123");
        body.put("firstName", "Novo");
        body.put("lastName", "Usuario");
        body.put("phone", "62999999999");
        if (roleId != null) body.put("role", Map.of("id", roleId));
        return body;
    }

    private com.grash.dto.UserSignupRequest signupRequest(String email, Long roleId) {
        com.grash.dto.UserSignupRequest request = new com.grash.dto.UserSignupRequest();
        request.setEmail(email);
        request.setPassword("Senha#123");
        request.setFirstName("Novo");
        request.setLastName("Usuario");
        request.setPhone("62999999999");
        if (roleId != null) {
            Role role = new Role();
            role.setId(roleId);
            request.setRole(role);
        }
        return request;
    }

    // UserRepository.findByEmailIgnoreCase roda em REQUIRES_NEW (nova transacao), que nao enxerga os
    // dados ainda nao commitados do teste - por isso a leitura aqui e' feita na mesma transacao.
    private User findUser(String email) {
        return entityManager.createQuery("select u from User u where lower(u.email) = :email", User.class)
                .setParameter("email", email.toLowerCase())
                .getSingleResult();
    }

    private HttpStatus statusOf(Runnable action) {
        return assertThrows(CustomException.class, action::run).getHttpStatus();
    }

    private void invite(String email, Role role) {
        // Caminho real de convite feito por um admin (POST /users/invite -> UserService.invite).
        userService.invite(email, role, inviterA, true);
    }

    // 1 - sem role e COMPANY_SIGNUP_ENABLED=false: nao cria empresa nova, 403.
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void signup_withoutRole_companySignupDisabled_isRejectedAndCreatesNothing(boolean invitationViaEmail) {
        configure(false, invitationViaEmail);
        long companiesBefore = companyRepository.count();
        long usersBefore = userRepository.count();

        HttpStatus status = statusOf(() -> userService.signup(signupRequest("novo@erione.test", null)));

        assertEquals(HttpStatus.FORBIDDEN, status);
        assertEquals(companiesBefore, companyRepository.count());
        assertEquals(usersBefore, userRepository.count());
        // 9 - nem sequer tenta montar uma segunda company.
        verify(companyService, never()).create(any());
    }

    // 2 + 3 - role.id valido, mas SEM convite: negado com INVITATION_VIA_EMAIL true E false.
    // (com false, antes da correcao a conta era criada na empresa dona do role.)
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void signup_withValidRoleId_butNoInvitation_isRejected(boolean invitationViaEmail) {
        configure(false, invitationViaEmail);
        long usersBefore = userRepository.count();

        HttpStatus status =
                statusOf(() -> userService.signup(signupRequest("intruso@erione.test", technicianRoleA.getId())));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, status);
        assertEquals(usersBefore, userRepository.count());
        assertFalse(userRepository.existsByEmailIgnoreCase("intruso@erione.test"));
    }

    // 8 - cliente nao escolhe role privilegiada (da propria empresa nem de outra) sem convite.
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void signup_cannotPickPrivilegedRoleWithoutInvitation(boolean invitationViaEmail) {
        configure(false, invitationViaEmail);
        long usersBefore = userRepository.count();

        assertEquals(HttpStatus.NOT_ACCEPTABLE,
                statusOf(() -> userService.signup(signupRequest("quer-admin@erione.test", adminRoleA.getId()))));
        assertEquals(HttpStatus.NOT_ACCEPTABLE,
                statusOf(() -> userService.signup(signupRequest("quer-admin-b@erione.test", adminRoleB.getId()))));

        assertEquals(usersBefore, userRepository.count());
    }

    // 4 - convite para o e-mail A nao autoriza o e-mail B.
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void signup_invitationForEmailA_doesNotAuthorizeEmailB(boolean invitationViaEmail) {
        configure(false, invitationViaEmail);
        invite("a@erione.test", technicianRoleA);

        HttpStatus status =
                statusOf(() -> userService.signup(signupRequest("b@erione.test", technicianRoleA.getId())));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, status);
        assertFalse(userRepository.existsByEmailIgnoreCase("b@erione.test"));
    }

    // 5 - convite para o role X, request pedindo o role Y: negado (nem cria com X, nem com Y).
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void signup_invitationForRoleX_requestingRoleY_isRejected(boolean invitationViaEmail) {
        configure(false, invitationViaEmail);
        invite("tec@erione.test", technicianRoleA);

        HttpStatus status =
                statusOf(() -> userService.signup(signupRequest("tec@erione.test", adminRoleA.getId())));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, status);
        assertFalse(userRepository.existsByEmailIgnoreCase("tec@erione.test"));
    }

    // 6 + 7 + 10 - convite valido (criado pelo fluxo real de convite) -> usuario nasce na company e
    // com o role do convite, ativo imediatamente e SEM e-mail. Vale com INVITATION_VIA_EMAIL false e true.
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void signup_withValidInvitation_createsUserWithInvitedCompanyAndRole(boolean invitationViaEmail) {
        configure(false, invitationViaEmail);
        invite("tec@erione.test", technicianRoleA);

        userService.signup(signupRequest("tec@erione.test", technicianRoleA.getId()));

        entityManager.flush();
        entityManager.clear();
        User created = findUser("tec@erione.test");
        assertEquals(companyA.getId(), created.getCompany().getId());
        assertEquals(technicianRoleA.getId(), created.getRole().getId());
        assertTrue(created.isEnabled());
        assertFalse(created.isOwnsCompany());
    }

    // O e-mail do convite e' case-insensitive (o signup normaliza para minusculas).
    @Test
    void signup_invitationMatchIsCaseInsensitiveOnEmail() {
        invite("Mistura@Erione.test", technicianRoleA);

        userService.signup(signupRequest("mistura@erione.test", technicianRoleA.getId()));

        assertTrue(userRepository.existsByEmailIgnoreCase("mistura@erione.test"));
    }

    // Convite de um role sem companySettings (role padrao): company vem de QUEM convidou (server-side).
    @Test
    void signup_defaultRoleInvitation_takesCompanyFromInviter() {
        Role defaultRole = new Role();
        defaultRole.setName("Padrao");
        defaultRole.setRoleType(RoleType.ROLE_CLIENT);
        entityManager.persist(defaultRole);
        UserInvitation invitation = new UserInvitation("padrao@erione.test", defaultRole);
        invitation.setCreatedBy(inviterA.getId());
        entityManager.persist(invitation);
        entityManager.flush();

        userService.signup(signupRequest("padrao@erione.test", defaultRole.getId()));

        entityManager.flush();
        entityManager.clear();
        User created = findUser("padrao@erione.test");
        assertEquals(companyA.getId(), created.getCompany().getId());
    }

    // Convite de role padrao sem "quem convidou" registrado: nao ha empresa -> negado, sem 500.
    @Test
    void signup_defaultRoleInvitationWithoutInviter_isRejected() {
        Role defaultRole = new Role();
        defaultRole.setName("Padrao 2");
        defaultRole.setRoleType(RoleType.ROLE_CLIENT);
        entityManager.persist(defaultRole);
        entityManager.persist(new UserInvitation("orfao@erione.test", defaultRole));
        entityManager.flush();

        HttpStatus status =
                statusOf(() -> userService.signup(signupRequest("orfao@erione.test", defaultRole.getId())));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, status);
        assertFalse(userRepository.existsByEmailIgnoreCase("orfao@erione.test"));
    }

    // Convite e' de uso unico: consumido junto com a criacao do usuario.
    @Test
    void signup_consumesTheInvitation() {
        invite("uso-unico@erione.test", technicianRoleA);
        assertEquals(1, userInvitationRepository
                .findByRole_IdAndEmailIgnoreCase(technicianRoleA.getId(), "uso-unico@erione.test").size());

        userService.signup(signupRequest("uso-unico@erione.test", technicianRoleA.getId()));

        assertTrue(userInvitationRepository
                .findByRole_IdAndEmailIgnoreCase(technicianRoleA.getId(), "uso-unico@erione.test").isEmpty());
    }

    // O convite de um admin de OUTRA empresa nao vale para a empresa A (role e' de B).
    @Test
    void signup_invitationForCompanyB_doesNotGrantCompanyA() {
        invite("cruzado@erione.test", adminRoleB);

        assertEquals(HttpStatus.NOT_ACCEPTABLE,
                statusOf(() -> userService.signup(signupRequest("cruzado@erione.test", technicianRoleA.getId()))));

        // ...e usar o convite certo entra em B, nunca em A.
        userService.signup(signupRequest("cruzado@erione.test", adminRoleB.getId()));
        entityManager.flush();
        entityManager.clear();
        assertEquals(companyB.getId(),
                findUser("cruzado@erione.test").getCompany().getId());
    }

    // ---- Camada HTTP real (Jackson + GlobalExceptionHandler) ----

    @Test
    void http_signup_withoutRole_companySignupDisabled_returns403() throws Exception {
        mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsString(signupBody("http1@erione.test", null))))
                .andExpect(status().isForbidden());
        assertFalse(userRepository.existsByEmailIgnoreCase("http1@erione.test"));
    }

    @Test
    void http_signup_withRoleIdButNoInvitation_isRejected_evenWithInvitationViaEmailFalse() throws Exception {
        configure(false, false);
        mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper()
                                .writeValueAsString(signupBody("http2@erione.test", adminRoleA.getId()))))
                .andExpect(status().isNotAcceptable());
        assertFalse(userRepository.existsByEmailIgnoreCase("http2@erione.test"));
    }

    @Test
    void http_signup_withValidInvitation_succeeds() throws Exception {
        configure(false, false);
        invite("http3@erione.test", technicianRoleA);

        mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper()
                                .writeValueAsString(signupBody("http3@erione.test", technicianRoleA.getId()))))
                .andExpect(status().isOk());

        entityManager.flush();
        entityManager.clear();
        User created = findUser("http3@erione.test");
        assertEquals(companyA.getId(), created.getCompany().getId());
        assertEquals(technicianRoleA.getId(), created.getRole().getId());
    }
}
