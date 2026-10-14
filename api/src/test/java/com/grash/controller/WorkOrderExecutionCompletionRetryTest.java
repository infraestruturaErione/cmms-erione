package com.grash.controller;

import com.grash.dto.WorkOrderChangeStatusDTO;
import com.grash.dto.workOrder.WorkOrderShowDTO;
import com.grash.mapper.WorkOrderMapper;
import com.grash.model.*;
import com.grash.model.enums.Status;
import com.grash.service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class WorkOrderExecutionCompletionRetryTest {
    @Test
    void retryReturnsBeforeChangingCompletionDataOrProducingSideEffects() throws Exception {
        Map<Class<?>, Object> dependencies = new HashMap<>();
        var constructor = WorkOrderController.class.getDeclaredConstructors()[0];
        Object[] args = Arrays.stream(constructor.getParameterTypes()).map(type ->
                dependencies.computeIfAbsent(type, ignored -> mock(type))).toArray();
        WorkOrderController controller = (WorkOrderController) constructor.newInstance(args);
        WorkOrderService service = (WorkOrderService) dependencies.get(WorkOrderService.class);
        WorkOrderMapper mapper = (WorkOrderMapper) dependencies.get(WorkOrderMapper.class);
        UserService users = (UserService) dependencies.get(UserService.class);
        User operator = new User(); operator.setId(7L);
        WorkOrder wo = new WorkOrder(); wo.setId(10L); wo.setStatus(Status.COMPLETE);
        wo.setExecutionOwner(operator); wo.setCompletedBy(operator); wo.setCompletedOn(new Date(1000));
        wo.setSignature("original signature"); wo.setFeedback("original feedback"); wo.setSignerName("original signer");
        wo.setSignerDocument("original document"); wo.setMileageTraveled(11.0);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(users.whoami(request)).thenReturn(operator);
        when(service.findById(10L)).thenReturn(Optional.of(wo));
        when(mapper.toShowDto(wo)).thenReturn(new WorkOrderShowDTO());
        WorkOrderChangeStatusDTO retry = new WorkOrderChangeStatusDTO(); retry.setStatus(Status.COMPLETE);
        retry.setSignature("overwrite"); retry.setFeedback("overwrite"); retry.setSignerName("overwrite");
        retry.setSignerDocument("overwrite"); retry.setMileageTraveled(99.0);
        controller.changeStatus(retry, 10L, request);
        assertEquals(operator, wo.getCompletedBy()); assertEquals(new Date(1000), wo.getCompletedOn());
        assertEquals("original signature", wo.getSignature()); assertEquals("original feedback", wo.getFeedback());
        assertEquals("original signer", wo.getSignerName()); assertEquals("original document", wo.getSignerDocument());
        assertEquals(11.0, wo.getMileageTraveled());
        verify(service).checkOperationalAccess(10L, operator, false, true);
        verify(service, never()).saveAndFlushWithWebhook(any(), any(), any());
        verifyNoInteractions(dependencies.get(WorkflowService.class), dependencies.get(NotificationService.class),
                dependencies.get(ScheduleService.class), dependencies.get(AssetService.class));
    }
}
