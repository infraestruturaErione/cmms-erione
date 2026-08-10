package com.grash.controller;

import com.grash.exception.CustomException;
import com.grash.model.*;
import com.grash.model.enums.PermissionEntity;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * DELETE /tasks/{id} e alteracao ESTRUTURAL da OS (remove item do
 * questionario) - diferente de PATCH /tasks/{id} (resposta operacional).
 * Cenarios A/D/E/F/G do plano (B/C ja cobertos exaustivamente em
 * WorkOrderAdministrativeEditAuthorizationTest, pois usam o mesmo
 * WorkOrder.canBeAdministrativelyEditedBy).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TaskDeleteAdministrativeAccessTest {

    @Mock
    private TaskService taskService;
    @Mock
    private UserService userService;
    @Mock
    private TaskBaseService taskBaseService;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private WorkflowService workflowService;
    @Mock
    private com.grash.mapper.TaskMapper taskMapper;
    @Mock
    private PreventiveMaintenanceService preventiveMaintenanceService;
    @Mock
    private HttpServletRequest req;

    @InjectMocks
    private TaskController taskController;

    private Company company;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(1L);
    }

    private User userWithRole(Long id, HashSet<PermissionEntity> editOtherPermissions) {
        User user = new User();
        user.setId(id);
        user.setCompany(company);
        user.setRole(Role.builder().editOtherPermissions(editOtherPermissions).build());
        return user;
    }

    private Task taskOfWorkOrder(Long taskId, WorkOrder workOrder) {
        Task task = new Task();
        task.setId(taskId);
        task.setWorkOrder(workOrder);
        return task;
    }

    // A) Admin com WORK_ORDERS consegue DELETE Task da WorkOrder.
    @Test
    void admin_canDeleteWorkOrderTask() {
        User admin = userWithRole(1L, new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(200L);
        workOrder.setCreatedBy(999L);
        Task task = taskOfWorkOrder(100L, workOrder);

        when(userService.whoami(req)).thenReturn(admin);
        when(taskService.findById(100L)).thenReturn(Optional.of(task));
        when(workOrderService.checkAccessToWorkOrderId(anyLong(), any())).thenReturn(workOrder);

        assertDoesNotThrow(() -> taskController.delete(100L, req));
    }

    // D) Technician atribuido NAO pode DELETE Task da WorkOrder.
    @Test
    void assignedTechnician_cannotDeleteWorkOrderTask() {
        User technician = userWithRole(2L, new HashSet<>());
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(201L);
        workOrder.setCreatedBy(999L);
        workOrder.setAssignedTo(Collections.singletonList(technician));
        Task task = taskOfWorkOrder(101L, workOrder);

        when(userService.whoami(req)).thenReturn(technician);
        when(taskService.findById(101L)).thenReturn(Optional.of(task));
        when(workOrderService.checkAccessToWorkOrderId(anyLong(), any())).thenReturn(workOrder);

        CustomException ex = assertThrows(CustomException.class, () -> taskController.delete(101L, req));
        assertTrue(ex.getMessage().contains("Access denied"));
    }

    // E) Technician criador da WorkOrder tambem NAO pode DELETE.
    @Test
    void creatorTechnician_cannotDeleteWorkOrderTask() {
        User technician = userWithRole(3L, new HashSet<>());
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(202L);
        workOrder.setCreatedBy(3L);
        Task task = taskOfWorkOrder(102L, workOrder);

        when(userService.whoami(req)).thenReturn(technician);
        when(taskService.findById(102L)).thenReturn(Optional.of(task));
        when(workOrderService.checkAccessToWorkOrderId(anyLong(), any())).thenReturn(workOrder);

        assertThrows(CustomException.class, () -> taskController.delete(102L, req));
    }

    // F) Technician continua podendo PATCH /tasks/{id} para responder - o
    // fix desta correcao nao toca checkTaskAccess/patch(), so o DELETE.
    @Test
    void assignedTechnician_canStillPatchTaskToAnswer() {
        User technician = userWithRole(4L, new HashSet<>());
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(203L);
        workOrder.setCreatedBy(999L);
        workOrder.setAssignedTo(Collections.singletonList(technician));
        Task task = taskOfWorkOrder(103L, workOrder);

        com.grash.dto.TaskPatchDTO patchDTO = new com.grash.dto.TaskPatchDTO();

        when(userService.whoami(req)).thenReturn(technician);
        when(taskService.findById(103L)).thenReturn(Optional.of(task));
        when(workOrderService.checkAccessToWorkOrderId(anyLong(), any())).thenReturn(workOrder);
        when(taskService.update(103L, patchDTO)).thenReturn(task);
        when(workflowService.findByMainConditionAndCompany(any(), anyLong())).thenReturn(Collections.emptyList());

        assertDoesNotThrow(() -> taskController.patch(patchDTO, 103L, req));
    }

    // G) Task de PreventiveMaintenance permanece com a regra atual
    // (PreventiveMaintenance.canBeEditedBy), NAO usa
    // WorkOrder.canBeAdministrativelyEditedBy - o fix e so sobre WorkOrder.
    @Test
    void preventiveMaintenanceTaskDelete_usesItsOwnRule_unaffectedByFix() {
        User pmCreator = userWithRole(5L, new HashSet<>());
        PreventiveMaintenance pm = new PreventiveMaintenance();
        pm.setCreatedBy(5L); // PM criada por este usuario -> PreventiveMaintenance.canBeEditedBy = true

        Task task = new Task();
        task.setId(104L);
        task.setCompany(company);
        task.setPreventiveMaintenance(pm);
        // task.getWorkOrder() == null de proposito

        when(userService.whoami(req)).thenReturn(pmCreator);
        when(taskService.findById(104L)).thenReturn(Optional.of(task));

        // Criador da PM continua podendo deletar a Task dela - regra da PM
        // preservada, nao "endurecida" pela correcao de WorkOrder.
        assertDoesNotThrow(() -> taskController.delete(104L, req));
    }
}
