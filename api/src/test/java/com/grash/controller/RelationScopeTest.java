package com.grash.controller;

import com.grash.dto.RelationPatchDTO;
import com.grash.dto.RelationPostDTO;
import com.grash.exception.CustomException;
import com.grash.model.Company;
import com.grash.model.Relation;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.service.CustomerScopeService;
import com.grash.service.RelationService;
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

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Item 3 do pedido de correcao (2a rodada): Relation expoe os DOIS lados
 * (parent/child) como WorkOrder completo - leitura precisa filtrar quando
 * o outro lado esta fora do escopo, e PATCH mudando parent/child precisa
 * validar os NOVOS valores, nao so os antigos.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RelationScopeTest {

    @Mock
    private RelationService relationService;
    @Mock
    private UserService userService;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private CustomerScopeService customerScopeService;
    @Mock
    private HttpServletRequest req;

    private RelationController controller;
    private Company company;
    private User requester;

    @BeforeEach
    void setUp() {
        controller = new RelationController(relationService, userService, workOrderService, customerScopeService);
        company = new Company();
        company.setId(1L);
        requester = new User();
        requester.setId(152L);
        requester.setCompany(company);
        requester.setRole(Role.builder().code(RoleCode.REQUESTER).build());
        when(userService.whoami(req)).thenReturn(requester);
        when(customerScopeService.isRequester(requester)).thenReturn(true);
    }

    private WorkOrder workOrderOf(Long id, boolean accessibleToRequester) {
        WorkOrder workOrder = new WorkOrder() {
            @Override
            public boolean isAccessibleBy(User user) {
                return true;
            }
        };
        workOrder.setId(id);
        workOrder.setCompany(company);
        when(customerScopeService.canAccessWorkOrderBase(requester, workOrder)).thenReturn(accessibleToRequester);
        return workOrder;
    }

    // getAll: uma Relation cujo outro lado (child) e' de fora do escopo NAO
    // pode aparecer na lista - vazaria titulo/dados dessa WO so por estar
    // referenciada.
    @Test
    void getAll_filtersOutRelationsWhereEitherSideIsOutOfScope() {
        WorkOrder accessibleParent = workOrderOf(100L, true);
        WorkOrder outOfScopeChild = workOrderOf(200L, false);
        Relation leaking = new Relation();
        leaking.setParent(accessibleParent);
        leaking.setChild(outOfScopeChild);

        WorkOrder accessibleChild = workOrderOf(101L, true);
        Relation legit = new Relation();
        legit.setParent(accessibleParent);
        legit.setChild(accessibleChild);

        when(relationService.findByCompany(1L)).thenReturn(Arrays.asList(leaking, legit));

        Collection<Relation> result = controller.getAll(req);

        assertEquals(1, result.size());
        assertTrue(result.contains(legit));
        assertFalse(result.contains(leaking), "Relation com o child fora do escopo nao pode vazar");
    }

    // getByWorkOrder: o check de acesso ao ID da URL nao cobre o OUTRO lado
    // da Relation.
    @Test
    void getByWorkOrder_filtersOutRelationsWhereOtherSideIsOutOfScope() {
        WorkOrder requested = workOrderOf(100L, true);
        WorkOrder outOfScopeOtherSide = workOrderOf(999L, false);
        Relation leaking = new Relation();
        leaking.setParent(requested);
        leaking.setChild(outOfScopeOtherSide);

        when(relationService.findByWorkOrder(100L)).thenReturn(Collections.singletonList(leaking));

        Collection<Relation> result = controller.getByWorkOrder(100L, req);

        assertTrue(result.isEmpty());
        verify(workOrderService).checkAccessToWorkOrderId(100L, requester);
    }

    // Admin (nao-Requester): getAll continua sem filtro adicional -
    // comportamento preservado.
    @Test
    void getAll_admin_isNotFiltered() {
        User admin = new User();
        admin.setId(1L);
        admin.setCompany(company);
        admin.setRole(Role.builder().code(RoleCode.ADMIN).build());
        when(userService.whoami(req)).thenReturn(admin);
        when(customerScopeService.isRequester(admin)).thenReturn(false);

        Relation anyRelation = new Relation();
        WorkOrder parent = new WorkOrder();
        parent.setId(1L);
        WorkOrder child = new WorkOrder();
        child.setId(2L);
        anyRelation.setParent(parent);
        anyRelation.setChild(child);
        when(relationService.findByCompany(1L)).thenReturn(Collections.singletonList(anyRelation));

        Collection<Relation> result = controller.getAll(req);

        assertEquals(1, result.size());
    }

    // PATCH mudando child pra uma WO fora do escopo - precisa validar o
    // NOVO child, nao so o antigo (savedRelation).
    @Test
    void patch_deniedWhenNewChildIsOutOfScope() {
        WorkOrder oldParent = new WorkOrder();
        oldParent.setId(100L);
        WorkOrder oldChild = new WorkOrder();
        oldChild.setId(101L);
        Relation savedRelation = new Relation();
        savedRelation.setId(300L);
        savedRelation.setParent(oldParent);
        savedRelation.setChild(oldChild);
        when(relationService.findById(300L)).thenReturn(Optional.of(savedRelation));
        // patch() e' um WRITE - checkWriteAccessToWorkOrderId, nao checkAccessToWorkOrderId
        // (checkWriteAccessToWorkOrderId retorna a WorkOrder, nao e' void - doNothing() nao se aplica aqui)
        when(workOrderService.checkWriteAccessToWorkOrderId(100L, requester)).thenReturn(oldParent);
        when(workOrderService.checkWriteAccessToWorkOrderId(101L, requester)).thenReturn(oldChild);
        // new child (999) is out of scope
        when(workOrderService.checkWriteAccessToWorkOrderId(999L, requester))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        WorkOrder newChild = new WorkOrder();
        newChild.setId(999L);
        RelationPatchDTO patchDTO = new RelationPatchDTO();
        patchDTO.setChild(newChild);

        assertThrows(CustomException.class, () -> controller.patch(patchDTO, 300L, req));
        verify(relationService, never()).update(any(), any());
    }

    // Controle positivo: PATCH trocando child pra uma WO DENTRO do escopo
    // continua funcionando.
    @Test
    void patch_allowedWhenNewChildIsInScope() {
        WorkOrder oldParent = new WorkOrder();
        oldParent.setId(100L);
        WorkOrder oldChild = new WorkOrder();
        oldChild.setId(101L);
        Relation savedRelation = new Relation();
        savedRelation.setId(301L);
        savedRelation.setParent(oldParent);
        savedRelation.setChild(oldChild);
        when(relationService.findById(301L)).thenReturn(Optional.of(savedRelation));
        when(relationService.update(eq(301L), any())).thenReturn(savedRelation);

        WorkOrder newChild = new WorkOrder();
        newChild.setId(102L);
        RelationPatchDTO patchDTO = new RelationPatchDTO();
        patchDTO.setChild(newChild);

        assertDoesNotThrow(() -> controller.patch(patchDTO, 301L, req));
        verify(workOrderService).checkWriteAccessToWorkOrderId(102L, requester);
        verify(relationService).update(eq(301L), any());
    }

    // create: ja coberto na 1a rodada (WorkOrderChildEndpointsAuthorizationTest)
    // - continua validando os dois lados do payload, sem regressao.
    @Test
    void create_stillValidatesBothSides() {
        WorkOrder parent = new WorkOrder();
        parent.setId(100L);
        WorkOrder child = new WorkOrder();
        child.setId(999L);
        when(workOrderService.checkWriteAccessToWorkOrderId(100L, requester)).thenReturn(parent);
        when(workOrderService.checkWriteAccessToWorkOrderId(999L, requester))
                .thenThrow(new CustomException("Access denied", org.springframework.http.HttpStatus.FORBIDDEN));

        RelationPostDTO relationReq = new RelationPostDTO();
        relationReq.setParent(parent);
        relationReq.setChild(child);

        assertThrows(CustomException.class, () -> controller.create(relationReq, req));
    }
}
