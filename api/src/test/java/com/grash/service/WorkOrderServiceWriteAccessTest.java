package com.grash.service;

import com.grash.exception.CustomException;
import com.grash.model.Company;
import com.grash.model.Request;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.repository.WorkOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * P1 (achado do Gepeto, 3a rodada): checkAccessToWorkOrderId e' autorizacao
 * de LEITURA (isAccessibleBy concede acesso tambem a quem criou a Request
 * que originou a WO) - isso NUNCA deveria ter sido usado sozinho como gate
 * de escrita pros filhos de WorkOrder (AdditionalCost/Labor/PartQuantity/
 * Relation). checkWriteAccessToWorkOrderId (canBeEditedBy: criador da
 * PROPRIA WO, atribuido, ou editOtherPermissions) e' o gate correto. Testa
 * o metodo central diretamente - os 4 controllers so delegam pra ele.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderServiceWriteAccessTest {

    @Mock
    private WorkOrderRepository workOrderRepository;
    @Mock
    private LocationService locationService;
    @Mock
    private CustomerService customerService;
    @Mock
    private TeamService teamService;
    @Mock
    private AssetService assetService;
    @Mock
    private UserService userService;
    @Mock
    private CompanyService companyService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private com.grash.mapper.WorkOrderMapper workOrderMapper;
    @Mock
    private jakarta.persistence.EntityManager em;
    @Mock
    private com.grash.factory.MailServiceFactory mailServiceFactory;
    @Mock
    private WorkOrderCategoryService workOrderCategoryService;
    @Mock
    private TaskBaseService taskBaseService;
    @Mock
    private org.springframework.context.MessageSource messageSource;
    @Mock
    private CustomSequenceService customSequenceService;
    @Mock
    private LicenseService licenseService;
    @Mock
    private CustomFieldValueService customFieldValueService;
    @Mock
    private TaskService taskService;
    @Mock
    private WorkflowService workflowService;
    @Mock
    private WebhookDispatchService webhookDispatchService;
    @Mock
    private CustomerScopeService customerScopeService;
    @Mock
    private com.grash.repository.WorkOrderHistoryRepository workOrderHistoryRepository;

    @InjectMocks
    private WorkOrderService workOrderService;

    private Company company;
    private User requester;
    private User admin;
    private User technicianAssigned;
    private User technicianUnassigned;

    @BeforeEach
    void setUp() {
        // customerScopeService/workflowService/taskService nao sao final
        // (quebram dependencia circular) - entram via setDeps(...) com
        // @Autowired @Lazy, nao pelo construtor do @RequiredArgsConstructor,
        // entao @InjectMocks nao os popula sozinho (so faz injecao por
        // construtor). Sem isso, customerScopeService fica null.
        workOrderService.setDeps(workflowService, customerScopeService, taskService);

        company = new Company();
        company.setId(1L);

        Role requesterRole = new Role();
        requesterRole.setCode(RoleCode.REQUESTER);
        requesterRole.setViewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));

        Role adminRole = new Role();
        adminRole.setCode(RoleCode.ADMIN);
        adminRole.setViewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        adminRole.setViewOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        adminRole.setEditOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));

        Role technicianRole = new Role();
        technicianRole.setCode(RoleCode.TECHNICIAN);
        technicianRole.setViewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));

        requester = new User();
        requester.setId(10L);
        requester.setCompany(company);
        requester.setRole(requesterRole);

        admin = new User();
        admin.setId(20L);
        admin.setCompany(company);
        admin.setRole(adminRole);

        technicianAssigned = new User();
        technicianAssigned.setId(30L);
        technicianAssigned.setCompany(company);
        technicianAssigned.setRole(technicianRole);

        technicianUnassigned = new User();
        technicianUnassigned.setId(31L);
        technicianUnassigned.setCompany(company);
        technicianUnassigned.setRole(technicianRole);

        // Customer Scope nao e' o alvo deste teste - sempre permitido, pra
        // isolar exclusivamente a distincao leitura vs escrita funcional.
        when(customerScopeService.canAccessWorkOrderBase(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any())).thenReturn(true);
        // isRequester precisa refletir o role de verdade - customerScopeService
        // e' mock, entao sem isto os testes de Requester passariam "por
        // acidente" via canBeEditedBy=false, sem exercitar o bloqueio
        // explicito novo (achado do Gepeto, ultimo P1).
        when(customerScopeService.isRequester(requester)).thenReturn(true);
        when(customerScopeService.isRequester(admin)).thenReturn(false);
        when(customerScopeService.isRequester(technicianAssigned)).thenReturn(false);
        when(customerScopeService.isRequester(technicianUnassigned)).thenReturn(false);
    }

    private WorkOrder workOrderSpawnedFromRequestBy(Long requestCreatorId, Long workOrderCreatorId) {
        Request parentRequest = new Request();
        parentRequest.setId(500L);
        parentRequest.setCreatedBy(requestCreatorId);

        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(100L);
        workOrder.setCompany(company);
        workOrder.setCreatedBy(workOrderCreatorId);
        workOrder.setParentRequest(parentRequest);
        when(workOrderRepository.findById(100L)).thenReturn(Optional.of(workOrder));
        return workOrder;
    }

    // Cenario central do P1: Requester criou a REQUEST (isAccessibleBy
    // concede LEITURA via parentRequest.createdBy), mas NAO e' quem criou a
    // WorkOrder em si (isso e' tipicamente o Admin que aprovou), nao esta
    // atribuido, e nao tem editOtherPermissions - ele PODE acompanhar a WO,
    // mas NAO PODE administrar custos/horas/pecas/relacoes dela.
    @Test
    void requester_ownsParentRequestOnly_canReadButCannotWrite() {
        WorkOrder workOrder = workOrderSpawnedFromRequestBy(requester.getId(), admin.getId());

        assertDoesNotThrow(() -> workOrderService.checkAccessToWorkOrderId(100L, requester),
                "Requester precisa continuar conseguindo ACOMPANHAR (ler) a WO originada da propria Request");

        CustomException ex = assertThrows(CustomException.class,
                () -> workOrderService.checkWriteAccessToWorkOrderId(100L, requester));
        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    // Controle positivo: usuario NAO-Requester que de fato criou a PROPRIA
    // WorkOrder continua autorizado via canBeEditedBy (createdBy). Usa
    // technicianAssigned (nao "requester") de proposito - o bloqueio
    // explicito de Requester e' incondicional (nem createdBy da WO em si
    // livra), entao testar esse cenario COM um Requester provaria o
    // contrario do que se quer aqui.
    @Test
    void user_createdTheWorkOrderItself_canWrite() {
        WorkOrder workOrder = workOrderSpawnedFromRequestBy(999L, technicianAssigned.getId());

        assertDoesNotThrow(() -> workOrderService.checkWriteAccessToWorkOrderId(100L, technicianAssigned));
    }

    // Exploit completo (ultimo P1, achado do Gepeto): Requester A cria a
    // Request e se autoatribui via primaryUser/assignedTo/team - Admin
    // aprova, WorkOrderService.getWorkOrderFromWorkOrderBase copia esses
    // campos SEM alteracao pra WorkOrder. Simula esse estado final na WO
    // (createdBy=requester TAMBEM, alem de primaryUser/assignedTo/team) -
    // mesmo com TODAS as relacoes de canBeEditedBy simultaneamente
    // satisfeitas, o bloqueio explicito de Requester tem que negar.
    @Test
    void requester_selfAssignedViaAllRelations_stillCannotWrite() {
        Request parentRequest = new Request();
        parentRequest.setId(501L);
        parentRequest.setCreatedBy(requester.getId());

        com.grash.model.Team team = new com.grash.model.Team();
        team.setId(70L);
        team.setUsers(new ArrayList<>(Collections.singletonList(requester)));

        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(101L);
        workOrder.setCompany(company);
        workOrder.setCreatedBy(requester.getId());
        workOrder.setParentRequest(parentRequest);
        workOrder.setPrimaryUser(requester);
        workOrder.setAssignedTo(new ArrayList<>(Collections.singletonList(requester)));
        workOrder.setTeam(team);
        when(workOrderRepository.findById(101L)).thenReturn(Optional.of(workOrder));

        assertDoesNotThrow(() -> workOrderService.checkAccessToWorkOrderId(101L, requester),
                "Requester ainda precisa conseguir LER (acompanhar) a propria WO");

        CustomException ex = assertThrows(CustomException.class,
                () -> workOrderService.checkWriteAccessToWorkOrderId(101L, requester),
                "nenhuma combinacao de createdBy/primaryUser/assignedTo/team pode dar write access a um Requester");
        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    // Technician atribuido a WO continua podendo escrever - comportamento
    // JA usado por controlTimer/patchWorkOrder, preservado aqui.
    @Test
    void technician_assignedToWorkOrder_canWrite() {
        WorkOrder workOrder = workOrderSpawnedFromRequestBy(999L, 888L);
        workOrder.setAssignedTo(new ArrayList<>(Collections.singletonList(technicianAssigned)));

        assertDoesNotThrow(() -> workOrderService.checkWriteAccessToWorkOrderId(100L, technicianAssigned));
    }

    // Technician SEM atribuicao e sem editOtherPermissions - mesma regra que
    // ja se aplicava a controlTimer/patchWorkOrder, nao e' uma regressao.
    @Test
    void technician_notAssigned_cannotWrite() {
        WorkOrder workOrder = workOrderSpawnedFromRequestBy(999L, 888L);
        workOrder.setAssignedTo(new ArrayList<>());
        // technicianUnassigned nem tem viewOtherPermissions - isAccessibleBy
        // exigiria isso ou ownership/assignment; sem nenhum, nem leitura.
        assertThrows(CustomException.class,
                () -> workOrderService.checkWriteAccessToWorkOrderId(100L, technicianUnassigned));
    }

    // Admin com editOtherPermissions.WORK_ORDERS sempre pode escrever,
    // independente de ownership/assignment - comportamento inalterado.
    @Test
    void admin_withEditOtherPermissions_canWrite() {
        WorkOrder workOrder = workOrderSpawnedFromRequestBy(999L, 888L);

        assertDoesNotThrow(() -> workOrderService.checkWriteAccessToWorkOrderId(100L, admin));
    }
}
