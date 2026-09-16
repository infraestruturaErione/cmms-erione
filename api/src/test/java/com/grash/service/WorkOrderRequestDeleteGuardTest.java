package com.grash.service;

import com.grash.exception.CustomException;
import com.grash.factory.MailServiceFactory;
import com.grash.mapper.WorkOrderMapper;
import com.grash.model.Company;
import com.grash.model.Request;
import com.grash.model.WorkOrder;
import com.grash.model.enums.webhook.WebhookEvent;
import com.grash.repository.WorkOrderHistoryRepository;
import com.grash.repository.WorkOrderRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderRequestDeleteGuardTest {

    @Mock private WorkOrderRepository workOrderRepository;
    @Mock private WorkOrderHistoryRepository workOrderHistoryRepository;
    @Mock private LocationService locationService;
    @Mock private CustomerService customerService;
    @Mock private TeamService teamService;
    @Mock private AssetService assetService;
    @Mock private UserService userService;
    @Mock private CompanyService companyService;
    @Mock private NotificationService notificationService;
    @Mock private WorkOrderMapper workOrderMapper;
    @Mock private EntityManager entityManager;
    @Mock private MailServiceFactory mailServiceFactory;
    @Mock private WorkOrderCategoryService workOrderCategoryService;
    @Mock private TaskBaseService taskBaseService;
    @Mock private WorkOrderCompletionValidator workOrderCompletionValidator;
    @Mock private MessageSource messageSource;
    @Mock private CustomSequenceService customSequenceService;
    @Mock private LicenseService licenseService;
    @Mock private CustomFieldValueService customFieldValueService;
    @Mock private WorkflowService workflowService;
    @Mock private CustomerScopeService customerScopeService;
    @Mock private TaskService taskService;
    @Mock private WebhookDispatchService webhookDispatchService;

    @InjectMocks private WorkOrderService workOrderService;

    @BeforeEach
    void setUp() {
        workOrderService.setDeps(workflowService, customerScopeService, taskService);
        workOrderService.setWebhookDispatchService(webhookDispatchService);
    }

    @Test
    void workOrderCreatedFromRequest_cannotBeDeletedAndKeepsBothSidesLinked() {
        Company company = new Company();
        company.setId(1L);
        Request request = new Request();
        request.setId(10L);
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(20L);
        workOrder.setParentRequest(request);
        request.setWorkOrder(workOrder);

        CustomException exception = assertThrows(CustomException.class,
                () -> workOrderService.delete(workOrder, company));

        assertEquals(HttpStatus.CONFLICT, exception.getHttpStatus());
        assertSame(workOrder, request.getWorkOrder());
        assertSame(request, workOrder.getParentRequest());
        verify(workOrderRepository, never()).deleteById(any());
        verify(webhookDispatchService, never()).dispatchWebhook(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void manuallyCreatedWorkOrder_keepsExistingDeleteBehavior() {
        Company company = new Company();
        company.setId(1L);
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(30L);
        workOrder.setTitle("Manual");

        assertDoesNotThrow(() -> workOrderService.delete(workOrder, company));

        verify(workOrderRepository).deleteById(30L);
        verify(webhookDispatchService).dispatchWebhook(
                any(), any(WebhookEvent.class), any(), any(), any(), any(), any(), any(), any(), any());
    }
}
