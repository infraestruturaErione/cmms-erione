package com.grash.service;

import com.grash.exception.WorkOrderCompletionException;
import com.grash.model.*;
import com.grash.model.enums.FieldType;
import com.grash.model.enums.FileType;
import com.grash.model.enums.MissingRequirement;
import com.grash.model.enums.TaskType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Sprint 3B - WorkOrderCompletionValidator. Usa os snapshots da Sprint 3A
 * (WorkOrder.requireXxx/requiredSignature), NUNCA a Category ao vivo. Cada
 * cenario testa uma regra aprovada isoladamente, mais combinacoes (OR com
 * config global, filhos de assinatura, zero Tasks, multiplas pendencias).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderCompletionValidatorTest {

    @Mock
    private TaskService taskService;
    @Mock
    private com.grash.repository.CommentRepository commentRepository;

    @InjectMocks
    private WorkOrderCompletionValidator validator;

    private WorkOrder baseWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(1L);
        workOrder.setCheckInAt(new Date());
        workOrder.setCheckOutAt(new Date());
        when(taskService.findByWorkOrder(1L)).thenReturn(Collections.emptyList());
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                Collections.singletonList(1L), "[Relato em campo]")).thenReturn(Collections.emptyList());
        return workOrder;
    }

    private Company companyWithGlobalField(String fieldName, FieldType fieldType) {
        Company company = new Company();
        CompanySettings settings = new CompanySettings(company);
        WorkOrderConfiguration configuration = new WorkOrderConfiguration(settings);
        configuration.setWorkOrderFieldConfigurations(new HashSet<>(Collections.singletonList(
                FieldConfiguration.builder().fieldName(fieldName).fieldType(fieldType).build())));
        settings.setWorkOrderConfiguration(configuration);
        company.setCompanySettings(settings);
        return company;
    }

    private Comment fieldReportComment(String text, File... files) {
        Comment comment = new Comment();
        comment.setContent("[Relato em campo] " + text);
        comment.setFiles(files.length == 0 ? new ArrayList<>() : Arrays.asList(files));
        return comment;
    }

    private File file(FileType type) {
        File file = new File();
        file.setType(type);
        return file;
    }

    private Task task(TaskType taskType, String value) {
        TaskBase taskBase = TaskBase.builder().taskType(taskType).build();
        Task task = new Task();
        task.setTaskBase(taskBase);
        task.setValue(value);
        return task;
    }

    // A) Nenhum requisito ligado, check-in/check-out presentes -> passa.
    @Test
    void noRequirements_checkInAndCheckOutPresent_passes() {
        assertDoesNotThrow(() -> validator.validate(baseWorkOrder(), new Company()));
    }

    // B) Check-in ausente -> so CHECK_IN.
    @Test
    void missingCheckIn_throwsCheckInOnly() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setCheckInAt(null);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECK_IN), ex.getMissingRequirements());
    }

    // C) Check-out ausente -> so CHECK_OUT. Deslocamento (departureAt) nunca e'
    // checado - nao existe requisito pra ele.
    @Test
    void missingCheckOut_throwsCheckOutOnly() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setCheckOutAt(null);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECK_OUT), ex.getMissingRequirements());
    }

    // D) Ambos ausentes -> os dois codigos, nesta ordem.
    @Test
    void missingBothCheckInAndCheckOut_throwsBoth() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setCheckInAt(null);
        workOrder.setCheckOutAt(null);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECK_IN, MissingRequirement.CHECK_OUT), ex.getMissingRequirements());
    }

    // E) requireFieldReport=true, nenhum comentario de relato -> FIELD_REPORT.
    @Test
    void requireFieldReport_noComment_throwsFieldReport() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireFieldReport(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT), ex.getMissingRequirements());
    }

    // F) requireFieldReport=true, comentario com texto real -> passa.
    @Test
    void requireFieldReport_withRealText_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireFieldReport(true);
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                Collections.singletonList(1L), "[Relato em campo]"))
                .thenReturn(List.of(fieldReportComment("Trocado o filtro de ar.")));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // G) requireFieldReport=true, comentario so com o placeholder de "so foto"
    // -> nao conta como relato, continua faltando.
    @Test
    void requireFieldReport_onlyPhotoPlaceholderText_throwsFieldReport() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireFieldReport(true);
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                Collections.singletonList(1L), "[Relato em campo]"))
                .thenReturn(List.of(fieldReportComment("Photo evidence registered.")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT), ex.getMissingRequirements());
    }

    // H) requirePhotos=true, sem evidencia -> PHOTO.
    @Test
    void requirePhotos_noEvidence_throwsPhoto() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // I) requirePhotos=true, comentario de relato com File IMAGE -> passa
    // (definicao restrita aprovada).
    @Test
    void requirePhotos_fieldReportCommentWithImage_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                Collections.singletonList(1L), "[Relato em campo]"))
                .thenReturn(List.of(fieldReportComment("Evidencia fotografica registrada.", file(FileType.IMAGE))));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // J) requirePhotos=true, File anexado mas tipo OTHER (nao IMAGE) -> nao
    // conta, continua faltando PHOTO.
    @Test
    void requirePhotos_nonImageFile_throwsPhoto() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                Collections.singletonList(1L), "[Relato em campo]"))
                .thenReturn(List.of(fieldReportComment("Documento anexo.", file(FileType.OTHER))));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // K) requirePhotos=true, workOrder.image setado direto (nao via
    // comentario de relato) -> NAO conta - definicao restrita, diferente do
    // buildFieldEvidenceItems usado no PDF (que aceita workOrder.image).
    @Test
    void requirePhotos_workOrderImageDirectlySet_doesNotCount_throwsPhoto() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);
        File administrativeImage = file(FileType.IMAGE);
        workOrder.setImage(administrativeImage);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // L) completeFiles global REQUIRED, requirePhotos=false na OS -> ainda
    // assim exige (OR entre snapshot e config global).
    @Test
    void completeFilesGloballyRequired_snapshotFalse_stillThrowsPhoto() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(false);
        Company company = companyWithGlobalField("completeFiles", FieldType.REQUIRED);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, company));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // M) completeFiles global OPTIONAL -> nao ativa a obrigatoriedade (so
    // REQUIRED ativa).
    @Test
    void completeFilesGloballyOptional_doesNotRequirePhoto() {
        WorkOrder workOrder = baseWorkOrder();
        Company company = companyWithGlobalField("completeFiles", FieldType.OPTIONAL);

        assertDoesNotThrow(() -> validator.validate(workOrder, company));
    }

    // N) requireChecklistCompletion=true, zero Tasks -> nao bloqueia.
    @Test
    void requireChecklist_zeroTasks_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireChecklistCompletion(true);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // O) requireChecklistCompletion=true, Tasks nao-SUBTASK todas respondidas
    // -> passa.
    @Test
    void requireChecklist_nonSubtaskTasksAnswered_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(
                task(TaskType.TEXT, "Tudo ok"),
                task(TaskType.NUMBER, "42")));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // P) requireChecklistCompletion=true, uma Task sem valor -> CHECKLIST.
    @Test
    void requireChecklist_oneTaskBlank_throwsChecklist() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(
                task(TaskType.TEXT, "Tudo ok"),
                task(TaskType.TEXT, "  ")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECKLIST), ex.getMissingRequirements());
    }

    // Q) SUBTASK com valor "OPEN" (nao "COMPLETE") -> CHECKLIST, mesmo com
    // valor preenchido.
    @Test
    void requireChecklist_subtaskNotComplete_throwsChecklist() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(task(TaskType.SUBTASK, "OPEN")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECKLIST), ex.getMissingRequirements());
    }

    // R) SUBTASK com valor "COMPLETE" -> conta como respondida.
    @Test
    void requireChecklist_subtaskComplete_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(task(TaskType.SUBTASK, "COMPLETE")));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // S) completeTasks global REQUIRED, snapshot false, checklist incompleto
    // -> ainda assim exige (OR).
    @Test
    void completeTasksGloballyRequired_snapshotFalse_stillThrowsChecklist() {
        WorkOrder workOrder = baseWorkOrder();
        Company company = companyWithGlobalField("completeTasks", FieldType.REQUIRED);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(task(TaskType.TEXT, "")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, company));
        assertEquals(List.of(MissingRequirement.CHECKLIST), ex.getMissingRequirements());
    }

    // T) requiredSignature=false -> SIGNATURE/SIGNER_NAME/SIGNER_DOCUMENT nunca
    // sao checados, mesmo com requireSignerName/requireSignerDocument=true
    // (filhos so valem se o pai valer).
    @Test
    void signatureNotRequired_childrenIgnoredEvenIfTrue() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequiredSignature(false);
        workOrder.setRequireSignerName(true);
        workOrder.setRequireSignerDocument(true);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // U) requiredSignature=true, assinatura vazia -> SIGNATURE.
    @Test
    void signatureRequired_blank_throwsSignature() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequiredSignature(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.SIGNATURE), ex.getMissingRequirements());
    }

    // V) assinatura presente, requireSignerName=true, nome vazio -> SIGNER_NAME.
    @Test
    void signerNameRequired_blank_throwsSignerName() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequiredSignature(true);
        workOrder.setSignature("data:image/png;base64,abc");
        workOrder.setRequireSignerName(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.SIGNER_NAME), ex.getMissingRequirements());
    }

    // W) assinatura presente, requireSignerDocument=true, documento vazio ->
    // SIGNER_DOCUMENT.
    @Test
    void signerDocumentRequired_blank_throwsSignerDocument() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequiredSignature(true);
        workOrder.setSignature("data:image/png;base64,abc");
        workOrder.setRequireSignerDocument(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.SIGNER_DOCUMENT), ex.getMissingRequirements());
    }

    // X) assinatura + nome + documento presentes -> passa.
    @Test
    void signatureAndChildren_allPresent_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequiredSignature(true);
        workOrder.setSignature("data:image/png;base64,abc");
        workOrder.setRequireSignerName(true);
        workOrder.setSignerName("Joao");
        workOrder.setRequireSignerDocument(true);
        workOrder.setSignerDocument("123.456.789-00");

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // Y) requireMileage=true, mileageTraveled=null -> MILEAGE.
    @Test
    void mileageRequired_null_throwsMileage() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireMileage(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.MILEAGE), ex.getMissingRequirements());
    }

    // Z) requireMileage=true, mileageTraveled=0.0 -> valido, passa.
    @Test
    void mileageRequired_zero_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireMileage(true);
        workOrder.setMileageTraveled(0.0);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // AA) requireMileage=true, mileageTraveled negativo -> MILEAGE.
    @Test
    void mileageRequired_negative_throwsMileage() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireMileage(true);
        workOrder.setMileageTraveled(-5.0);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.MILEAGE), ex.getMissingRequirements());
    }

    // AB) requireMileage=false -> mileage nunca e' checado, mesmo null.
    @Test
    void mileageNotRequired_nullIgnored_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireMileage(false);
        workOrder.setMileageTraveled(null);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // AC) Multiplas pendencias combinadas -> todos os codigos aparecem.
    @Test
    void multipleMissingRequirements_allCodesReturned() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setCheckInAt(null);
        workOrder.setRequiredSignature(true);
        workOrder.setRequireMileage(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(Set.of(MissingRequirement.CHECK_IN, MissingRequirement.SIGNATURE, MissingRequirement.MILEAGE),
                new HashSet<>(ex.getMissingRequirements()));
    }

    // AD) Company null -> checagens globais nao quebram (null-safe), nenhuma
    // obrigatoriedade global e' ativada por engano.
    @Test
    void nullCompany_globalChecksAreNullSafe() {
        WorkOrder workOrder = baseWorkOrder();

        assertDoesNotThrow(() -> validator.validate(workOrder, null));
    }

    // AE) CompanySettings/WorkOrderConfiguration presentes mas
    // fieldConfigurations null -> null-safe, nao quebra nem vira obrigacao.
    @Test
    void companySettingsPresentButFieldConfigurationsNull_isNullSafe() {
        WorkOrder workOrder = baseWorkOrder();
        Company company = new Company();
        CompanySettings settings = new CompanySettings(company);
        WorkOrderConfiguration configuration = new WorkOrderConfiguration(settings);
        configuration.setWorkOrderFieldConfigurations(null);
        settings.setWorkOrderConfiguration(configuration);
        company.setCompanySettings(settings);

        assertDoesNotThrow(() -> validator.validate(workOrder, company));
    }
}
