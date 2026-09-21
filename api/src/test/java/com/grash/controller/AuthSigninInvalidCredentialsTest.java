package com.grash.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.exception.CustomException;
import com.grash.exception.GlobalExceptionHandlerController;
import com.grash.factory.MailServiceFactory;
import com.grash.mapper.RoleMapperImpl;
import com.grash.mapper.UserMapper;
import com.grash.mapper.UserMapperImpl;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.RoleType;
import com.grash.repository.CustomerRepository;
import com.grash.repository.RoleRepository;
import com.grash.repository.SuperAccountRelationRepository;
import com.grash.repository.UserInvitationRepository;
import com.grash.repository.UserRepository;
import com.grash.repository.VerificationTokenRepository;
import com.grash.security.ClientIpResolver;
import com.grash.security.CustomUserDetailsService;
import com.grash.security.JwtTokenProvider;
import com.grash.security.RateLimitFilter;
import com.grash.service.BrandingService;
import com.grash.service.CacheService;
import com.grash.service.CompanyService;
import com.grash.service.CompanySettingsService;
import com.grash.service.CurrencyService;
import com.grash.service.DemoDataService;
import com.grash.service.LdapService;
import com.grash.service.LicenseService;
import com.grash.service.RateLimiterService;
import com.grash.service.RoleService;
import com.grash.service.SubscriptionPlanService;
import com.grash.service.SubscriptionService;
import com.grash.service.UserInvitationService;
import com.grash.service.UserService;
import com.grash.service.VerificationTokenService;
import com.grash.utils.Utils;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * POST /auth/signin com credencial invalida deve ser 401 generico - nunca 500 (nem 403 "Invalid credentials").
 * <p>
 * Integracao real: H2 com COMMIT (o UserRepository.findByEmailIgnoreCase roda em REQUIRES_NEW), o
 * AuthenticationManager de verdade (DaoAuthenticationProvider + CustomUserDetailsService + BCrypt),
 * o handler global e o RateLimitFilter real na frente do controller. So' o JWT e' dubla.
 */
@DataJpaTest
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@ContextConfiguration(classes = AuthSigninInvalidCredentialsTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.enable_lazy_load_no_trans=true", // igual ao application.yml
        "spring.liquibase.enabled=false"
})
class AuthSigninInvalidCredentialsTest {

