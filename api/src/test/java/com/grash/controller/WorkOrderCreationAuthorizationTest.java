package com.grash.controller;

import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.WorkOrderMapper;
import com.grash.model.*;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.service.*;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * POST /work-orders e' capacidade administrativa - o tecnico so recebe OS ja
 * atribuida (Request aprovada, PM/Quartz, meter trigger), nunca cria uma
 * diretamente. createPermissions.WORK_ORDERS (que o Technician tem por
 * padrao) nao e' a permissao certa; exige editOtherPermissions.WORK_ORDERS,
 * mesma guarda de canBeAdministrativelyEditedBy e do import de OS. Cenarios
 * A-D do plano (E - tecnico atribuido continua executando a OS normalmente -
 * ja coberto exaustivamente em WorkOrderAdministrativeEditAuthorizationTest.F,
 * pois este fix nao toca canBeEditedBy).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderCreationAuthorizationTest {

    @Mock
    private UserService userService;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private WorkOrderMapper workOrderMapper;
    @Mock
    private CustomerScopeService customerScopeService;
    @Mock
    private CompanyService companyService;
    @Mock
    private IntercomService intercomService;
    @Mock
    private HttpServletRequest req;

    @InjectMocks
    private WorkOrderController workOrderController;

    private Company companyAllowingCreation() {
        Company company = new Company();
        company.setId(1L);
        company.setFirstWorkOrderCreated(true); // pula o branch do evento Intercom
        company.setCompanySettings(new CompanySettings(company));
        return company;
    }

    private User userWithRole(Long id, HashSet<PermissionEntity> editOtherPermissions) {
        User user = new User();
        user.setId(id);
        user.setCompany(companyAllowingCreation());
        user.setRole(Role.builder().editOtherPermissions(editOtherPermissions).build());
        return user;
    }

    private WorkOrderPostDTO newWorkOrderReq() {
        return new WorkOrderPostDTO(); // signature == null -> nao exige feature SIGNATURE
    }

    // A) Administrator (editOtherPermissions contem WORK_ORDERS) -> pode criar.
    @Test
    void administrator_canCreateWorkOrder() {
        User admin = userWithRole(1L, new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        WorkOrder created = new WorkOrder();
        created.setId(100L);

        when(userService.whoami(req)).thenReturn(admin);
        when(workOrderService.create(any(), any())).thenReturn(created);
        when(workOrderMapper.toShowDto(created)).thenReturn(null);

        assertDoesNotThrow(() -> workOrderController.create(newWorkOrderReq(), req));
    }

    // B) Limited Administrator (mesmo formato de editOtherPermissions que o
    // Administrator tem por padrao) -> pode criar.
    @Test
    void limitedAdministrator_canCreateWorkOrder() {
        User limitedAdmin = userWithRole(2L, new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        WorkOrder created = new WorkOrder();
        created.setId(101L);

        when(userService.whoami(req)).thenReturn(limitedAdmin);
        when(workOrderService.create(any(), any())).thenReturn(created);
        when(workOrderMapper.toShowDto(created)).thenReturn(null);

        assertDoesNotThrow(() -> workOrderController.create(newWorkOrderReq(), req));
    }

    // C) Perfil customizado (RoleCode.USER_CREATED) com WORK_ORDERS explicito
    // em editOtherPermissions -> pode criar. Checagem e' por permissao real,
    // nao pelo nome/RoleCode do perfil.
    @Test
    void customRoleWithEditOtherPermission_canCreateWorkOrder() {
        User user = new User();
        user.setId(3L);
        user.setCompany(companyAllowingCreation());
        user.setRole(Role.builder()
                .code(RoleCode.USER_CREATED)
                .name("Coordenador de Campo")
                .editOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)))
                .build());
        WorkOrder created = new WorkOrder();
        created.setId(102L);

        when(userService.whoami(req)).thenReturn(user);
        when(workOrderService.create(any(), any())).thenReturn(created);
        when(workOrderMapper.toShowDto(created)).thenReturn(null);

        assertDoesNotThrow(() -> workOrderController.create(newWorkOrderReq(), req));
    }

    // D) Technician (createPermissions.WORK_ORDERS por padrao, mas
    // editOtherPermissions vazio) -> 403, mesmo tendo createPermissions.
    @Test
    void technicianWithOnlyCreatePermission_cannotCreateWorkOrder() {
        User technician = new User();
        technician.setId(4L);
        technician.setCompany(companyAllowingCreation());
        technician.setRole(Role.builder()
                .createPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)))
                .editOtherPermissions(new HashSet<>())
                .build());

        when(userService.whoami(req)).thenReturn(technician);

        CustomException ex = assertThrows(CustomException.class,
                () -> workOrderController.create(newWorkOrderReq(), req));
        assertTrue(ex.getMessage().contains("Access denied"));
    }
}
