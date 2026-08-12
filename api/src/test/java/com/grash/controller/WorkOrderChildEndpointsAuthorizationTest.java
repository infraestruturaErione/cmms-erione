package com.grash.controller;

import com.grash.dto.AdditionalCostPatchDTO;
import com.grash.dto.RelationPostDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.PartQuantityMapper;
import com.grash.mapper.WorkOrderHistoryMapper;
import com.grash.model.*;
import com.grash.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Item 3/4/5 do pedido de correcao: os 5 endpoints filhos de WorkOrder
 * (history/additional-cost/labor/part-quantity/relation) nao reaplicavam
 * customer scope - qualquer um bastava saber o ID da WorkOrder de outro
 * cliente. Aqui workOrderService.checkAccessToWorkOrderId e' mockado pra
 * simular tanto o caso permitido quanto o bloqueado, provando que cada
 * controller agora DELEGA pra ele antes de tocar em qualquer dado -
 * mesmo padrao usado em TaskDeleteAdministrativeAccessTest.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderChildEndpointsAuthorizationTest {

    @Mock
    private UserService userService;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private HttpServletRequest req;

    private User user;
    private WorkOrder workOrder;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setId(1L);
        user = new User();
        user.setId(10L);
        user.setCompany(company);
        workOrder = new WorkOrder();
        workOrder.setId(200L);
        workOrder.setCompany(company);
        when(userService.whoami(req)).thenReturn(user);
    }

    // --- WorkOrderHistoryController ---

    @Test
    void workOrderHistory_getByWorkOrder_deniedWhenParentWorkOrderOutOfScope() {
        WorkOrderHistoryService workOrderHistoryService = org.mockito.Mockito.mock(WorkOrderHistoryService.class);
        WorkOrderHistoryMapper workOrderHistoryMapper = org.mockito.Mockito.mock(WorkOrderHistoryMapper.class);
        WorkOrderHistoryController controller = new WorkOrderHistoryController(workOrderHistoryService, userService,
                workOrderService, workOrderHistoryMapper);

        when(workOrderService.checkAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.getByWorkOrder(200L, req));
    }

    @Test
    void workOrderHistory_getByWorkOrder_allowedWhenParentWorkOrderInScope() {
        WorkOrderHistoryService workOrderHistoryService = org.mockito.Mockito.mock(WorkOrderHistoryService.class);
        WorkOrderHistoryMapper workOrderHistoryMapper = org.mockito.Mockito.mock(WorkOrderHistoryMapper.class);
        WorkOrderHistoryController controller = new WorkOrderHistoryController(workOrderHistoryService, userService,
                workOrderService, workOrderHistoryMapper);

        when(workOrderService.checkAccessToWorkOrderId(200L, user)).thenReturn(workOrder);
        when(workOrderHistoryService.findByWorkOrder(200L)).thenReturn(Collections.emptyList());

        assertDoesNotThrow(() -> controller.getByWorkOrder(200L, req));
    }

    // --- AdditionalCostController ---

    @Test
    void additionalCost_getByWorkOrder_deniedWhenParentWorkOrderOutOfScope() {
        AdditionalCostService additionalCostService = org.mockito.Mockito.mock(AdditionalCostService.class);
        AdditionalCostController controller = new AdditionalCostController(additionalCostService, userService,
                workOrderService);

        when(workOrderService.checkAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.getByWorkOrder(200L, req));
    }

    @Test
    void additionalCost_patch_deniedWhenParentWorkOrderOutOfScope() {
        AdditionalCostService additionalCostService = org.mockito.Mockito.mock(AdditionalCostService.class);
        AdditionalCostController controller = new AdditionalCostController(additionalCostService, userService,
                workOrderService);
        AdditionalCost additionalCost = new AdditionalCost();
        additionalCost.setId(300L);
        additionalCost.setWorkOrder(workOrder);
        when(additionalCostService.findById(300L)).thenReturn(Optional.of(additionalCost));
        // patch() e' um WRITE - checkWriteAccessToWorkOrderId, nao checkAccessToWorkOrderId.
        when(workOrderService.checkWriteAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class,
                () -> controller.patch(new AdditionalCostPatchDTO(), 300L, req));
    }

    // --- LaborController ---

    @Test
    void labor_getByWorkOrder_deniedWhenParentWorkOrderOutOfScope() {
        LaborService laborService = org.mockito.Mockito.mock(LaborService.class);
        LaborController controller = new LaborController(laborService, userService, workOrderService);

        when(workOrderService.checkAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.getByWorkOrder(200L, req));
    }

    @Test
    void labor_getById_deniedWhenParentWorkOrderOutOfScope() {
        LaborService laborService = org.mockito.Mockito.mock(LaborService.class);
        LaborController controller = new LaborController(laborService, userService, workOrderService);
        Labor labor = new Labor();
        labor.setId(400L);
        labor.setWorkOrder(workOrder);
        when(laborService.findById(400L)).thenReturn(Optional.of(labor));
        when(workOrderService.checkAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.getById(400L, req));
    }

    @Test
    void labor_getById_allowedWhenParentWorkOrderInScope() {
        LaborService laborService = org.mockito.Mockito.mock(LaborService.class);
        LaborController controller = new LaborController(laborService, userService, workOrderService);
        Labor labor = new Labor();
        labor.setId(401L);
        labor.setWorkOrder(workOrder);
        when(laborService.findById(401L)).thenReturn(Optional.of(labor));
        when(workOrderService.checkAccessToWorkOrderId(200L, user)).thenReturn(workOrder);

        assertDoesNotThrow(() -> controller.getById(401L, req));
    }

    // --- PartQuantityController ---

    @Test
    void partQuantity_getByWorkOrder_deniedWhenParentWorkOrderOutOfScope() {
        PartQuantityService partQuantityService = org.mockito.Mockito.mock(PartQuantityService.class);
        PartQuantityMapper partQuantityMapper = org.mockito.Mockito.mock(PartQuantityMapper.class);
        PartService partService = org.mockito.Mockito.mock(PartService.class);
        PurchaseOrderService purchaseOrderService = org.mockito.Mockito.mock(PurchaseOrderService.class);
        PartQuantityController controller = new PartQuantityController(partQuantityService, partQuantityMapper,
                userService, workOrderService, partService, purchaseOrderService);

        when(workOrderService.checkAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.getByWorkOrder(req, 200L));
    }

    @Test
    void partQuantity_getById_deniedWhenParentWorkOrderOutOfScope() {
        PartQuantityService partQuantityService = org.mockito.Mockito.mock(PartQuantityService.class);
        PartQuantityMapper partQuantityMapper = org.mockito.Mockito.mock(PartQuantityMapper.class);
        PartService partService = org.mockito.Mockito.mock(PartService.class);
        PurchaseOrderService purchaseOrderService = org.mockito.Mockito.mock(PurchaseOrderService.class);
        PartQuantityController controller = new PartQuantityController(partQuantityService, partQuantityMapper,
                userService, workOrderService, partService, purchaseOrderService);
        PartQuantity partQuantity = new PartQuantity();
        partQuantity.setId(500L);
        partQuantity.setWorkOrder(workOrder);
        when(partQuantityService.findById(500L)).thenReturn(Optional.of(partQuantity));
        when(workOrderService.checkAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.getById(500L, req));
    }

    // --- RelationController ---

    @Test
    void relation_getByWorkOrder_deniedWhenParentWorkOrderOutOfScope() {
        RelationService relationService = org.mockito.Mockito.mock(RelationService.class);
        RelationController controller = new RelationController(relationService, userService, workOrderService,
                org.mockito.Mockito.mock(com.grash.service.CustomerScopeService.class));

        when(workOrderService.checkAccessToWorkOrderId(200L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.getByWorkOrder(200L, req));
    }

    // Relation liga DUAS WorkOrders (parent/child) - mesmo se o usuario
    // acessa o parent, se o child estiver fora do escopo a criacao deve
    // ser negada (senao ele descobriria/vincularia a WO B mesmo assim).
    @Test
    void relation_create_deniedWhenChildWorkOrderOutOfScope_evenIfParentInScope() {
        RelationService relationService = org.mockito.Mockito.mock(RelationService.class);
        RelationController controller = new RelationController(relationService, userService, workOrderService,
                org.mockito.Mockito.mock(com.grash.service.CustomerScopeService.class));

        WorkOrder parent = new WorkOrder();
        parent.setId(200L);
        WorkOrder child = new WorkOrder();
        child.setId(999L);
        RelationPostDTO relationReq = new RelationPostDTO();
        relationReq.setParent(parent);
        relationReq.setChild(child);

        // create() e' um WRITE - checkWriteAccessToWorkOrderId, nao checkAccessToWorkOrderId.
        when(workOrderService.checkWriteAccessToWorkOrderId(200L, user)).thenReturn(parent);
        when(workOrderService.checkWriteAccessToWorkOrderId(999L, user))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        assertThrows(CustomException.class, () -> controller.create(relationReq, req));
    }

    @Test
    void relation_create_allowedWhenBothWorkOrdersInScope() {
        RelationService relationService = org.mockito.Mockito.mock(RelationService.class);
        RelationController controller = new RelationController(relationService, userService, workOrderService,
                org.mockito.Mockito.mock(com.grash.service.CustomerScopeService.class));

        WorkOrder parent = new WorkOrder();
        parent.setId(200L);
        WorkOrder child = new WorkOrder();
        child.setId(201L);
        RelationPostDTO relationReq = new RelationPostDTO();
        relationReq.setParent(parent);
        relationReq.setChild(child);

        when(workOrderService.checkWriteAccessToWorkOrderId(200L, user)).thenReturn(parent);
        when(workOrderService.checkWriteAccessToWorkOrderId(201L, user)).thenReturn(child);
        when(relationService.findByParentAndChild(any(), any())).thenReturn(Collections.emptyList());
        when(relationService.createPost(any(), any())).thenReturn(new Relation());

        assertDoesNotThrow(() -> controller.create(relationReq, req));
    }
}
