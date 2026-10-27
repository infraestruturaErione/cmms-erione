package com.grash.controller;

import com.grash.dto.SuccessResponse;
import com.grash.service.UserService;
import com.grash.service.WorkOrderPdfCacheService;
import com.grash.model.User;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkOrderPdfCacheControllerTest {
    @Test
    void individualEndpointKeepsOriginalSuccessResponseContract() throws Exception {
        var controller = Mockito.mock(WorkOrderController.class, CALLS_REAL_METHODS);
        UserService users = mock(UserService.class); var cache = mock(WorkOrderPdfCacheService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "userService", users);
        controller.setWorkOrderPdfCacheService(cache);
        var request = mock(HttpServletRequest.class); var user = new User();
        when(users.whoami(request)).thenReturn(user);
        when(cache.getPdf(10L, user)).thenReturn("https://storage.test/report.pdf?signed=renewed");
        var response = controller.getPDF(10L, request, null);
        var body = (SuccessResponse) response.getBody();
        assertEquals(200, response.getStatusCode().value()); assertTrue(body.isSuccess());
        assertEquals("https://storage.test/report.pdf?signed=renewed", body.getMessage());
        verify(cache).getPdf(10L, user);
    }
}
