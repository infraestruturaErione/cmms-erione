package com.grash.service;

import com.grash.dto.workOrder.WorkOrderPatchDTO;
import com.grash.dto.workOrder.WorkOrderShowDTO;
import com.grash.model.Company;
import com.grash.model.User;
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

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * F6 - requiredSignature herdado da Category e regra obrigatoria: um PATCH
 * de WorkOrder nao pode desligar isso, nem mesmo quando o campo e omitido do
 * JSON (WorkOrderBasePatchDTO.requiredSignature e boolean primitivo, entao
 * "omitido" e "explicito false" chegam identicos no DTO, e o mapper real
 * (NullValuePropertyMappingStrategy.IGNORE, sem efeito em primitivos)
 * reaplica esse false incondicionalmente). Os testes abaixo simulam esse
 * comportamento real do WorkOrderMapper (mockado) pra provar que
 * enforceRequiredSignatureFromCategory corrige isso depois.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderServiceRequiredSignatureEnforcementTest {

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
    private User user;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(1L);
        user = new User();
        user.setId(1L);
        user.setCompany(company);

        workOrderService.setDeps(workflowService, customerScopeService, taskService);
        workOrderService.setWebhookDispatchService(webhookDispatchService);

        when(workOrderMapper.toShowDto(any(WorkOrder.class))).thenReturn(new WorkOrderShowDTO());
    }

    private WorkOrderCategory categoryRequiringSignature(Long id, boolean requireSignature) {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(id);
        category.setRequireSignature(requireSignature);
        return category;
    }

    // Simula o comportamento REAL do WorkOrderMapper.updateWorkOrder: campos
    // primitivos do DTO (requiredSignature) sao sempre copiados pro entity,
    // NullValuePropertyMappingStrategy.IGNORE nao tem efeito neles.
    private void stubMapperCopyingRequiredSignature() {
        when(workOrderMapper.updateWorkOrder(any(WorkOrder.class), any(WorkOrderPatchDTO.class)))
                .thenAnswer(invocation -> {
                    WorkOrder entity = invocation.getArgument(0);
                    WorkOrderPatchDTO dto = invocation.getArgument(1);
                    entity.setRequiredSignature(dto.isRequiredSignature());
                    if (dto.getCategory() != null) entity.setCategory(dto.getCategory());
                    return entity;
                });
    }

    // 2) PATCH requiredSignature=false numa OS de categoria que exige
    // assinatura -> backend forca de volta para true.
    @Test
    void patchTryingToDisableSignature_isForcedBackToTrue() {
        Long categoryId = 10L;
        WorkOrderCategory category = categoryRequiringSignature(categoryId, true);
        WorkOrderCategory categoryRef = new WorkOrderCategory();
        categoryRef.setId(categoryId);

        WorkOrder saved = new WorkOrder();
        saved.setId(500L);
        saved.setCategory(categoryRef);
        saved.setRequiredSignature(true);

        WorkOrderPatchDTO patch = new WorkOrderPatchDTO();
        patch.setTitle("OS");
        patch.setRequiredSignature(false); // tentativa explicita de desligar

        when(workOrderRepository.existsById(500L)).thenReturn(true);
        when(workOrderRepository.findById(500L)).thenReturn(Optional.of(saved));
        when(workOrderRepository.saveAndFlush(any(WorkOrder.class))).thenAnswer(inv -> inv.getArgument(0));
        when(workOrderCategoryService.findById(categoryId)).thenReturn(Optional.of(category));
        stubMapperCopyingRequiredSignature();

        WorkOrder result = workOrderService.update(500L, patch, user);

        assertTrue(result.isRequiredSignature(), "categoria exige assinatura - PATCH nao pode desligar");
    }

    // 3) PATCH de um campo nao relacionado (sem enviar requiredSignature
    // explicitamente - equivalente a DTO com o boolean no default) nao pode
    // resetar requiredSignature, mesmo a OS ja estando true.
    @Test
    void patchOfUnrelatedField_doesNotResetSignatureRequirement() {
        Long categoryId = 11L;
        WorkOrderCategory category = categoryRequiringSignature(categoryId, true);
        WorkOrderCategory categoryRef = new WorkOrderCategory();
        categoryRef.setId(categoryId);

        WorkOrder saved = new WorkOrder();
        saved.setId(501L);
        saved.setCategory(categoryRef);
        saved.setRequiredSignature(true);

        WorkOrderPatchDTO patch = new WorkOrderPatchDTO();
        patch.setDescription("so mudando a descricao");
        // requiredSignature nunca setado no DTO -> fica no default do boolean
        // primitivo (false), exatamente como um JSON que omite o campo.

        when(workOrderRepository.existsById(501L)).thenReturn(true);
        when(workOrderRepository.findById(501L)).thenReturn(Optional.of(saved));
        when(workOrderRepository.saveAndFlush(any(WorkOrder.class))).thenAnswer(inv -> inv.getArgument(0));
        when(workOrderCategoryService.findById(categoryId)).thenReturn(Optional.of(category));
        stubMapperCopyingRequiredSignature();

        WorkOrder result = workOrderService.update(501L, patch, user);

        assertTrue(result.isRequiredSignature(),
                "PATCH de campo nao relacionado nao pode resetar requiredSignature");
    }

    // 4) Category NAO exige assinatura -> comportamento de assinatura
    // opcional continua funcionando (PATCH explicito controla o valor
    // livremente, nada e forcado).
    @Test
    void categoryNotRequiringSignature_leavesExplicitValueUntouched() {
        Long categoryId = 12L;
        WorkOrderCategory category = categoryRequiringSignature(categoryId, false);
        WorkOrderCategory categoryRef = new WorkOrderCategory();
        categoryRef.setId(categoryId);

        WorkOrder saved = new WorkOrder();
        saved.setId(502L);
        saved.setCategory(categoryRef);
        saved.setRequiredSignature(false);

        WorkOrderPatchDTO patch = new WorkOrderPatchDTO();
        patch.setTitle("OS");
        patch.setRequiredSignature(true); // usuario liga manualmente, opcional

        when(workOrderRepository.existsById(502L)).thenReturn(true);
        when(workOrderRepository.findById(502L)).thenReturn(Optional.of(saved));
        when(workOrderRepository.saveAndFlush(any(WorkOrder.class))).thenAnswer(inv -> inv.getArgument(0));
        when(workOrderCategoryService.findById(categoryId)).thenReturn(Optional.of(category));
        stubMapperCopyingRequiredSignature();

        WorkOrder result = workOrderService.update(502L, patch, user);

        assertTrue(result.isRequiredSignature(), "valor explicito do usuario deve ser respeitado quando a " +
                "categoria nao exige assinatura");

        // e o caminho inverso: desligar continua permitido quando a
        // categoria nao exige.
        WorkOrderPatchDTO patchOff = new WorkOrderPatchDTO();
        patchOff.setTitle("OS");
        patchOff.setRequiredSignature(false);
        WorkOrder result2 = workOrderService.update(502L, patchOff, user);
        assertFalse(result2.isRequiredSignature());
    }

    // 5) Trocar a Category desta OS para uma que exige assinatura, no mesmo
    // PATCH, tambem forca requiredSignature=true - usa a Category NOVA, nao
    // a referencia rasa que chega so com o id.
    @Test
    void switchingToSignatureRequiringCategory_enforcesSignature() {
        Long oldCategoryId = 13L;
        Long newCategoryId = 14L;
        WorkOrderCategory oldCategory = categoryRequiringSignature(oldCategoryId, false);
        WorkOrderCategory newCategory = categoryRequiringSignature(newCategoryId, true);

        WorkOrderCategory oldCategoryRef = new WorkOrderCategory();
        oldCategoryRef.setId(oldCategoryId);
        WorkOrder saved = new WorkOrder();
        saved.setId(503L);
        saved.setCategory(oldCategoryRef);
        saved.setRequiredSignature(false);

        // referencia rasa (so o id) como chegaria de fato no JSON do PATCH.
        WorkOrderCategory newCategoryRef = new WorkOrderCategory();
        newCategoryRef.setId(newCategoryId);

        WorkOrderPatchDTO patch = new WorkOrderPatchDTO();
        patch.setTitle("OS");
        patch.setCategory(newCategoryRef);
        patch.setRequiredSignature(false);

        when(workOrderRepository.existsById(503L)).thenReturn(true);
        when(workOrderRepository.findById(503L)).thenReturn(Optional.of(saved));
        when(workOrderRepository.saveAndFlush(any(WorkOrder.class))).thenAnswer(inv -> inv.getArgument(0));
        when(workOrderCategoryService.findById(oldCategoryId)).thenReturn(Optional.of(oldCategory));
        when(workOrderCategoryService.findById(newCategoryId)).thenReturn(Optional.of(newCategory));
        stubMapperCopyingRequiredSignature();

        WorkOrder result = workOrderService.update(503L, patch, user);

        assertTrue(result.isRequiredSignature(),
                "trocar pra uma categoria que exige assinatura deve forcar o requisito");
    }

    // Isolado (sem passar por update()): categoria null nao forca nada, sem
    // NPE.
    @Test
    void nullCategory_doesNotForceAnythingAndDoesNotThrow() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setRequiredSignature(false);

        assertDoesNotThrow(() -> workOrderService.enforceRequiredSignatureFromCategory(workOrder));
        assertFalse(workOrder.isRequiredSignature());
    }
}
