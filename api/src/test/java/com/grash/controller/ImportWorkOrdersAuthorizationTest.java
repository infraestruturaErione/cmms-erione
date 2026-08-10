package com.grash.controller;

import com.grash.dto.imports.WorkOrderImportDTO;
import com.grash.exception.CustomException;
import com.grash.model.*;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.PlanFeatures;
import com.grash.service.AsyncImportService;
import com.grash.service.CompanyService;
import com.grash.service.IntercomService;
import com.grash.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Collections;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * POST /import/work-orders e' capacidade administrativa (import historico
 * grava WorkOrder direto, inclusive ja COMPLETE, sem passar pelo
 * WorkOrderCompletionValidator da Sprint 3B) - createPermissions.WORK_ORDERS
 * (que Technician tem por padrao, pra criar UMA OS normal pela tela) nao e' a
 * permissao certa; exige editOtherPermissions.WORK_ORDERS.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ImportWorkOrdersAuthorizationTest {

    @Mock
    private UserService userService;
    @Mock
    private AsyncImportService asyncImportService;
    @Mock
    private IntercomService intercomService;
    @Mock
    private CompanyService companyService;
    @Mock
    private HttpServletRequest req;

    @InjectMocks
    private ImportController importController;

    private User userWithPermissions(HashSet<PermissionEntity> createPermissions,
                                      HashSet<PermissionEntity> editOtherPermissions) {
        User user = new User();
        user.setId(1L);
        user.setRole(Role.builder()
                .createPermissions(createPermissions)
                .editOtherPermissions(editOtherPermissions)
                .build());

        Company company = new Company();
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setFeatures(new HashSet<>(Collections.singletonList(PlanFeatures.IMPORT_CSV)));
        Subscription subscription = new Subscription();
        subscription.setSubscriptionPlan(plan);
        company.setSubscription(subscription);
        user.setCompany(company);
        return user;
    }

    @BeforeEach
    void setUp() {
        when(userService.whoami(req)).thenReturn(null); // overridden per test
    }

    // Admin (editOtherPermissions contem WORK_ORDERS) pode importar.
    @Test
    void admin_canImportWorkOrders() {
        User admin = userWithPermissions(
                new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)),
                new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        when(userService.whoami(req)).thenReturn(admin);

        assertDoesNotThrow(() -> importController.importWorkOrders(Collections.emptyList(), req, "uuid-1"));
    }

    // Technician tem createPermissions.WORK_ORDERS (cria OS normal pela tela)
    // mas NAO tem editOtherPermissions.WORK_ORDERS - import bloqueado.
    @Test
    void technicianWithOnlyCreatePermission_cannotImportWorkOrders() {
        User technician = userWithPermissions(
                new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)),
                new HashSet<>());
        when(userService.whoami(req)).thenReturn(technician);

        CustomException ex = assertThrows(CustomException.class,
                () -> importController.importWorkOrders(Collections.emptyList(), req, "uuid-2"));
        assertTrue(ex.getMessage().contains("Access Denied"));
    }

    // Perfil customizado com editOtherPermissions.WORK_ORDERS explicito pode
    // importar, mesmo sem createPermissions.WORK_ORDERS - checagem e' por
    // permissao real, nao por combinacao especifica de perfil.
    @Test
    void customRoleWithEditOtherPermission_canImportWorkOrders() {
        User user = userWithPermissions(
                new HashSet<>(),
                new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        when(userService.whoami(req)).thenReturn(user);

        assertDoesNotThrow(() -> importController.importWorkOrders(Collections.emptyList(), req, "uuid-3"));
    }
}
