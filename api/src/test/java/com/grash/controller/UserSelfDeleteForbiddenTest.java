package com.grash.controller;

import com.grash.dto.UserResponseDTO;
import com.grash.exception.CustomException;
import com.grash.exception.GlobalExceptionHandlerController;
import com.grash.mapper.UserMapper;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.repository.CompanyRepository;
import com.grash.repository.SuperAccountRelationRepository;
import com.grash.repository.UserRepository;
import com.grash.security.CustomUserDetail;
import com.grash.security.JwtTokenProvider;
import com.grash.service.CompanyService;
import com.grash.service.CustomerScopeService;
import com.grash.service.IntercomService;
import com.grash.service.LdapService;
import com.grash.factory.MailServiceFactory;
import com.grash.service.RoleService;
import com.grash.service.UserService;
import com.grash.service.VerificationTokenService;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * P1 - nenhum usuario exclui/desativa a propria conta nem a propria empresa.
 * <p>
 * Antes: DELETE /auth (permitAll -> qualquer autenticado) apagava a empresa inteira se o usuario fosse
 * o dono, ou o proprio usuario; e PATCH /users/soft-delete/{id} aceitava requester.id == id como
 * autorizacao (e, para outros, so' exigia VIEW de SETTINGS).
 * <p>
 * Agora: DELETE /auth existe so' como bloqueio (403 "Account self-deletion is disabled", sem logica de
 * exclusao); soft-delete proibe explicitamente id == requester (mesmo admin) e
 * exige a permissao administrativa de exclusao de People & Teams, sempre dentro da empresa do requester.
 */