    @Configuration
    @EnableAutoConfiguration
    @EnableJpaAuditing
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
    }

    private static final String NGINX = "172.18.0.5";
    private static final String CLIENT_IP = "198.51.100.7";
    private static final String PASSWORD = "Senha#123";
    private static final String INVALID_BODY = "{\"success\":false,\"message\":\"Invalid credentials\"}";
    private static final String UNKNOWN_EMAIL = "xff-probe-do-not-exist@erione.invalid";

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserInvitationRepository userInvitationRepository;

    private final AtomicInteger usernameSeq = new AtomicInteger();
    private final ObjectMapper json = new ObjectMapper();

    private UserService userService;
    private CustomUserDetailsService userDetailsService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
        Role clientRole = new Role();
        clientRole.setName("Admin");
        clientRole.setRoleType(RoleType.ROLE_CLIENT);
        roleRepository.save(clientRole);

        saveUser("valid@erione.test", encoder.encode(PASSWORD), true, clientRole);
        saveUser("disabled@erione.test", encoder.encode(PASSWORD), false, clientRole);

        userDetailsService = new CustomUserDetailsService();
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(encoder);
        AuthenticationManager authenticationManager = new ProviderManager(provider);

        Utils utils = mock(Utils.class);
        when(utils.generateStringId()).thenAnswer(i -> "user-" + usernameSeq.incrementAndGet());
        JwtTokenProvider jwtTokenProvider = mock(JwtTokenProvider.class);
        when(jwtTokenProvider.createToken(anyString(), any())).thenReturn("test-jwt");

        userService = new UserService(
                userRepository, mock(CustomerRepository.class), encoder, jwtTokenProvider, entityManager,
                authenticationManager, utils, mock(MessageSource.class), mock(MailServiceFactory.class),
                new RoleService(roleRepository, new RoleMapperImpl(), mock(CompanySettingsService.class),
                        mock(LicenseService.class)),
                mock(CompanyService.class), mock(CurrencyService.class),
                new UserInvitationService(userInvitationRepository), mock(VerificationTokenRepository.class),
                mock(SubscriptionPlanService.class), mock(SubscriptionService.class), (UserMapper) new UserMapperImpl(),
                mock(BrandingService.class), mock(DemoDataService.class), mock(ApplicationEventPublisher.class),
                mock(LicenseService.class), new CacheService(new ConcurrentMapCacheManager("users")));
        ReflectionTestUtils.setField(userDetailsService, "userService", userService);

        RateLimiterService rateLimiterService = new RateLimiterService();
        ReflectionTestUtils.setField(rateLimiterService, "rateLimitEnabled", true);
        RateLimitFilter rateLimitFilter =
                new RateLimitFilter(rateLimiterService, new ClientIpResolver(ClientIpResolver.DEFAULT_TRUSTED_PROXIES, 1));

        AuthController controller = new AuthController(userService, encoder, mock(VerificationTokenService.class),
                mock(UserMapper.class), mock(SuperAccountRelationRepository.class), jwtTokenProvider,
                mock(MailServiceFactory.class), mock(LdapService.class));
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandlerController())
                .addFilters(rateLimitFilter)
                .build();
    }

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll();
        roleRepository.deleteAll();
    }

    private void saveUser(String email, String encodedPassword, boolean enabled, Role role) {
        User user = new User();
        user.setFirstName("Teste");
        user.setLastName("Login");
        user.setEmail(email);
        user.setUsername(email);
        user.setPassword(encodedPassword);
        user.setEnabled(enabled);
        user.setRole(role);
        userRepository.save(user);
    }

    private MockHttpServletRequestBuilder signin(String email, String password, String type, String... xff) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);
        if (type != null) body.put("type", type);
        MockHttpServletRequestBuilder builder = post("/auth/signin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))
                .with(request -> {
                    request.setRemoteAddr(NGINX);
                    return request;
                });
        for (String value : xff) builder.header("X-Forwarded-For", value);
        return builder;
    }

    private MvcResult perform(String email, String password, String... xff) throws Exception {
        return mockMvc.perform(signin(email, password, "CLIENT", xff)).andReturn();
    }

    // 1 - e-mail inexistente -> 401 e corpo generico (era o caso que virava 500)
    @Test
    void unknownEmail_returns401_withGenericBody() throws Exception {
        mockMvc.perform(signin(UNKNOWN_EMAIL, "qualquer", "CLIENT", CLIENT_IP))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid credentials"));
    }

    // 1b - mesmo caso sem o campo "type" (o DTO usa CLIENT por padrao)
    @Test
    void unknownEmail_withoutTypeField_returns401() throws Exception {
        mockMvc.perform(signin(UNKNOWN_EMAIL, "qualquer", null, CLIENT_IP))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid credentials"));
    }

    // 2 - usuario existente + senha errada -> 401
    @Test
    void existingUser_wrongPassword_returns401() throws Exception {
        mockMvc.perform(signin("valid@erione.test", "senha-errada", "CLIENT", CLIENT_IP))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid credentials"));
    }

    // 3 - login valido continua funcionando
    @Test
    void validCredentials_stillLogIn_caseInsensitiveEmail() throws Exception {
        mockMvc.perform(signin("valid@erione.test", PASSWORD, "CLIENT", CLIENT_IP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("test-jwt"));
        mockMvc.perform(signin("VALID@ERIONE.TEST", PASSWORD, "CLIENT", "198.51.100.8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("test-jwt"));
    }

    // 4 - a resposta nao revela se o usuario existe: mesmo status e MESMO corpo, byte a byte
    @Test
    void invalidResponses_areIndistinguishable_unknownUserVsWrongPasswordVsDisabledVsWrongType() throws Exception {
        MvcResult unknown = perform(UNKNOWN_EMAIL, "qualquer", CLIENT_IP);
        MvcResult wrongPassword = perform("valid@erione.test", "senha-errada", CLIENT_IP);
        MvcResult disabled = perform("disabled@erione.test", PASSWORD, CLIENT_IP);
        MvcResult wrongType = mockMvc.perform(signin("valid@erione.test", PASSWORD, "SUPER_ADMIN", CLIENT_IP)).andReturn();

        for (MvcResult result : new MvcResult[]{unknown, wrongPassword, disabled, wrongType}) {
            assertEquals(401, result.getResponse().getStatus());
            assertEquals(INVALID_BODY, result.getResponse().getContentAsString());
            assertEquals(unknown.getResponse().getHeaderNames(), result.getResponse().getHeaderNames());
        }
    }

    // 5 - o erro de autenticacao NAO cai no handler generico ("Erro interno do servidor.")
    @Test
    void authenticationFailure_neverReachesTheGenericHandler() throws Exception {
        MvcResult result = perform(UNKNOWN_EMAIL, "qualquer", CLIENT_IP);

        assertNotEquals(500, result.getResponse().getStatus());
        assertFalse(result.getResponse().getContentAsString().contains("Erro interno"));
    }

    // 5b - direto no servico: CustomException 401 (e nao NoSuchElementException/500)
    @Test
    void service_unknownUser_throwsCustomException401() {
        CustomException error =
                assertThrows(CustomException.class, () -> userService.signin(UNKNOWN_EMAIL, "x", "CLIENT"));

        assertEquals(HttpStatus.UNAUTHORIZED, error.getHttpStatus());
        assertEquals("Invalid credentials", error.getMessage());
    }

    // 5c - contrato do UserDetailsService: usuario inexistente -> UsernameNotFoundException
    @Test
    void userDetailsService_unknownUser_throwsUsernameNotFound() {
        assertThrows(UsernameNotFoundException.class, () -> userDetailsService.loadUserByUsername(UNKNOWN_EMAIL));
    }

    // 6 - o rate limit continua sendo aplicado depois de respostas 401
    // 7 - atingido o limite, 429 tem precedencia (ate para credencial VALIDA), e o controller nem e' chamado
    @Test
    void rateLimit_isAppliedAfter401s_and429TakesPrecedence() throws Exception {
        for (int i = 1; i <= 10; i++) {
            assertEquals(401, perform(UNKNOWN_EMAIL, "x", CLIENT_IP).getResponse().getStatus(), "tentativa " + i);
        }

        MvcResult limited = perform(UNKNOWN_EMAIL, "x", CLIENT_IP);
        assertEquals(429, limited.getResponse().getStatus());

        // credencial VALIDA tambem recebe 429: o limite vem antes do controller...
        MvcResult validButLimited = perform("valid@erione.test", PASSWORD, CLIENT_IP);
        assertEquals(429, validButLimited.getResponse().getStatus());
        // ...e portanto nenhum login aconteceu (lastLogin continua vazio).
        assertNull(userRepository.findAll().stream()
                .filter(u -> u.getEmail().equals("valid@erione.test")).findFirst().orElseThrow().getLastLogin());
    }

    // 6/7 + bypass - fim a fim (filtro + controller + handler): XFF inventado nao libera o bucket saturado
    @Test
    void forgedXForwardedFor_cannotEscapeTheLoginRateLimit_endToEnd() throws Exception {
        for (int i = 1; i <= 10; i++) {
            assertEquals(401, perform(UNKNOWN_EMAIL, "x", CLIENT_IP).getResponse().getStatus());
        }
        assertEquals(429, perform(UNKNOWN_EMAIL, "x", CLIENT_IP).getResponse().getStatus());   // NORMAL
        assertEquals(429, perform(UNKNOWN_EMAIL, "x", CLIENT_IP).getResponse().getStatus());   // CONTROLE NORMAL

        // o nginx acrescenta o IP real DEPOIS do que o cliente mandou
        assertEquals(429, perform(UNKNOWN_EMAIL, "x", "203.0.113.77, " + CLIENT_IP).getResponse().getStatus());
        assertEquals(429, perform(UNKNOWN_EMAIL, "x", "203.0.113.78, " + CLIENT_IP).getResponse().getStatus());
        assertEquals(429, perform(UNKNOWN_EMAIL, "x", CLIENT_IP).getResponse().getStatus());   // CONTROLE FINAL

        // outro cliente real nao e' punido
        assertEquals(401, perform(UNKNOWN_EMAIL, "x", "198.51.100.8").getResponse().getStatus());
    }
}
