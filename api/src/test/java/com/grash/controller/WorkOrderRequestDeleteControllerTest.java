package com.grash.controller;

import com.grash.exception.CustomException;
import com.grash.factory.MailServiceFactory;
import com.grash.factory.StorageServiceFactory;
import com.grash.mapper.PreventiveMaintenanceMapper;
import com.grash.mapper.WorkOrderMapper;
import com.grash.model.Company;
import com.grash.model.Request;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.PermissionEntity;
import com.grash.repository.CustomerRepository;
import com.grash.repository.GeneratedReportRepository;
import com.grash.service.*;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.thymeleaf.spring5.SpringTemplateEngine;

import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkOrderRequestDeleteControllerTest {

    @Mock private WorkOrderService workOrderService;
    @Mock private WorkOrderMapper workOrderMapper;
    @Mock private UserService userService;
    @Mock private GeneratedReportRepository generatedReportRepository;
    @Mock private MessageSource messageSource;
    @Mock private AssetService assetService;
    @Mock private LocationService locationService;
    @Mock private LaborService laborService;
    @Mock private PartService partService;
    @Mock private FileService fileService;
    @Mock private PartQuantityService partQuantityService;
    @Mock private NotificationService notificationService;
    @Mock private MailServiceFactory mailServiceFactory;
    @Mock private SpringTemplateEngine thymeleafTemplateEngine;
    @Mock private StorageServiceFactory storageServiceFactory;
    @Mock private WorkflowService workflowService;
    @Mock private PreventiveMaintenanceService preventiveMaintenanceService;
    @Mock private EntityManager entityManager;
    @Mock private PreventiveMaintenanceMapper preventiveMaintenanceMapper;
    @Mock private ScheduleService scheduleService;
    @Mock private LicenseService licenseService;
    @Mock private IntercomService intercomService;
    @Mock private CompanyService companyService;
    @Mock private WorkOrderOperationalReportService workOrderOperationalReportService;
    @Mock private WorkOrderReportService workOrderReportService;
    @Mock private CustomerScopeService customerScopeService;
    @Mock private CustomerRepository customerRepository;
    @Mock private WorkOrderCompletionValidator workOrderCompletionValidator;
    @Mock private HttpServletRequest servletRequest;

    @InjectMocks private WorkOrderController controller;

    @Test
    void linkedWorkOrder_isRejectedBeforeDeleteEmailOrServiceSideEffects() {
        Company company = new Company();
        company.setId(1L);
        Role role = new Role();
        role.setDeleteOtherPermissions(new HashSet<>(
                Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        User admin = new User();
        admin.setId(1L);
        admin.setCompany(company);
        admin.setRole(role);

        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(20L);
        workOrder.setCreatedBy(2L);
        workOrder.setParentRequest(new Request());

        when(userService.whoami(servletRequest)).thenReturn(admin);
        when(workOrderService.findById(20L)).thenReturn(Optional.of(workOrder));
        doThrow(new CustomException("Archive it instead", HttpStatus.CONFLICT))
                .when(workOrderService).assertCanDelete(workOrder);

        CustomException exception = assertThrows(CustomException.class,
                () -> controller.delete(20L, servletRequest));

        assertEquals(HttpStatus.CONFLICT, exception.getHttpStatus());
        verify(mailServiceFactory, never()).getMailService();
        verify(workOrderService, never()).delete(workOrder, company);
    }
}