@DataJpaTest
@ContextConfiguration(classes = UserSelfDeleteForbiddenTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class UserSelfDeleteForbiddenTest {

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
    private CompanyRepository companyRepository;

    private UserController userController;
    private MockMvc authMockMvc;

    private Company companyA;
    private Company companyB;
    private User owner;        // dono da empresa A, com permissao total de People & Teams
    private User adminA;       // admin da empresa A (nao e' dono)
    private User plainA;       // usuario comum da empresa A (sem permissoes administrativas)
    private User viewSettingsA; // so' VIEW de SETTINGS (regra antiga concedia soft-delete a ele)
    private User targetA;      // usuario comum alvo
    private User adminB;       // admin da empresa B
    private User targetB;      // usuario da empresa B

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @BeforeEach
    void setUp() {
        companyA = persistCompany("Erione");
        companyB = persistCompany("Outra Empresa");

        Role fullAdminRole = persistRole("Admin", Set.of(PermissionEntity.SETTINGS), Set.of(PermissionEntity.PEOPLE_AND_TEAMS),
                Set.of(PermissionEntity.PEOPLE_AND_TEAMS));
        Role plainRole = persistRole("Tecnico", Set.of(), Set.of(), Set.of());
        Role viewSettingsRole = persistRole("Le Config", Set.of(PermissionEntity.SETTINGS), Set.of(), Set.of());

        owner = persistUser("owner", companyA, fullAdminRole, true);
        adminA = persistUser("admin-a", companyA, fullAdminRole, false);
        plainA = persistUser("plain-a", companyA, plainRole, false);
        viewSettingsA = persistUser("view-a", companyA, viewSettingsRole, false);
        targetA = persistUser("target-a", companyA, plainRole, false);
        adminB = persistUser("admin-b", companyB, fullAdminRole, false);
        targetB = persistUser("target-b", companyB, plainRole, false);
        entityManager.flush();

        // Servico com lookup e gravacao REAIS (repositorio H2): o escopo por empresa e' o da query real.
        UserService userService = mock(UserService.class);
        when(userService.findByIdAndCompany(any(), any())).thenAnswer(invocation ->
                userRepository.findByIdAndCompany_Id(invocation.getArgument(0), invocation.getArgument(1)));
        when(userService.save(any())).thenAnswer(invocation -> userRepository.save(invocation.getArgument(0)));
        UserMapper userMapper = mock(UserMapper.class);
        when(userMapper.toResponseDto(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            UserResponseDTO dto = new UserResponseDTO();
            dto.setId(user.getId().intValue());
            return dto;
        });
        userController = new UserController(userService, mock(RoleService.class), userMapper,
                mock(IntercomService.class), mock(CompanyService.class), mock(CustomerScopeService.class));

        AuthController authController = new AuthController(userService, new BCryptPasswordEncoder(4),
                mock(VerificationTokenService.class), userMapper, mock(SuperAccountRelationRepository.class),
                mock(JwtTokenProvider.class), mock(MailServiceFactory.class), mock(LdapService.class));
        authMockMvc = MockMvcBuilders.standaloneSetup(authController)
                .setControllerAdvice(new GlobalExceptionHandlerController())
                .build();
    }

    private Company persistCompany(String name) {
        Company company = new Company();
        company.setName(name);
        entityManager.persist(company);
        return company;
    }

    private Role persistRole(String name, Set<PermissionEntity> view, Set<PermissionEntity> editOther,
                             Set<PermissionEntity> deleteOther) {
        Role role = new Role();
        role.setName(name);
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setViewPermissions(new HashSet<>(view));
        role.setEditOtherPermissions(new HashSet<>(editOther));
        role.setDeleteOtherPermissions(new HashSet<>(deleteOther));
        entityManager.persist(role);
        return role;
    }

    private User persistUser(String username, Company company, Role role, boolean ownsCompany) {
        User user = new User();
        user.setFirstName(username);
        user.setLastName("Teste");
        user.setEmail(username + "@erione.test");
        user.setUsername(username);
        user.setPassword("x");
        user.setRole(role);
        user.setCompany(company);
        user.setEnabled(true);
        user.setOwnsCompany(ownsCompany);
        entityManager.persist(user);
        return user;
    }

    private User reload(User user) {
        entityManager.flush();
        entityManager.clear();
        return userRepository.findById(user.getId()).orElseThrow();
    }

    private CustomException failure(Runnable action) {
        return assertThrows(CustomException.class, action::run);
    }

    // ---- DELETE /auth (auto-exclusao de conta/empresa): existe, mas SO' para negar ----

    private void authenticateAs(User user) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                CustomUserDetail.builder().user(user).build(), "", List.of()));
    }

    // 1, 2, 3 - usuario comum, administrador e dono da empresa recebem o MESMO 403 explicito (nunca 500),
    // e nem o usuario nem a empresa sao apagados.
    @Test
    void deleteAuth_isExplicitly403_forPlainUser_admin_andCompanyOwner_andDeletesNothing() throws Exception {
        long companiesBefore = companyRepository.count();
        long usersBefore = userRepository.count();

        for (User caller : List.of(plainA, adminA, owner)) {
            authenticateAs(caller);
            authMockMvc.perform(delete("/auth"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.message").value("Account self-deletion is disabled"));
            SecurityContextHolder.clearContext();

            assertTrue(userRepository.existsById(caller.getId()), "usuario " + caller.getUsername() + " foi apagado");
            assertTrue(companyRepository.existsById(caller.getCompany().getId()));
        }

        assertEquals(companiesBefore, companyRepository.count());
        assertEquals(usersBefore, userRepository.count());
        assertTrue(companyRepository.existsById(companyA.getId())); // empresa do dono continua existindo
        assertTrue(companyRepository.existsById(companyB.getId()));
        assertTrue(userRepository.existsById(owner.getId()));
        assertTrue(userRepository.existsById(plainA.getId()));
        assertTrue(userRepository.existsById(adminA.getId()));
    }

    // Guarda estrutural: o DELETE "" do AuthController e' so' um bloqueio - nao recebe usuario/parametro
    // nenhum e o controller nao tem dependencia capaz de excluir usuario/empresa. Reintroduzir logica de
    // exclusao (que precisaria do usuario ou de CompanyService/UserRepository) quebra este teste.
    @Test
    void authController_selfDeleteMapping_isOnlyADisabledStub() {
        List<Method> deletes = Arrays.stream(AuthController.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(DeleteMapping.class))
                .collect(Collectors.toList());
        assertEquals(2, deletes.size());

        Method selfDelete = deletes.stream()
                .filter(method -> Arrays.asList(method.getAnnotation(DeleteMapping.class).value()).equals(List.of("")))
                .findFirst().orElseThrow();
        assertEquals(0, selfDelete.getParameterCount());

        Method superAdminDelete = deletes.stream()
                .filter(method -> Arrays.asList(method.getAnnotation(DeleteMapping.class).value())
                        .equals(List.of("/{username}")))
                .findFirst().orElseThrow();
        assertEquals("hasRole('ROLE_SUPER_ADMIN')", superAdminDelete.getAnnotation(PreAuthorize.class).value());

        Set<String> fieldTypes = Arrays.stream(AuthController.class.getDeclaredFields())
                .map(field -> field.getType().getSimpleName()).collect(Collectors.toSet());
        assertFalse(fieldTypes.contains("CompanyService"));
        assertFalse(fieldTypes.contains("UserRepository"));
    }

    // ---- PATCH /users/soft-delete/{id} ----

    // 4 - usuario comum nao se soft-deleta.
    @Test
    void softDelete_ownId_isForbidden_forPlainUser() {
        CustomException error = failure(() -> userController.softDelete(plainA.getId(), plainA));

        assertEquals(HttpStatus.FORBIDDEN, error.getHttpStatus());
        User unchanged = reload(plainA);
        assertTrue(unchanged.isEnabled());
        assertEquals("plain-a@erione.test", unchanged.getEmail());
    }

    // 4b - nem admin, nem dono da empresa, mesmo tendo a permissao de excluir OUTROS.
    @Test
    void softDelete_ownId_isForbidden_evenForAdminAndCompanyOwner() {
        assertEquals(HttpStatus.FORBIDDEN,
                failure(() -> userController.softDelete(adminA.getId(), adminA)).getHttpStatus());
        assertEquals(HttpStatus.FORBIDDEN,
                failure(() -> userController.softDelete(owner.getId(), owner)).getHttpStatus());

        assertTrue(reload(adminA).isEnabled());
        assertTrue(reload(owner).isEnabled());
        assertTrue(companyRepository.existsById(companyA.getId()));
    }

    // 5 - admin autorizado desativa OUTRO usuario da propria empresa (comportamento legitimo).
    @Test
    void softDelete_otherUserSameCompany_byAuthorizedAdmin_succeeds() {
        Long targetId = targetA.getId();

        userController.softDelete(targetId, adminA);

        User deleted = reload(targetA);
        assertFalse(deleted.isEnabled());
        assertFalse(deleted.isEnabledInSubscription());
        assertEquals("target-a@erione.test_" + targetId, deleted.getEmail());
        assertTrue(companyRepository.existsById(companyA.getId())); // 9 - nada de efeito colateral na empresa
    }

    // 6 - admin da empresa A nao mexe em usuario da empresa B (404, sem revelar nada) e B fica intacto.
    @Test
    void softDelete_userFromAnotherCompany_isNotFound_andUntouched() {
        CustomException error = failure(() -> userController.softDelete(targetB.getId(), adminA));

        assertEquals(HttpStatus.NOT_FOUND, error.getHttpStatus());
        User unchanged = reload(targetB);
        assertTrue(unchanged.isEnabled());
        assertEquals("target-b@erione.test", unchanged.getEmail());
        assertTrue(companyRepository.existsById(companyB.getId()));
    }

    // 7 - sem permissao administrativa, nao soft-deleta outro usuario.
    @Test
    void softDelete_otherUser_withoutAdministrativePermission_isRejected() {
        CustomException error = failure(() -> userController.softDelete(targetA.getId(), plainA));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, error.getHttpStatus());
        assertTrue(reload(targetA).isEnabled());
    }

    // Regressao da regra antiga: so' VIEW de SETTINGS NAO basta para excluir outro usuario.
    @Test
    void softDelete_otherUser_withOnlyViewSettings_isRejected() {
        CustomException error = failure(() -> userController.softDelete(targetA.getId(), viewSettingsA));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, error.getHttpStatus());
        assertTrue(reload(targetA).isEnabled());
    }

    // 8 - desativacao administrativa legitima (PATCH /users/{id}/disable) continua funcionando.
    @Test
    void disable_otherUser_byAuthorizedAdmin_stillWorks() {
        userController.disable(targetA.getId(), adminA);

        User disabled = reload(targetA);
        assertFalse(disabled.isEnabled());
        assertEquals("target-a@erione.test", disabled.getEmail()); // disable nao mexe no e-mail
        assertTrue(companyRepository.existsById(companyA.getId()));
    }

    // 9 - nenhuma das operacoes acima exclui empresa.
    @Test
    void noOperationDeletesAnyCompany() {
        long companiesBefore = companyRepository.count();

        userController.softDelete(targetA.getId(), adminA);
        userController.disable(plainA.getId(), adminA);
        failure(() -> userController.softDelete(owner.getId(), owner));
        failure(() -> userController.softDelete(targetB.getId(), adminA));

        assertEquals(companiesBefore, companyRepository.count());
    }
}
