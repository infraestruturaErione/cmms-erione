package com.grash.service;

import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.dto.workOrder.WorkOrderShowDTO;
import com.grash.exception.WorkOrderCompletionException;
import com.grash.model.Company;
import com.grash.model.WorkOrder;
import com.grash.model.WorkOrderCategory;
import com.grash.model.enums.Status;
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
import static org.mockito.Mockito.*;

/**
 * CORRECAO (esta rodada, Parte 3) - substitui o teste anterior que só
 * confirmava o bug (WorkOrderCreationSkipsCompletionValidationTest, agora
 * removido). POST /work-orders com status=COMPLETE agora passa pelo MESMO
 * WorkOrderCompletionValidator usado em change-status
 * (WorkOrderService.java, dentro de create(), logo apos
 * applyCategoryDefaults) - so' quando o proprio payload pede
 * status=COMPLETE explicitamente.
 *
 * NAO afeta os outros 3 callers de create() (WorkOrderCreationJob/PM,
 * RequestService/Request aprovada, ReadingController/meter trigger): todos
 * usam getWorkOrderFromWorkOrderBase, que nunca copia "status" - a WO
 * sempre nasce no default OPEN, entao o validator nunca roda pra eles
 * (confirmado por leitura de codigo, nao precisa de teste especifico aqui -
 * ver WorkOrderCreationJobChecklistDuplicationTest pra prova de que a PM
 * continua criando OS normalmente). Import historico (ImportController) usa
 * um metodo totalmente separado (importWorkOrder), decisao ja documentada
 * da Sprint 3B, tambem nao afetado por esta mudanca.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderCreationCompleteStatusValidationTest {

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
    private WorkOrderCompletionValidator workOrderCompletionValidator;
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
        workOrderService.setDeps(workflowService, customerScopeService, taskService);
        workOrderService.setWebhookDispatchService(webhookDispatchService);
        when(workOrderMapper.toShowDto(any(WorkOrder.class))).thenReturn(new WorkOrderShowDTO());
        when(workflowService.findByMainConditionAndCompany(any(), anyLong())).thenReturn(Collections.emptyList());
        when(licenseService.hasEntitlement(any())).thenReturn(true);
        when(customSequenceService.getNextWorkOrderSequence(company)).thenReturn(1L);
        when(workOrderRepository.saveAndFlush(any(WorkOrder.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private WorkOrderPostDTO postDtoWithStatus(Status status) {
        WorkOrderCategory categoryRef = new WorkOrderCategory();
        categoryRef.setId(10L);
        WorkOrderPostDTO postDto = new WorkOrderPostDTO();
        postDto.setTitle("OS de teste");
        postDto.setCategory(categoryRef);
        postDto.setStatus(status);
        when(workOrderMapper.fromPostDto(postDto)).thenReturn(postDto);
        return postDto;
    }

    // POST normal (sem status, ou status OPEN implicito/explicito) nunca
    // aciona o validator - continua criando sem exigir nada, como sempre.
    @Test
    void postWithoutCompleteStatus_neverCallsValidator() {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        when(workOrderCategoryService.findById(10L)).thenReturn(Optional.of(category));
        WorkOrderPostDTO postDto = postDtoWithStatus(Status.OPEN);

        assertDoesNotThrow(() -> workOrderService.create(postDto, company));

        verify(workOrderCompletionValidator, never()).validate(any(), any());
    }

    // POST com status=COMPLETE, categoria exigindo requisitos, SEM
    // evidencia (sem checkIn/checkOut/etc) -> agora e' REJEITADO, nao mais
    // aceito silenciosamente. Prova a correcao do bug confirmado na
    // auditoria anterior.
    @Test
    void postWithCompleteStatus_missingRequirements_isRejected() {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        category.setRequireSignature(true);
        category.setRequirePhotos(true);
        category.setRequireChecklistCompletion(true);
        when(workOrderCategoryService.findById(10L)).thenReturn(Optional.of(category));
        WorkOrderPostDTO postDto = postDtoWithStatus(Status.COMPLETE);

        // Simula o WorkOrderCompletionValidator real rejeitando por falta
        // de evidencia - o teste isola o COMPORTAMENTO de create() (chamar
        // ou nao o validator, e propagar a excecao), nao a logica interna
        // do validator em si (ja coberta exaustivamente por
        // WorkOrderCompletionValidatorTest).
        doThrow(new WorkOrderCompletionException(java.util.List.of(
                com.grash.model.enums.MissingRequirement.SIGNATURE)))
                .when(workOrderCompletionValidator).validate(any(WorkOrder.class), eq(company));

        assertThrows(WorkOrderCompletionException.class, () -> workOrderService.create(postDto, company));
        verify(workOrderCompletionValidator).validate(any(WorkOrder.class), eq(company));
    }

    // POST com status=COMPLETE e TODOS os requisitos satisfeitos -> permite
    // a criacao normalmente (o validator roda, mas nao lanca nada).
    @Test
    void postWithCompleteStatus_allRequirementsSatisfied_isAllowed() {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        when(workOrderCategoryService.findById(10L)).thenReturn(Optional.of(category));
        WorkOrderPostDTO postDto = postDtoWithStatus(Status.COMPLETE);

        doNothing().when(workOrderCompletionValidator).validate(any(WorkOrder.class), eq(company));

        WorkOrder result = assertDoesNotThrow(() -> workOrderService.create(postDto, company));

        assertEquals(Status.COMPLETE, result.getStatus());
        verify(workOrderCompletionValidator).validate(any(WorkOrder.class), eq(company));
    }
}
