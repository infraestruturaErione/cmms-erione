package com.grash.service;

import com.grash.dto.workOrder.WorkOrderShowDTO;
import com.grash.model.Company;
import com.grash.model.WorkOrder;
import com.grash.model.WorkOrderCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Sprint 3A - prova o snapshot congelado dos 7 requisitos de conclusao da
 * Category dentro da WorkOrder. Cenarios A-F do plano da sprint:
 * A) categoria com tudo true -> nova WO recebe tudo true;
 * B) categoria com tudo false -> nova WO recebe tudo false;
 * C) categoria null -> criacao funciona, snapshot default seguro;
 * D) editar a categoria depois nao muda o snapshot ja gravado na WO;
 * E) o merge nunca desliga um valor que ja tenha chegado explicito na WO;
 * F) o caminho publico create() (usado por POST/PM/Request/meter trigger)
 * aplica o snapshot de fato, nao so o metodo isolado.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderServiceCompletionRequirementsSnapshotTest {

    @Mock
    private com.grash.repository.WorkOrderRepository workOrderRepository;
    @Mock
    private com.grash.repository.WorkOrderHistoryRepository workOrderHistoryRepository;
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

    @InjectMocks
    private WorkOrderService workOrderService;

    private Company company;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(1L);
        // @InjectMocks so usa o construtor gerado por @RequiredArgsConstructor
        // (campos final); os campos nao-final (workflowService,
        // customerScopeService, taskService, webhookDispatchService) sao
        // preenchidos em producao pelos metodos @Autowired setDeps/
        // setWebhookDispatchService - reproduzido aqui manualmente pro teste
        // F (create() fim-a-fim) nao NPEtar.
        workOrderService.setDeps(workflowService, customerScopeService, taskService);
        workOrderService.setWebhookDispatchService(webhookDispatchService);
    }

    private WorkOrderCategory categoryWithFlags(boolean value) {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        category.setRequireSignature(value);
        category.setRequireSignerName(value);
        category.setRequireSignerDocument(value);
        category.setRequirePhotos(value);
        category.setRequireFieldReport(value);
        category.setRequireMileage(value);
        category.setRequireChecklistCompletion(value);
        return category;
    }

    private void assertAllRequirements(WorkOrder workOrder, boolean expected) {
        assertEquals(expected, workOrder.isRequiredSignature(), "requiredSignature");
        assertEquals(expected, workOrder.isRequireSignerName(), "requireSignerName");
        assertEquals(expected, workOrder.isRequireSignerDocument(), "requireSignerDocument");
        assertEquals(expected, workOrder.isRequirePhotos(), "requirePhotos");
        assertEquals(expected, workOrder.isRequireFieldReport(), "requireFieldReport");
        assertEquals(expected, workOrder.isRequireMileage(), "requireMileage");
        assertEquals(expected, workOrder.isRequireChecklistCompletion(), "requireChecklistCompletion");
    }

    // A) Category com todas as flags true -> nova WO recebe todas true.
    @Test
    void categoryWithAllFlagsTrue_workOrderReceivesAllTrue() {
        WorkOrder workOrder = new WorkOrder();
        workOrderService.applyCategoryCompletionRequirementsSnapshot(workOrder, categoryWithFlags(true));
        assertAllRequirements(workOrder, true);
    }

    // B) Category com todas as flags false -> nova WO recebe todas false.
    @Test
    void categoryWithAllFlagsFalse_workOrderReceivesAllFalse() {
        WorkOrder workOrder = new WorkOrder();
        workOrderService.applyCategoryCompletionRequirementsSnapshot(workOrder, categoryWithFlags(false));
        assertAllRequirements(workOrder, false);
    }

    // C) Category null -> snapshot default seguro (false), sem NPE.
    @Test
    void nullCategory_snapshotStaysSafeDefault() {
        WorkOrder workOrder = new WorkOrder();
        assertDoesNotThrow(() -> workOrderService.applyCategoryCompletionRequirementsSnapshot(workOrder, null));
        assertAllRequirements(workOrder, false);
    }

    // D) Editar a Category DEPOIS de o snapshot ja ter sido aplicado nao
    // altera o snapshot ja gravado na WO - o metodo so roda na criacao
    // (dentro de applyCategoryDefaults/create()), nunca de novo depois.
    @Test
    void editingCategoryAfterSnapshot_doesNotChangeAlreadySnapshottedWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        WorkOrderCategory category = categoryWithFlags(true);
        workOrderService.applyCategoryCompletionRequirementsSnapshot(workOrder, category);
        assertTrue(workOrder.isRequirePhotos());

        category.setRequirePhotos(false);
        category.setRequireChecklistCompletion(false);

        assertTrue(workOrder.isRequirePhotos(), "snapshot da WO deve continuar congelado apos editar a categoria");
        assertTrue(workOrder.isRequireChecklistCompletion(), "snapshot da WO deve continuar congelado apos editar " +
                "a categoria");
    }

    // E) O merge nunca desliga um valor que ja tenha chegado explicito na WO
    // (ex: switch "Requer Assinatura" ligado manualmente no formulario), so
    // liga o que a categoria pedir a mais.
    @Test
    void explicitWorkOrderValue_isNeverTurnedOffByCategory() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setRequiredSignature(true);
        WorkOrderCategory category = categoryWithFlags(false);

        workOrderService.applyCategoryCompletionRequirementsSnapshot(workOrder, category);

        assertTrue(workOrder.isRequiredSignature(), "categoria nao deve desligar um valor ja definido " +
                "explicitamente na WO");
    }

    @Test
    void categoryTurnsOnWhatWorkOrderLeftAtDefault() {
        WorkOrder workOrder = new WorkOrder();
        WorkOrderCategory category = categoryWithFlags(true);

        workOrderService.applyCategoryCompletionRequirementsSnapshot(workOrder, category);

        assertTrue(workOrder.isRequiredSignature(), "categoria deve ligar o que a WO deixou no default (false)");
    }

    // F) O caminho publico create() (usado por POST normal, PM/Quartz,
    // Request aprovada e meter trigger - todos convergem aqui) aplica o
    // snapshot de fato, nao so o metodo isolado chamado diretamente nos
    // testes acima.
    @Test
    void create_withCategory_appliesCompletionRequirementsSnapshotEndToEnd() {
        WorkOrderCategory category = categoryWithFlags(true);
        WorkOrder categoryStub = new WorkOrder();
        // referencia minima (so id) que chega no workOrder antes do
        // applyCategoryDefaults resolver a categoria completa - mesma forma
        // como um WorkOrderPostDTO chega do controller com so o id da
        // categoria selecionada.
        WorkOrderCategory categoryRef = new WorkOrderCategory();
        categoryRef.setId(10L);

        WorkOrder workOrder = new WorkOrder();
        workOrder.setTitle("OS de teste");
        workOrder.setCategory(categoryRef);

        when(licenseService.hasEntitlement(any())).thenReturn(true);
        when(customSequenceService.getNextWorkOrderSequence(company)).thenReturn(1L);
        when(workOrderRepository.saveAndFlush(any(WorkOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(workOrderCategoryService.findById(10L)).thenReturn(Optional.of(category));
        when(workflowService.findByMainConditionAndCompany(any(), anyLong())).thenReturn(Collections.emptyList());
        when(workOrderMapper.toShowDto(any(WorkOrder.class))).thenReturn(new WorkOrderShowDTO());

        WorkOrder createdWorkOrder = workOrderService.create(workOrder, company);

        assertAllRequirements(createdWorkOrder, true);
    }
}
