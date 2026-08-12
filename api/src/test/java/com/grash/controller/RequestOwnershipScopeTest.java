package com.grash.controller;

import com.grash.dto.RequestPatchDTO;
import com.grash.dto.RequestPostDTO;
import com.grash.dto.RequestShowDTO;
import com.grash.exception.CustomException;
import com.grash.factory.MailServiceFactory;
import com.grash.mapper.RequestMapper;
import com.grash.mapper.WorkOrderMapper;
import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Request;
import com.grash.model.Role;
import com.grash.model.Team;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
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

import jakarta.servlet.http.HttpServletRequest;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Item 2 do pedido de correcao (2a rodada): PATCH/DELETE /requests/{id} so
 * autorizavam por createdBy/permissao funcional, sem revalidar Company/
 * customer scope ATUAL. Cenario obrigatorio: Requester cria Request no
 * Cliente A, Admin reassocia pro Cliente B - o creator nao pode mais
 * PATCH nem DELETE.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RequestOwnershipScopeTest {

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
    private CustomerScopeService customerScopeService;
    @Mock
    private HttpServletRequest req;

    private RequestController controller;
    private Company company;
    private User requesterCreator;

    @BeforeEach
    void setUp() {
        controller = new RequestController(requestService, userService, workOrderMapper, requestMapper,
                notificationService, messageSource, workflowService, mailServiceFactory, assetService,
                requestPortalService, webhookDispatchService, customerScopeService);
        company = new Company();
        company.setId(1L);
        requesterCreator = new User();
        requesterCreator.setId(152L);
        requesterCreator.setCompany(company);
        requesterCreator.setRole(Role.builder().code(RoleCode.REQUESTER)
                .editOtherPermissions(new HashSet<>())
                .deleteOtherPermissions(new HashSet<>())
                .build());
        when(userService.whoami(req)).thenReturn(requesterCreator);
    }

    private Request requestOf(Long id, Long createdBy, List<Customer> customers) {
        Request request = new Request();
        request.setId(id);
        request.setCompany(company);
        request.setCreatedBy(createdBy);
        request.setCustomers(new ArrayList<>(customers));
        return request;
    }

    // Cenario obrigatorio: creator + Request reassociada pra Customer B ->
    // canAccessWorkOrderBase (customer scope ATUAL) reprova -> 403, mesmo
    // sendo o proprio creator.
    @Test
    void patch_deniedWhenReassociatedToOutOfScopeCustomer_evenForCreator() {
        Customer customerB = new Customer();
        customerB.setId(2L);
        Request savedRequest = requestOf(500L, 152L, Collections.singletonList(customerB));
        when(requestService.findById(500L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(requesterCreator, savedRequest)).thenReturn(false);

        RequestPatchDTO patchDTO = new RequestPatchDTO();
        patchDTO.setTitle("tentativa de edicao");

        CustomException ex = assertThrows(CustomException.class, () -> controller.patch(patchDTO, 500L, req));
        assertTrue(ex.getMessage().contains("Access denied"));
        verify(requestService, never()).update(any(), any(), any());
    }

    @Test
    void delete_deniedWhenReassociatedToOutOfScopeCustomer_evenForCreator() {
        Customer customerB = new Customer();
        customerB.setId(2L);
        Request savedRequest = requestOf(501L, 152L, Collections.singletonList(customerB));
        when(requestService.findById(501L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(requesterCreator, savedRequest)).thenReturn(false);

        CustomException ex = assertThrows(CustomException.class, () -> controller.delete(501L, req));
        assertTrue(ex.getMessage().contains("Access denied"));
        verify(requestService, never()).delete(any());
    }

    // Controle positivo: ainda dentro do escopo (Cliente A) -> continua
    // podendo PATCH/DELETE normalmente.
    @Test
    void patch_allowedWhenStillInScope() {
        Customer customerA = new Customer();
        customerA.setId(1L);
        Request savedRequest = requestOf(502L, 152L, Collections.singletonList(customerA));
        when(requestService.findById(502L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(requesterCreator, savedRequest)).thenReturn(true);
        when(requestService.update(eq(502L), any(), any())).thenReturn(savedRequest);
        when(requestMapper.toShowDto(savedRequest)).thenReturn(new RequestShowDTO());

        RequestPatchDTO patchDTO = new RequestPatchDTO();
        patchDTO.setTitle("edicao legitima");
        patchDTO.setCustomers(new ArrayList<>(Collections.singletonList(customerA)));

        assertDoesNotThrow(() -> controller.patch(patchDTO, 502L, req));
        verify(requestService).update(eq(502L), any(), any());
    }

    @Test
    void delete_allowedWhenStillInScope() {
        Customer customerA = new Customer();
        customerA.setId(1L);
        Request savedRequest = requestOf(503L, 152L, Collections.singletonList(customerA));
        when(requestService.findById(503L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(requesterCreator, savedRequest)).thenReturn(true);

        assertDoesNotThrow(() -> controller.delete(503L, req));
        verify(requestService).delete(503L);
    }

    // "Cuidado" explicito do pedido: payload de PATCH SEM "customers" nao
    // pode apagar a associacao atual (o mapper sobrescreveria com null,
    // reabrindo a janela de ownership-sem-customer em canAccessWorkOrderBase
    // pra usos futuros). O controller precisa preencher com o valor salvo
    // ANTES de chamar requestService.update.
    @Test
    void patch_omittingCustomers_preservesExistingAssociation() {
        Customer customerA = new Customer();
        customerA.setId(1L);
        Request savedRequest = requestOf(504L, 152L, Collections.singletonList(customerA));
        when(requestService.findById(504L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(requesterCreator, savedRequest)).thenReturn(true);
        when(requestService.update(eq(504L), any(), any())).thenReturn(savedRequest);
        when(requestMapper.toShowDto(savedRequest)).thenReturn(new RequestShowDTO());

        RequestPatchDTO patchDTO = new RequestPatchDTO();
        patchDTO.setTitle("edicao sem mexer em customers");
        // patchDTO.getCustomers() == null de proposito - simula o JSON
        // omitindo o campo.

        controller.patch(patchDTO, 504L, req);

        ArgumentCaptor<RequestPatchDTO> captor = ArgumentCaptor.forClass(RequestPatchDTO.class);
        verify(requestService).update(eq(504L), captor.capture(), any());
        assertNotNull(captor.getValue().getCustomers(), "customers nao pode ficar null - apagaria a associacao atual");
        assertEquals(1, captor.getValue().getCustomers().size());
        assertEquals(1L, captor.getValue().getCustomers().get(0).getId());
    }

    // Item 5 (sanitizacao de DTO compartilhado): getById devolve Request
    // acessivel (Cliente A+B compartilhados), mas o DTO so pode mostrar A.
    @Test
    void getById_sanitizesCustomersInResponse() {
        Customer customerA = new Customer();
        customerA.setId(1L);
        Customer customerB = new Customer();
        customerB.setId(2L);
        Request savedRequest = requestOf(505L, 999L, java.util.Arrays.asList(customerA, customerB));
        Role viewRole = Role.builder().code(RoleCode.REQUESTER)
                .viewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .viewOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .build();
        requesterCreator.setRole(viewRole);
        when(requestService.findById(505L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(requesterCreator, savedRequest)).thenReturn(true);

        RequestShowDTO rawDto = new RequestShowDTO();
        rawDto.setCustomers(new ArrayList<>(java.util.Arrays.asList(
                miniOf(customerA), miniOf(customerB))));
        when(requestMapper.toShowDto(savedRequest)).thenReturn(rawDto);
        List<com.grash.dto.CustomerMiniDTO> onlyA = Collections.singletonList(miniOf(customerA));
        // doReturn (nao when/thenReturn) - evita o erro de inferencia
        // generica do compilador com List<CustomerMiniDTO> vs List<Object>.
        doReturn(onlyA).when(customerScopeService).filterCustomerMiniDTOs(eq(requesterCreator), any(), any());

        RequestShowDTO result = controller.getById(505L, req);

        assertEquals(onlyA, result.getCustomers());
    }

    private com.grash.dto.CustomerMiniDTO miniOf(Customer customer) {
        com.grash.dto.CustomerMiniDTO dto = new com.grash.dto.CustomerMiniDTO();
        dto.setId(customer.getId());
        return dto;
    }

    // --- Ultimo P1 (achado do Gepeto): Requester nao pode se autoatribuir
    // via primaryUser/assignedTo/team no create/patch de Request - esses
    // campos sao copiados sem alteracao pra WorkOrder na aprovacao
    // (WorkOrderService.getWorkOrderFromWorkOrderBase), o que daria
    // canBeEditedBy=true (e portanto write access) na WO resultante. ---

    @Test
    void create_deniedWhenRequesterSetsPrimaryUser() {
        requesterCreator.setRole(Role.builder().code(RoleCode.REQUESTER)
                .createPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .build());
        when(customerScopeService.isRequester(requesterCreator)).thenReturn(true);

        RequestPostDTO requestReq = new RequestPostDTO();
        requestReq.setTitle("Auto-atribuicao");
        User self = new User();
        self.setId(152L);
        requestReq.setPrimaryUser(self);

        CustomException ex = assertThrows(CustomException.class, () -> controller.create(requestReq, req));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(requestService, never()).create(any(), any());
    }

    @Test
    void create_deniedWhenRequesterSetsAssignedTo() {
        requesterCreator.setRole(Role.builder().code(RoleCode.REQUESTER)
                .createPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .build());
        when(customerScopeService.isRequester(requesterCreator)).thenReturn(true);

        RequestPostDTO requestReq = new RequestPostDTO();
        requestReq.setTitle("Auto-atribuicao via assignedTo");
        User self = new User();
        self.setId(152L);
        requestReq.setAssignedTo(new ArrayList<>(Collections.singletonList(self)));

        CustomException ex = assertThrows(CustomException.class, () -> controller.create(requestReq, req));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(requestService, never()).create(any(), any());
    }

    @Test
    void create_deniedWhenRequesterSetsTeam() {
        requesterCreator.setRole(Role.builder().code(RoleCode.REQUESTER)
                .createPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .build());
        when(customerScopeService.isRequester(requesterCreator)).thenReturn(true);

        RequestPostDTO requestReq = new RequestPostDTO();
        requestReq.setTitle("Auto-atribuicao via team");
        Team team = new Team();
        team.setId(7L);
        requestReq.setTeam(team);

        CustomException ex = assertThrows(CustomException.class, () -> controller.create(requestReq, req));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(requestService, never()).create(any(), any());
    }

    // Controle positivo: Requester criando Request SEM nenhum campo
    // operacional continua funcionando normalmente.
    @Test
    void create_allowedWhenRequesterSetsNoOperationalFields() {
        requesterCreator.setRole(Role.builder().code(RoleCode.REQUESTER)
                .createPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .build());
        when(customerScopeService.isRequester(requesterCreator)).thenReturn(true);
        Request created = new Request();
        created.setId(600L);
        when(requestService.create(any(), any())).thenReturn(created);
        when(requestMapper.toShowDto(created)).thenReturn(new RequestShowDTO());
        // create() bem-sucedido dispara onRequestCreation (notificacoes/
        // email) - sem esse stub, mailServiceFactory.getMailService() volta
        // null (nao e' um tipo de Collection, Mockito nao tem default
        // esperto pra isso) e o efeito colateral de notificacao quebra com
        // NPE antes do metodo retornar, mesmo a autorizacao ja tendo passado.
        when(mailServiceFactory.getMailService()).thenReturn(mock(MailService.class));

        RequestPostDTO requestReq = new RequestPostDTO();
        requestReq.setTitle("Request legitima, sem auto-atribuicao");

        assertDoesNotThrow(() -> controller.create(requestReq, req));
        verify(requestService).create(any(), any());
    }

    @Test
    void patch_deniedWhenRequesterSetsPrimaryUser() {
        Customer customerA = new Customer();
        customerA.setId(1L);
        Request savedRequest = requestOf(510L, 152L, Collections.singletonList(customerA));
        when(requestService.findById(510L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(requesterCreator, savedRequest)).thenReturn(true);
        when(customerScopeService.isRequester(requesterCreator)).thenReturn(true);

        RequestPatchDTO patchDTO = new RequestPatchDTO();
        patchDTO.setTitle("tentativa de auto-atribuicao no patch");
        User self = new User();
        self.setId(152L);
        patchDTO.setPrimaryUser(self);

        CustomException ex = assertThrows(CustomException.class, () -> controller.patch(patchDTO, 510L, req));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(requestService, never()).update(any(), any(), any());
    }

    // Controle positivo: Admin (nao-Requester) continua podendo preencher
    // esses campos normalmente - o bloqueio e' especifico de Requester.
    @Test
    void patch_admin_canSetPrimaryUser() {
        User admin = new User();
        admin.setId(99L);
        admin.setCompany(company);
        admin.setRole(Role.builder().code(RoleCode.ADMIN)
                .editOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.REQUESTS)))
                .build());
        when(userService.whoami(req)).thenReturn(admin);
        when(customerScopeService.isRequester(admin)).thenReturn(false);

        Customer customerA = new Customer();
        customerA.setId(1L);
        Request savedRequest = requestOf(511L, 152L, Collections.singletonList(customerA));
        when(requestService.findById(511L)).thenReturn(Optional.of(savedRequest));
        when(customerScopeService.canAccessWorkOrderBase(admin, savedRequest)).thenReturn(true);
        when(requestService.update(eq(511L), any(), any())).thenReturn(savedRequest);
        when(requestMapper.toShowDto(savedRequest)).thenReturn(new RequestShowDTO());

        RequestPatchDTO patchDTO = new RequestPatchDTO();
        patchDTO.setTitle("atribuicao administrativa legitima");
        patchDTO.setCustomers(new ArrayList<>(Collections.singletonList(customerA)));
        User technician = new User();
        technician.setId(700L);
        patchDTO.setPrimaryUser(technician);

        assertDoesNotThrow(() -> controller.patch(patchDTO, 511L, req));
        verify(requestService).update(eq(511L), any(), any());
    }
}
