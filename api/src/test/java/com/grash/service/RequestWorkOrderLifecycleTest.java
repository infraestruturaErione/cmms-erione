package com.grash.service;

import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.mapper.RequestMapper;
import com.grash.model.Company;
import com.grash.model.Request;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.repository.FieldConfigurationRepository;
import com.grash.repository.RequestRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RequestWorkOrderLifecycleTest {

    @Mock private RequestRepository requestRepository;
    @Mock private CompanyService companyService;
    @Mock private FileService fileService;
    @Mock private LocationService locationService;
    @Mock private UserService userService;
    @Mock private TeamService teamService;
    @Mock private AssetService assetService;
    @Mock private WorkOrderService workOrderService;
    @Mock private RequestMapper requestMapper;
    @Mock private EntityManager entityManager;
    @Mock private CustomSequenceService customSequenceService;
    @Mock private LicenseService licenseService;
    @Mock private RequestPortalService requestPortalService;
    @Mock private FieldConfigurationRepository fieldConfigurationRepository;
    @Mock private WebhookDispatchService webhookDispatchService;
    @Mock private CustomFieldValueService customFieldValueService;
    @Mock private CustomerScopeService customerScopeService;

    @InjectMocks private RequestService requestService;

    @Test
    void pendingRequest_becomesApprovedByKeepingBidirectionalWorkOrderLink() {
        Company company = new Company();
        company.setId(1L);
        User admin = new User();
        admin.setCompany(company);
        Request request = new Request();
        request.setId(10L);

        assertFalse(request.isCancelled());
        assertNull(request.getWorkOrder());

        WorkOrderPostDTO generatedWorkOrder = new WorkOrderPostDTO();
        generatedWorkOrder.setId(20L);
        when(workOrderService.getWorkOrderFromWorkOrderBase(request))
                .thenReturn(generatedWorkOrder);
        when(workOrderService.create(same(generatedWorkOrder), same(company)))
                .thenReturn(generatedWorkOrder);

        WorkOrder approvedWorkOrder = requestService.createWorkOrderFromRequest(request, admin);

        assertSame(generatedWorkOrder, approvedWorkOrder);
        assertSame(generatedWorkOrder, request.getWorkOrder());
        assertSame(request, approvedWorkOrder.getParentRequest());
        verify(requestRepository).save(request);
    }
}
