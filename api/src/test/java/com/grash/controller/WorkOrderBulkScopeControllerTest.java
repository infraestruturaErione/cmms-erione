package com.grash.controller;

import com.grash.dto.SuccessResponse;
import com.grash.dto.workOrder.report.*;
import com.grash.exception.CustomException;
import com.grash.factory.StorageServiceFactory;
import com.grash.model.*;
import com.grash.model.enums.*;
import com.grash.repository.*;
import com.grash.service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring5.SpringTemplateEngine;

import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WorkOrderBulkScopeControllerTest {
    WorkOrderController controller;
    WorkOrderService orders = mock(WorkOrderService.class);
    CustomerRepository customers = mock(CustomerRepository.class);
    CustomerScopeService access = mock(CustomerScopeService.class);
    GeneratedReportRepository history = mock(GeneratedReportRepository.class);
    StorageService storage = mock(StorageService.class);
    SpringTemplateEngine templates = mock(SpringTemplateEngine.class);
    WorkOrderReportService reports = mock(WorkOrderReportService.class);
    HttpServletRequest http = mock(HttpServletRequest.class);
    User user = new User(); Customer customer = new Customer();
    @BeforeEach void setup() {
        controller = mock(WorkOrderController.class, CALLS_REAL_METHODS);
        UserService users = mock(UserService.class);
        StorageServiceFactory factory = mock(StorageServiceFactory.class);
        Map.of("workOrderService", orders, "customerRepository", customers, "customerScopeService", access,
                "generatedReportRepository", history, "userService", users, "storageServiceFactory", factory,
                "thymeleafTemplateEngine", templates, "workOrderReportService", reports)
                .forEach((name, value) -> ReflectionTestUtils.setField(controller, name, value));
        Company company = new Company(); company.setId(1L);
        company.getCompanySettings().getGeneralPreferences().setTimeZone("America/Sao_Paulo");
        user.setCompany(company); user.setRole(Role.builder().viewPermissions(Set.of(PermissionEntity.WORK_ORDERS)).build());
        customer.setId(7L); customer.setCompany(company); customer.setName("QA selected"); customer.setCnpj("123");
        when(users.whoami(http)).thenReturn(user); when(customers.findById(7L)).thenReturn(Optional.of(customer));
        when(factory.getStorageService()).thenReturn(storage);
    }
    WorkOrderBulkReportRequestDTO request(WorkOrderBulkReportScope scope) {
        var request = new WorkOrderBulkReportRequestDTO(); request.setCustomerId(7L); request.setScope(scope);
        request.setStart(LocalDate.of(2026,10,1)); request.setEnd(LocalDate.of(2026,10,31));
        if (scope == WorkOrderBulkReportScope.ALL) request.setPeriodField(WorkOrderOperationalReportPeriodField.CREATED_AT);
        return request;
    }
    @ParameterizedTest @EnumSource(WorkOrderBulkReportScope.class)
    void generatesWithSameCustomerTimezoneAndSharedPdfBuilderAndDistinctHistoryIdentity(WorkOrderBulkReportScope scope) {
        WorkOrder wo = new WorkOrder(); wo.setId(10L);
        when(orders.findCompletedByCustomersAndPeriod(anyList(), any(), any(), any(), anyLong())).thenReturn(List.of(wo));
        when(orders.findByCustomersAndPeriod(anyList(), any(), any(), any(), anyLong(), any())).thenReturn(List.of(wo));
        when(reports.buildCompanyReportVariables(user)).thenReturn(new HashMap<>());
        when(reports.buildWorkOrderReportVariables(wo, storage)).thenReturn(Map.of("workOrder", wo));
        when(templates.process(eq("work-orders-bulk-report.html"), any(Context.class))).thenReturn("QA HTML");
        when(reports.renderPdf("QA HTML")).thenReturn(new byte[]{1,2,3});
        when(storage.upload(any(), eq("reports/1"))).thenReturn("reports/1/qa.pdf");
        when(storage.generateSignedUrl("reports/1/qa.pdf", 10)).thenReturn("https://qa.test/report");
        var request = request(scope);
        var result = (SuccessResponse) controller.getBulkPDF(request, http).getBody();
        assertTrue(result.isSuccess()); assertEquals("https://qa.test/report", result.getMessage());
        Date start = Date.from(Instant.parse("2026-10-01T03:00:00Z"));
        Date end = Date.from(Instant.parse("2026-11-01T03:00:00Z"));
        if (scope == WorkOrderBulkReportScope.COMPLETED) {
            verify(orders).findCompletedByCustomersAndPeriod(List.of(7L), request.getPeriodField(), start, end, 1L);
            verify(orders, never()).findByCustomersAndPeriod(any(), any(), any(), any(), any(), any());
        } else verify(orders).findByCustomersAndPeriod(List.of(7L), request.getPeriodField(), start, end, 1L, scope);
        var captured = ArgumentCaptor.forClass(GeneratedReport.class); verify(history).save(captured.capture());
        assertTrue(captured.getValue().getDescription().startsWith(scope == WorkOrderBulkReportScope.ALL ? "BulkKeyV2" : "BulkKeyV1"));
        assertEquals(1L, captured.getValue().getCompanyId());
        assertTrue(captured.getValue().getExpiresAt().after(new Date(System.currentTimeMillis()+6L*86400000)));
        var context = ArgumentCaptor.forClass(Context.class); verify(templates).process(anyString(), context.capture());
        assertEquals(scope == WorkOrderBulkReportScope.ALL, context.getValue().getVariable("includeAllStatuses"));
        verify(access).assertCanAccessCustomer(user, customer);
    }
    @ParameterizedTest @EnumSource(WorkOrderBulkReportScope.class)
    void missingCustomerCannotGenerateOrQueryAnyOrders(WorkOrderBulkReportScope scope) {
        when(customers.findById(7L)).thenReturn(Optional.empty());
        assertThrows(CustomException.class, () -> controller.getBulkPDF(request(scope), http));
        verifyNoInteractions(orders, storage, history);
    }
    @ParameterizedTest @EnumSource(WorkOrderBulkReportScope.class)
    void rejectsCustomerFromAnotherCompany(WorkOrderBulkReportScope scope) {
        Company foreign = new Company(); foreign.setId(99L); customer.setCompany(foreign);
        assertThrows(CustomException.class, () -> controller.getBulkPDF(request(scope), http));
        verifyNoInteractions(orders, storage, history);
    }
    @ParameterizedTest @EnumSource(WorkOrderBulkReportScope.class)
    void restrictedCustomerScopeStillEnforced(WorkOrderBulkReportScope scope) {
        doThrow(new CustomException("Access denied", HttpStatus.FORBIDDEN)).when(access).assertCanAccessCustomer(user, customer);
        assertThrows(CustomException.class, () -> controller.getBulkPDF(request(scope), http));
        verifyNoInteractions(orders, storage, history);
    }
    @ParameterizedTest @EnumSource(WorkOrderBulkReportScope.class)
    void cnpjIsValidationOnlyAndNeverExpandsCustomerSelection(WorkOrderBulkReportScope scope) {
        var request = request(scope); request.setCnpj("999");
        assertThrows(CustomException.class, () -> controller.getBulkPDF(request, http));
        verifyNoInteractions(orders, storage, history);
    }
    @ParameterizedTest @EnumSource(WorkOrderBulkReportScope.class)
    void readPermissionStillRequired(WorkOrderBulkReportScope scope) {
        user.getRole().setViewPermissions(Set.of());
        assertThrows(CustomException.class, () -> controller.getBulkPDF(request(scope), http));
        verifyNoInteractions(customers, orders, storage, history);
    }
}
