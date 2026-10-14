package com.grash.controller;

import com.grash.dto.WorkOrderChangeStatusDTO;
import com.grash.dto.workOrder.*;
import com.grash.exception.WorkOrderExecutionException;
import com.grash.model.*;
import com.grash.model.enums.*;
import com.grash.service.*;
import com.grash.mapper.WorkOrderMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class WorkOrderExecutionEndpointsTest {
    private final Map<Class<?>, Object> dependencies = new HashMap<>();

    private <T> T controller(Class<T> type) throws Exception {
        var constructor = type.getDeclaredConstructors()[0];
        Object[] args = Arrays.stream(constructor.getParameterTypes()).map(parameter ->
                dependencies.computeIfAbsent(parameter, ignored -> mock(parameter))).toArray();
        return type.cast(constructor.newInstance(args));
    }

    @Test
    void directFileRenameAndDeleteCannotBypassFieldEvidenceOwnership() throws Exception {
        FileController controller = controller(FileController.class);
        User companion = new User(); companion.setId(3L); companion.setRole(new Role());
        User owner = new User(); owner.setId(2L); owner.setFirstName("Fabricio"); owner.setLastName("Souza");
        WorkOrder wo = new WorkOrder(); wo.setId(10L); wo.setExecutionOwner(owner);
        Comment evidence = new Comment(); evidence.setWorkOrder(wo); evidence.setContent("[Relato em campo] evidence");
        com.grash.model.File file = new com.grash.model.File(); file.setId(9L); file.setName("original photo"); file.setCreatedBy(3L);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(((UserService) dependencies.get(UserService.class)).whoami(request)).thenReturn(companion);
        FileService files = (FileService) dependencies.get(FileService.class);
        when(files.findById(9L)).thenReturn(Optional.of(file));
        when(((com.grash.repository.CommentRepository) dependencies.get(com.grash.repository.CommentRepository.class))
                .findByFiles_IdAndContentStartingWith(9L, "[Relato em campo]")).thenReturn(List.of(evidence));
        doThrow(new WorkOrderExecutionException("WORK_ORDER_ALREADY_IN_EXECUTION", wo))
                .when((WorkOrderService) dependencies.get(WorkOrderService.class)).checkOperationalWriteAccess(10L, companion);
        com.grash.dto.FilePatchDTO patch = new com.grash.dto.FilePatchDTO(); patch.setName("overwrite");
        assertThrows(WorkOrderExecutionException.class, () -> controller.patch(patch, 9L, request));
        assertThrows(WorkOrderExecutionException.class, () -> controller.delete(9L, request));
        assertEquals("original photo", file.getName());
        verify(files, never()).delete(anyLong()); verify(files, never()).update(any());
    }

    @Test
    void staleCompanionCannotDepartCheckInCheckOutChangeStatusOrAddOperationalFiles() throws Exception {
        WorkOrderController controller = controller(WorkOrderController.class);
        WorkOrderService service = (WorkOrderService) dependencies.get(WorkOrderService.class);
        User companion = new User(); companion.setId(3L); companion.setRole(new Role());
        User owner = new User(); owner.setId(2L); owner.setFirstName("Fabricio"); owner.setLastName("Souza");
        WorkOrder wo = new WorkOrder(); wo.setId(10L); wo.setExecutionOwner(owner);
        wo.setAssignedTo(List.of(owner, companion));
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(((UserService) dependencies.get(UserService.class)).whoami(request)).thenReturn(companion);
        when(service.checkAccessToWorkOrderId(10L, companion)).thenReturn(wo);
        WorkOrderExecutionException conflict = new WorkOrderExecutionException("WORK_ORDER_ALREADY_IN_EXECUTION", wo);
        doThrow(conflict).when(service).checkOperationalAccess(eq(10L), eq(companion), anyBoolean(), anyBoolean());
        doThrow(conflict).when(service).checkOperationalWriteAccess(10L, companion);
        WorkOrderChangeStatusDTO status = new WorkOrderChangeStatusDTO(); status.setStatus(Status.IN_PROGRESS);
        assertThrows(WorkOrderExecutionException.class, () -> controller.depart(new WorkOrderDepartDTO(), 10L, request));
        assertThrows(WorkOrderExecutionException.class, () -> controller.checkIn(new WorkOrderCheckInDTO(), 10L, request));
        assertThrows(WorkOrderExecutionException.class, () -> controller.checkOut(new WorkOrderCheckOutDTO(), 10L, request));
        assertThrows(WorkOrderExecutionException.class, () -> controller.changeStatus(status, 10L, request));
        assertThrows(WorkOrderExecutionException.class, () -> controller.addFilesToWorkOrder(10L, List.of(), request));
        assertNull(wo.getDepartureAt()); assertNull(wo.getCheckInAt()); assertNull(wo.getCheckOutAt());
        assertEquals(owner, wo.getExecutionOwner());
        verify(service, never()).saveAndFlushWithWebhook(any(), any(), any());
    }

    @Test
    void operatorCanUseTheExistingDepartureCheckInAndCheckOutFlow() throws Exception {
        WorkOrderController controller = controller(WorkOrderController.class);
        WorkOrderService service = (WorkOrderService) dependencies.get(WorkOrderService.class);
        User owner = new User(); owner.setId(2L); owner.setRole(new Role()); owner.setCompany(new Company());
        WorkOrder wo = new WorkOrder(); wo.setId(10L); wo.setExecutionOwner(owner); wo.setAssignedTo(List.of(owner));
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(((UserService) dependencies.get(UserService.class)).whoami(request)).thenReturn(owner);
        when(service.findById(10L)).thenReturn(Optional.of(wo));
        when(service.saveAndFlushWithWebhook(eq(wo), any(), any())).thenReturn(wo);
        when(((WorkOrderMapper) dependencies.get(WorkOrderMapper.class)).toShowDto(wo)).thenReturn(new WorkOrderShowDTO());
        controller.depart(new WorkOrderDepartDTO(), 10L, request);
        controller.checkIn(new WorkOrderCheckInDTO(), 10L, request);
        controller.checkOut(new WorkOrderCheckOutDTO(), 10L, request);
        assertNotNull(wo.getDepartureAt()); assertNotNull(wo.getCheckInAt()); assertNotNull(wo.getCheckOutAt());
        verify(service, times(2)).checkOperationalAccess(10L, owner, true, false);
        verify(service).checkOperationalWriteAccess(10L, owner);
    }
}
