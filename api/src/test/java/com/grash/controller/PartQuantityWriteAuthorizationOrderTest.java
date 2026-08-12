package com.grash.controller;

import com.grash.exception.CustomException;
import com.grash.mapper.PartQuantityMapper;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.RoleCode;
import com.grash.service.PartQuantityService;
import com.grash.service.PartService;
import com.grash.service.PurchaseOrderService;
import com.grash.service.UserService;
import com.grash.service.WorkOrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Collections;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Item 6 do pedido de correcao (2a rodada): confirma que os patches
 * anteriores nao substituiram autorizacao funcional de escrita
 * (canBeEditedBy) por so autorizacao de leitura/scope, e corrige um caso
 * real encontrado: PATCH /part-quantities/work-order/{id} mutava
 * firstTimeToReact (side effect persistido) ANTES de checar
 * canBeEditedBy - um usuario sem permissao de editar ainda causava esse
 * efeito colateral antes de receber o 403.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PartQuantityWriteAuthorizationOrderTest {

    @Mock
    private PartQuantityService partQuantityService;
    @Mock
    private PartQuantityMapper partQuantityMapper;
    @Mock
    private UserService userService;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private PartService partService;
    @Mock
    private PurchaseOrderService purchaseOrderService;
    @Mock
    private HttpServletRequest req;

    private PartQuantityController controller;
    private Company company;
    private User userWithoutEditPermission;

    @BeforeEach
    void setUp() {
        controller = new PartQuantityController(partQuantityService, partQuantityMapper, userService,
                workOrderService, partService, purchaseOrderService);
        company = new Company();
        company.setId(1L);
        userWithoutEditPermission = new User();
        userWithoutEditPermission.setId(50L);
        userWithoutEditPermission.setCompany(company);
        userWithoutEditPermission.setRole(Role.builder().code(RoleCode.REQUESTER)
                .editOtherPermissions(new HashSet<>())
                .build());
        when(userService.whoami(req)).thenReturn(userWithoutEditPermission);
    }

    // canBeEditedBy=false (nem createdBy, nem assignedTo, nem
    // editOtherPermissions) -> 403 SEM ter mutado/persistido firstTimeToReact.
    @Test
    void patchWorkOrder_deniedByCanBeEditedBy_neverMutatesFirstTimeToReact() {
        WorkOrder workOrder = new WorkOrder() {
            @Override
            public boolean canBeEditedBy(User user) {
                return false;
            }
        };
        workOrder.setId(700L);
        workOrder.setCompany(company);
        workOrder.setFirstTimeToReact(null);
        when(workOrderService.checkAccessToWorkOrderId(700L, userWithoutEditPermission)).thenReturn(workOrder);

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.patchWorkOrder(Collections.emptyList(), 700L, req));

        assertTrue(ex.getMessage().contains("Forbidden"));
        // O ponto central deste teste: sem permissao de editar, o efeito
        // colateral (setar e salvar firstTimeToReact) NUNCA pode ter
        // acontecido - nem a chamada de save.
        assertNull(workOrder.getFirstTimeToReact(),
                "firstTimeToReact nao pode ser mutado antes da autorizacao funcional");
        verify(workOrderService, never()).save(any());
    }

    // Controle positivo: canBeEditedBy=true continua funcionando e ainda
    // seta firstTimeToReact normalmente (comportamento preservado).
    @Test
    void patchWorkOrder_allowedByCanBeEditedBy_stillSetsFirstTimeToReact() {
        WorkOrder workOrder = new WorkOrder() {
            @Override
            public boolean canBeEditedBy(User user) {
                return true;
            }
        };
        workOrder.setId(701L);
        workOrder.setCompany(company);
        workOrder.setFirstTimeToReact(null);
        when(workOrderService.checkAccessToWorkOrderId(701L, userWithoutEditPermission)).thenReturn(workOrder);
        when(partQuantityService.findByWorkOrder(701L)).thenReturn(Collections.emptyList());

        assertDoesNotThrow(() -> controller.patchWorkOrder(Collections.emptyList(), 701L, req));

        assertNotNull(workOrder.getFirstTimeToReact());
        verify(workOrderService).save(workOrder);
    }
}
