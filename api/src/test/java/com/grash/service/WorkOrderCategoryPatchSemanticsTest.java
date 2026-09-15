package com.grash.service;

import com.grash.dto.WorkOrderCategoryPatchDTO;
import com.grash.mapper.WorkOrderCategoryMapperImpl;
import com.grash.model.Checklist;
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
import static org.mockito.Mockito.when;

/**
 * Correcao (esta rodada): os 7 campos require* de WorkOrderCategoryPatchDTO
 * eram boolean PRIMITIVO - um PATCH que omitisse o campo do JSON (ex:
 * {"name":"Eletrica"}) zerava os 7 requisitos da categoria, porque
 * Jackson desserializa primitivo ausente como false e o mapper nao tinha
 * nenhuma forma de diferenciar "omitido" de "false explicito". Mesma classe
 * de bug ja corrigida para WorkOrder.requiredSignature (F6), so que aqui na
 * DEFINICAO da categoria.
 *
 * Fix: os 7 campos viraram Boolean (wrapper) no DTO, e o
 * WorkOrderCategoryMapper ganhou nullValuePropertyMappingStrategy=IGNORE por
 * campo (so nesses 7 - defaultChecklist/toleranceMinutes/
 * defaultEstimatedDuration ficaram de fora de proposito, ver testes de
 * regressao abaixo).
 *
 * Usa o mapper REAL gerado (WorkOrderCategoryMapperImpl), nao mockado -
 * o bug e a correcao estao no mapper, entao mocka-lo esconderia o
 * comportamento real.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderCategoryPatchSemanticsTest {

    @Mock
    private com.grash.repository.WorkOrderCategoryRepository workOrderCategoryRepository;
    @Mock
    private CompanySettingsService companySettingsService;
    @Mock
    private com.grash.repository.WorkOrderRepository workOrderRepository;
    @Mock
    private com.grash.repository.PreventiveMaintenanceRepository preventiveMaintenanceRepository;
    @Mock
    private com.grash.repository.RequestRepository requestRepository;
    @Mock
    private com.grash.repository.WorkOrderMeterTriggerRepository workOrderMeterTriggerRepository;
    @Mock
    private com.grash.repository.WorkflowActionRepository workflowActionRepository;
    @Mock
    private com.grash.repository.WorkflowConditionRepository workflowConditionRepository;

    private WorkOrderCategoryService workOrderCategoryService;

    @BeforeEach
    void setUp() {
        // @InjectMocks nao serve aqui porque precisamos do mapper REAL (nao
        // mockado) - construcao manual com o mesmo construtor gerado por
        // @RequiredArgsConstructor.
        workOrderCategoryService = new WorkOrderCategoryService(
                workOrderCategoryRepository,
                companySettingsService,
                new WorkOrderCategoryMapperImpl(),
                workOrderRepository,
                preventiveMaintenanceRepository,
                requestRepository,
                workOrderMeterTriggerRepository,
                workflowActionRepository,
                workflowConditionRepository
        );
    }

    private WorkOrderCategory categoryWith(boolean signature, boolean signerName, boolean signerDocument,
                                            boolean photos, boolean fieldReport, boolean mileage,
                                            boolean checklistCompletion) {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(1L);
        category.setName("Eletrica");
        category.setRequireSignature(signature);
        category.setRequireSignerName(signerName);
        category.setRequireSignerDocument(signerDocument);
        category.setRequirePhotos(photos);
        category.setRequireFieldReport(fieldReport);
        category.setRequireMileage(mileage);
        category.setRequireChecklistCompletion(checklistCompletion);
        return category;
    }

    private WorkOrderCategory update(WorkOrderCategory saved, WorkOrderCategoryPatchDTO patch) {
        when(workOrderCategoryRepository.existsById(saved.getId())).thenReturn(true);
        when(workOrderCategoryRepository.findById(saved.getId())).thenReturn(Optional.of(saved));
        when(workOrderCategoryRepository.save(saved)).thenReturn(saved);
        return workOrderCategoryService.update(saved.getId(), patch);
    }

    // 1/2/3 - PATCH somente de name (todos os 7 campos omitidos) preserva
    // exatamente os valores anteriores, sejam true ou false.
    @Test
    void patchingOnlyName_preservesAllSevenRequireFlags_whenPreviouslyTrue() {
        WorkOrderCategory saved = categoryWith(true, true, true, true, true, true, true);
        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName("Eletrica Predial");

        WorkOrderCategory result = update(saved, patch);

        assertEquals("Eletrica Predial", result.getName());
        assertTrue(result.isRequireSignature());
        assertTrue(result.isRequireSignerName());
        assertTrue(result.isRequireSignerDocument());
        assertTrue(result.isRequirePhotos());
        assertTrue(result.isRequireFieldReport());
        assertTrue(result.isRequireMileage());
        assertTrue(result.isRequireChecklistCompletion());
    }

    @Test
    void patchingOnlyName_preservesAllSevenRequireFlags_whenPreviouslyFalse() {
        WorkOrderCategory saved = categoryWith(false, false, false, false, false, false, false);
        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName("Hidraulica");

        WorkOrderCategory result = update(saved, patch);

        assertFalse(result.isRequireSignature());
        assertFalse(result.isRequireSignerName());
        assertFalse(result.isRequireSignerDocument());
        assertFalse(result.isRequirePhotos());
        assertFalse(result.isRequireFieldReport());
        assertFalse(result.isRequireMileage());
        assertFalse(result.isRequireChecklistCompletion());
    }

    // 4 - false explicito muda true -> false.
    @Test
    void explicitFalse_changesTrueToFalse() {
        WorkOrderCategory saved = categoryWith(true, true, true, true, true, true, true);
        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName(saved.getName());
        patch.setRequireSignature(false);

        WorkOrderCategory result = update(saved, patch);

        assertFalse(result.isRequireSignature(), "false explicito deve aplicar, nao ser tratado como omitido");
        // os outros 6 continuam intocados (omitidos neste PATCH)
        assertTrue(result.isRequireSignerName());
        assertTrue(result.isRequirePhotos());
    }

    // 5 - true explicito muda false -> true.
    @Test
    void explicitTrue_changesFalseToTrue() {
        WorkOrderCategory saved = categoryWith(false, false, false, false, false, false, false);
        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName(saved.getName());
        patch.setRequirePhotos(true);

        WorkOrderCategory result = update(saved, patch);

        assertTrue(result.isRequirePhotos());
        assertFalse(result.isRequireSignature());
    }

    // 6/7 - payload misturando true/false/omitido: um campo alterado nao
    // altera os outros seis.
    @Test
    void mixedPayload_onlyTouchedFieldsChange_othersPreserved() {
        WorkOrderCategory saved = categoryWith(true, false, true, false, true, false, true);
        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName(saved.getName());
        patch.setRequireSignature(false);      // true -> false
        patch.setRequirePhotos(true);          // false -> true
        // os outros 5 (requireSignerName, requireSignerDocument,
        // requireFieldReport, requireMileage, requireChecklistCompletion)
        // ficam de fora do payload -> devem preservar o valor salvo.

        WorkOrderCategory result = update(saved, patch);

        assertFalse(result.isRequireSignature(), "alterado explicitamente");
        assertTrue(result.isRequirePhotos(), "alterado explicitamente");
        assertFalse(result.isRequireSignerName(), "omitido - preserva valor salvo (false)");
        assertTrue(result.isRequireSignerDocument(), "omitido - preserva valor salvo (true)");
        assertTrue(result.isRequireFieldReport(), "omitido - preserva valor salvo (true)");
        assertFalse(result.isRequireMileage(), "omitido - preserva valor salvo (false)");
        assertTrue(result.isRequireChecklistCompletion(), "omitido - preserva valor salvo (true)");
    }

    // 9 - defaultChecklist continua podendo ser associado (regressao: nao
    // toquei nesse campo, comportamento de PATCH explicito continua igual).
    @Test
    void defaultChecklist_canStillBeAssociated() {
        WorkOrderCategory saved = categoryWith(false, false, false, false, false, false, false);
        saved.setDefaultChecklist(null);
        Checklist checklist = new Checklist();
        checklist.setId(77L);

        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName(saved.getName());
        patch.setDefaultChecklist(checklist);

        WorkOrderCategory result = update(saved, patch);

        assertNotNull(result.getDefaultChecklist());
        assertEquals(77L, result.getDefaultChecklist().getId());
    }

    // 10 - comportamento atual de remoção/desassociação de defaultChecklist
    // (enviar null explicito) NAO quebrou - continua removendo, exatamente
    // como antes desta correcao (defaultChecklist ficou fora do IGNORE de
    // proposito).
    @Test
    void defaultChecklist_explicitNullStillDisassociates() {
        WorkOrderCategory saved = categoryWith(false, false, false, false, false, false, false);
        Checklist checklist = new Checklist();
        checklist.setId(77L);
        saved.setDefaultChecklist(checklist);

        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName(saved.getName());
        patch.setDefaultChecklist(null);

        WorkOrderCategory result = update(saved, patch);

        assertNull(result.getDefaultChecklist(), "enviar defaultChecklist=null continua desassociando, como antes");
    }

    // 11 - toleranceMinutes/defaultEstimatedDuration nao sofreram regressao
    // incidental: continuam sendo aplicados normalmente quando enviados
    // (este teste documenta que esses 2 campos ficaram FORA da correcao
    // desta rodada - continuam vulneraveis ao mesmo padrao de omissao, isso
    // e' esperado e reportado separadamente, nao corrigido aqui).
    @Test
    void toleranceMinutesAndDefaultEstimatedDuration_stillAppliedWhenSent_unchangedBehavior() {
        WorkOrderCategory saved = categoryWith(false, false, false, false, false, false, false);
        saved.setToleranceMinutes(15);
        saved.setDefaultEstimatedDuration(2.5);

        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName(saved.getName());
        patch.setToleranceMinutes(30);
        patch.setDefaultEstimatedDuration(4.0);

        WorkOrderCategory result = update(saved, patch);

        assertEquals(30, result.getToleranceMinutes());
        assertEquals(4.0, result.getDefaultEstimatedDuration());
    }

    @Test
    void toleranceMinutesAndDefaultEstimatedDuration_omittedStillResetsToNull_knownUnfixedBehavior() {
        WorkOrderCategory saved = categoryWith(false, false, false, false, false, false, false);
        saved.setToleranceMinutes(15);
        saved.setDefaultEstimatedDuration(2.5);

        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName(saved.getName());
        // toleranceMinutes/defaultEstimatedDuration omitidos de proposito

        WorkOrderCategory result = update(saved, patch);

        // Comportamento pre-existente, INTOCADO por esta correcao (fora de
        // escopo desta rodada - ver relatorio final, secao "NAO ALTERADO").
        assertNull(result.getToleranceMinutes(), "comportamento pre-existente nao corrigido nesta rodada");
        assertNull(result.getDefaultEstimatedDuration(), "comportamento pre-existente nao corrigido nesta rodada");
    }

    // Categoria nunca teve nenhum require* setado (default do construtor,
    // equivalente a uma categoria recem-criada sem nenhum PATCH anterior) -
    // omitir tudo continua seguro, sem NPE.
    @Test
    void newCategoryWithDefaults_patchingOnlyName_doesNotThrow() {
        WorkOrderCategory saved = new WorkOrderCategory();
        saved.setId(2L);
        saved.setName("Nova");
        WorkOrderCategoryPatchDTO patch = new WorkOrderCategoryPatchDTO();
        patch.setName("Nova Categoria");

        assertDoesNotThrow(() -> update(saved, patch));
    }
}
