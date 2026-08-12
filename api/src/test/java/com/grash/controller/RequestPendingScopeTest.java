package com.grash.controller;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.RequestShowDTO;
import com.grash.dto.SuccessResponse;
import com.grash.factory.MailServiceFactory;
import com.grash.mapper.RequestMapper;
import com.grash.mapper.WorkOrderMapper;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.RoleType;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import com.grash.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.Page;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Collections;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Item 8 do pedido de correcao: /requests/pending usava
 * requestService.countPending(companyId) (Company inteira, sem customer
 * scope nem filterCreatedBy) - divergia de /requests/search. Agora os dois
 * endpoints passam pelo MESMO applyVisibleRequestsScope, testado aqui via
 * captura do SearchCriteria efetivamente enviado a findBySearchCriteria.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RequestPendingScopeTest {

    @Mock
    private RequestService requestService;
    @Mock
    private UserService userService;
    @Mock
    private WorkOrderMapper workOrderMapper;
    @Mock
    private RequestMapper requestMapper;
    @Mock
    private NotificationService notificationService;
    @Mock
    private MessageSource messageSource;
    @Mock
    private WorkflowService workflowService;
    @Mock
    private MailServiceFactory mailServiceFactory;
    @Mock
    private AssetService assetService;
    @Mock
    private RequestPortalService requestPortalService;
    @Mock
    private WebhookDispatchService webhookDispatchService;
    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private LocationRepository locationRepository;
    @Mock
    private AssetRepository assetRepository;
    @Mock
    private HttpServletRequest req;
    @Mock
    private Page<RequestShowDTO> page;

    private CustomerScopeService customerScopeService;
    private RequestController controller;
    private Company company;

    @BeforeEach
    void setUp() {
        customerScopeService = new CustomerScopeService(customerRepository, locationRepository, assetRepository);
        controller = new RequestController(requestService, userService, workOrderMapper, requestMapper,
                notificationService, messageSource, workflowService, mailServiceFactory, assetService,
                requestPortalService, webhookDispatchService, customerScopeService);
        company = new Company();
        company.setId(1L);
    }

    private User requesterAllowedTo(Long customerId) {
        User user = new User();
        user.setId(10L);
        user.setCompany(company);
        Role role = Role.builder()
                .code(RoleCode.REQUESTER)
                .roleType(RoleType.ROLE_CLIENT)
                .viewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .viewOtherPermissions(new HashSet<>())
                .build();
        user.setRole(role);
        com.grash.model.Customer customer = new com.grash.model.Customer();
        customer.setId(customerId);
        user.setAllowedCustomers(new java.util.ArrayList<>(Collections.singletonList(customer)));
        return user;
    }

    // O contador de pending do Requester NUNCA mais deve chamar o
    // countPending(companyId) puro - so o mesmo caminho scoped de /search.
    @Test
    void pending_requester_neverCallsRawCountPending() {
        User requesterA = requesterAllowedTo(1L);
        when(userService.whoami(req)).thenReturn(requesterA);
        when(page.getTotalElements()).thenReturn(3L);
        when(requestService.findBySearchCriteria(any(), any())).thenReturn(page);

        SuccessResponse response = controller.getPending(req);

        verify(requestService, never()).countPending(anyLong());
        verify(requestService).findBySearchCriteria(any(), any());
        assertEquals("3", response.getMessage());
    }

    // O SearchCriteria efetivamente usado precisa levar: company, createdBy
    // e status=PENDING - o mesmo recorte de /search. Customer Scope do
    // Requester NAO aparece mais aqui como FilterField (correcao estrutural
    // da 3a rodada) - e' aplicado como Specification dedicada, sempre
    // ANDada, DENTRO de requestService.findBySearchCriteria(criteria, user)
    // - ver CustomerScopeService.customerScopeSpecification. O 2o argumento
    // (user) e' o que carrega o escopo agora, nao mais um FilterField
    // manipulavel dentro da arvore de alternatives do usuario.
    @Test
    void pending_requester_criteriaIncludesCompanyAndCreatedBy_userCarriesCustomerScope() {
        User requesterA = requesterAllowedTo(1L);
        when(userService.whoami(req)).thenReturn(requesterA);
        when(page.getTotalElements()).thenReturn(0L);
        when(requestService.findBySearchCriteria(any(), any())).thenReturn(page);

        controller.getPending(req);

        ArgumentCaptor<SearchCriteria> criteriaCaptor = ArgumentCaptor.forClass(SearchCriteria.class);
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(requestService).findBySearchCriteria(criteriaCaptor.capture(), userCaptor.capture());
        SearchCriteria used = criteriaCaptor.getValue();

        assertTrue(used.getFilterFields().stream().anyMatch(f -> f.getField().equals("company")));
        assertTrue(used.getFilterFields().stream().noneMatch(f -> f.getField().equals("customers")),
                "Customer Scope nao pode mais viajar como FilterField manipulavel pelo usuario");
        assertTrue(used.getFilterFields().stream().anyMatch(f -> f.getField().equals("createdBy")));
        assertTrue(used.getFilterFields().stream().anyMatch(f -> f.getField().equals("status")
                && f.getValues().contains("PENDING")));
        assertEquals(requesterA, userCaptor.getValue());
    }

    // Admin (viewOther) NAO deve levar filterCreatedBy - continua vendo o
    // total administrativo, so sem customer scope de Requester.
    @Test
    void pending_adminWithViewOther_criteriaHasNoCreatedByFilter() {
        User admin = new User();
        admin.setId(99L);
        admin.setCompany(company);
        Role adminRole = Role.builder()
                .code(RoleCode.ADMIN)
                .roleType(RoleType.ROLE_CLIENT)
                .viewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .viewOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .build();
        admin.setRole(adminRole);
        when(userService.whoami(req)).thenReturn(admin);
        when(page.getTotalElements()).thenReturn(7L);
        when(requestService.findBySearchCriteria(any(), any())).thenReturn(page);

        controller.getPending(req);

        ArgumentCaptor<SearchCriteria> captor = ArgumentCaptor.forClass(SearchCriteria.class);
        verify(requestService).findBySearchCriteria(captor.capture(), any());
        SearchCriteria used = captor.getValue();

        assertTrue(used.getFilterFields().stream().noneMatch(f -> f.getField().equals("createdBy")));
        assertTrue(used.getFilterFields().stream().noneMatch(f -> f.getField().equals("customers")));
    }
}
