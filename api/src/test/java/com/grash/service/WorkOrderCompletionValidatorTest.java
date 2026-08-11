package com.grash.service;

import com.grash.exception.WorkOrderCompletionException;
import com.grash.model.*;
import com.grash.model.enums.FieldType;
import com.grash.model.enums.FileType;
import com.grash.model.enums.MissingRequirement;
import com.grash.model.enums.TaskType;
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
 * Sprint 3B + fix "require field report" - WorkOrderCompletionValidator. Usa
 * os snapshots da Sprint 3A (WorkOrder.requireXxx/requiredSignature), NUNCA a
 * Category ao vivo. Regra de produto: FIELD_REPORT (relato em campo) e'
 * requisito BASE de qualquer OS operacional - sempre obrigatorio, junto de
 * CHECK_IN/CHECK_OUT, independente de Category/requireFieldReport/config
 * global/checklist/foto/assinatura/km. requireFieldReport NAO controla mais
 * essa obrigatoriedade (continua existindo so por compatibilidade). PHOTO
 * continua totalmente independente do relato: requirePhotos OR
 * completeFiles==REQUIRED.
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

    // Sem relato em campo por padrao - quem quiser isolar outro requisito
    // (checklist/assinatura/km/etc) deve usar baseWorkOrderWithValidReport().
    private WorkOrder baseWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(1L);
        workOrder.setCheckInAt(new Date());
        workOrder.setCheckOutAt(new Date());
        when(taskService.findByWorkOrder(1L)).thenReturn(Collections.emptyList());
        stubFieldReportComments(Collections.emptyList());
        return workOrder;
    }

    // Mesma base, mas com um relato de texto real ja satisfazendo FIELD_REPORT
    // - usada por todo teste que quer isolar um requisito QUE NAO seja o
    // proprio relato (regra base agora sempre entra na lista de checagem).
    private WorkOrder baseWorkOrderWithValidReport() {
        WorkOrder workOrder = baseWorkOrder();
        stubFieldReportComments(List.of(fieldReportComment("Atendimento realizado com sucesso.")));
        return workOrder;
    }

    private void stubFieldReportComments(List<Comment> comments) {
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                Collections.singletonList(1L), "[Relato em campo]")).thenReturn(comments);
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

    // ===== Relato em campo (regra base - sempre obrigatorio) =====

    // A) OS sem Category e requireFieldReport=false, check-in/check-out ok,
    // sem relato -> FIELD_REPORT (regra base, independente do snapshot).
    @Test
    void noFieldReport_requireFieldReportFalse_throwsFieldReport() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireFieldReport(false);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT), ex.getMissingRequirements());
    }

    // B) mesma OS, agora com relato textual valido -> FIELD_REPORT deixa de
    // faltar, passa.
    @Test
    void validFieldReportText_satisfiesFieldReport() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireFieldReport(false);
        stubFieldReportComments(List.of(fieldReportComment("Trocado o filtro de ar.")));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // C) relato so com o placeholder de "so foto", sem texto real -> nao
    // conta, continua faltando FIELD_REPORT.
    @Test
    void photoOnlyPlaceholderText_stillThrowsFieldReport() {
        WorkOrder workOrder = baseWorkOrder();
        stubFieldReportComments(List.of(fieldReportComment("Photo evidence registered.")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT), ex.getMissingRequirements());
    }

    // D) completeFiles OPTIONAL + requirePhotos=false, com relato valido ->
    // relato satisfeito, PHOTO nao obrigatorio -> passa.
    @Test
    void completeFilesOptional_noPhotoRequired_withValidReport_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(false);
        stubFieldReportComments(List.of(fieldReportComment("Atendimento concluido sem intercorrencias.")));
        Company company = companyWithGlobalField("completeFiles", FieldType.OPTIONAL);

        assertDoesNotThrow(() -> validator.validate(workOrder, company));
    }

    // E) completeFiles REQUIRED, sem relato e sem foto -> FIELD_REPORT e
    // PHOTO, os dois (independentes um do outro).
    @Test
    void completeFilesRequired_noReportNoPhoto_throwsBoth() {
        WorkOrder workOrder = baseWorkOrder();
        Company company = companyWithGlobalField("completeFiles", FieldType.REQUIRED);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, company));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT, MissingRequirement.PHOTO),
                ex.getMissingRequirements());
    }

    // F) requirePhotos=true, sem relato e sem foto -> FIELD_REPORT e PHOTO.
    @Test
    void requirePhotos_noReportNoPhoto_throwsBoth() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT, MissingRequirement.PHOTO),
                ex.getMissingRequirements());
    }

    // G) foto IMAGE presente mas SEM texto real (so placeholder) -> PHOTO
    // satisfeita, FIELD_REPORT continua pendente - as duas checagens sao
    // independentes mesmo lendo os mesmos comentarios.
    @Test
    void imageWithoutRealText_photoSatisfied_fieldReportStillMissing() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);
        stubFieldReportComments(List.of(
                fieldReportComment("Evidencia fotografica registrada.", file(FileType.IMAGE))));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT), ex.getMissingRequirements());
    }

    // H) texto real presente mas SEM foto, com foto obrigatoria -> FIELD_REPORT
    // satisfeito, PHOTO continua pendente.
    @Test
    void realTextWithoutPhoto_fieldReportSatisfied_photoStillMissing() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);
        stubFieldReportComments(List.of(fieldReportComment("Camera reinstalada e testada.")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // I) Company null -> regra base do relato funciona normalmente (nao
    // depende de Category/company para existir).
    @Test
    void nullCompany_baseFieldReportRuleStillApplies() {
        WorkOrder workOrder = baseWorkOrder();

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, null));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT), ex.getMissingRequirements());
    }

    // J) requireFieldReport=false NAO desliga o requisito base - mesmo com o
    // snapshot explicitamente false, o relato continua obrigatorio.
    @Test
    void requireFieldReportFalse_doesNotDisableBaseRequirement() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequireFieldReport(false);
        // com relato valido, passa apesar do snapshot false
        stubFieldReportComments(List.of(fieldReportComment("Relato registrado normalmente.")));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));

        // sem relato, mesmo com snapshot false, continua bloqueando
        stubFieldReportComments(Collections.emptyList());
        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.FIELD_REPORT), ex.getMissingRequirements());
    }

    // ===== Check-in / check-out =====

    @Test
    void missingCheckIn_withValidReport_throwsCheckInOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setCheckInAt(null);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECK_IN), ex.getMissingRequirements());
    }

    // Deslocamento (departureAt) nunca e' checado - nao existe requisito pra ele.
    @Test
    void missingCheckOut_withValidReport_throwsCheckOutOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setCheckOutAt(null);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECK_OUT), ex.getMissingRequirements());
    }

    @Test
    void missingBothCheckInAndCheckOut_withValidReport_throwsBoth() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setCheckInAt(null);
        workOrder.setCheckOutAt(null);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECK_IN, MissingRequirement.CHECK_OUT), ex.getMissingRequirements());
    }

    @Test
    void allBaseRequirementsMet_passes() {
        assertDoesNotThrow(() -> validator.validate(baseWorkOrderWithValidReport(), new Company()));
    }

    // ===== Foto - variacoes ja cobertas (restricao a comentario de relato) =====

    @Test
    void requirePhotos_nonImageFile_withValidReport_throwsPhotoOnly() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);
        stubFieldReportComments(List.of(fieldReportComment("Documento anexo.", file(FileType.OTHER))));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // workOrder.image setado direto (nao via comentario de relato) -> NAO
    // conta - definicao restrita, diferente do buildFieldEvidenceItems usado
    // no PDF (que aceita workOrder.image).
    @Test
    void requirePhotos_workOrderImageDirectlySet_doesNotCount_throwsPhotoOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequirePhotos(true);
        workOrder.setImage(file(FileType.IMAGE));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // Um unico comentario com texto real E imagem satisfaz FIELD_REPORT e
    // PHOTO ao mesmo tempo - fluxo normal de relato com evidencia anexada.
    @Test
    void requirePhotos_validReportWithImage_passes() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setRequirePhotos(true);
        stubFieldReportComments(List.of(
                fieldReportComment("Camera reinstalada, evidencia em anexo.", file(FileType.IMAGE))));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    @Test
    void completeFilesGloballyRequired_snapshotFalse_withValidReport_stillThrowsPhotoOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequirePhotos(false);
        Company company = companyWithGlobalField("completeFiles", FieldType.REQUIRED);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, company));
        assertEquals(List.of(MissingRequirement.PHOTO), ex.getMissingRequirements());
    }

    // ===== Checklist =====

    @Test
    void requireChecklist_zeroTasks_withValidReport_passes() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireChecklistCompletion(true);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    @Test
    void requireChecklist_nonSubtaskTasksAnswered_withValidReport_passes() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(
                task(TaskType.TEXT, "Tudo ok"),
                task(TaskType.NUMBER, "42")));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    @Test
    void requireChecklist_oneTaskBlank_withValidReport_throwsChecklistOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(
                task(TaskType.TEXT, "Tudo ok"),
                task(TaskType.TEXT, "  ")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECKLIST), ex.getMissingRequirements());
    }

    @Test
    void requireChecklist_subtaskNotComplete_withValidReport_throwsChecklistOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(task(TaskType.SUBTASK, "OPEN")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.CHECKLIST), ex.getMissingRequirements());
    }

    @Test
    void requireChecklist_subtaskComplete_withValidReport_passes() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireChecklistCompletion(true);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(task(TaskType.SUBTASK, "COMPLETE")));

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    @Test
    void completeTasksGloballyRequired_snapshotFalse_withValidReport_throwsChecklistOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        Company company = companyWithGlobalField("completeTasks", FieldType.REQUIRED);
        when(taskService.findByWorkOrder(1L)).thenReturn(List.of(task(TaskType.TEXT, "")));

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, company));
        assertEquals(List.of(MissingRequirement.CHECKLIST), ex.getMissingRequirements());
    }

    // ===== Assinatura =====

    // signerName/signerDocument so sao exigidos quando a assinatura em si e'
    // exigida - nunca isolados.
    @Test
    void signatureNotRequired_childrenIgnoredEvenIfTrue() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequiredSignature(false);
        workOrder.setRequireSignerName(true);
        workOrder.setRequireSignerDocument(true);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    @Test
    void signatureRequired_blank_withValidReport_throwsSignatureOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequiredSignature(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.SIGNATURE), ex.getMissingRequirements());
    }

    @Test
    void signerNameRequired_blank_withValidReport_throwsSignerNameOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequiredSignature(true);
        workOrder.setSignature("data:image/png;base64,abc");
        workOrder.setRequireSignerName(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.SIGNER_NAME), ex.getMissingRequirements());
    }

    @Test
    void signerDocumentRequired_blank_withValidReport_throwsSignerDocumentOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequiredSignature(true);
        workOrder.setSignature("data:image/png;base64,abc");
        workOrder.setRequireSignerDocument(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.SIGNER_DOCUMENT), ex.getMissingRequirements());
    }

    @Test
    void signatureAndChildren_allPresent_withValidReport_passes() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequiredSignature(true);
        workOrder.setSignature("data:image/png;base64,abc");
        workOrder.setRequireSignerName(true);
        workOrder.setSignerName("Joao");
        workOrder.setRequireSignerDocument(true);
        workOrder.setSignerDocument("123.456.789-00");

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // ===== Quilometragem =====

    @Test
    void mileageRequired_null_withValidReport_throwsMileageOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireMileage(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.MILEAGE), ex.getMissingRequirements());
    }

    @Test
    void mileageRequired_zero_withValidReport_passes() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireMileage(true);
        workOrder.setMileageTraveled(0.0);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    @Test
    void mileageRequired_negative_withValidReport_throwsMileageOnly() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireMileage(true);
        workOrder.setMileageTraveled(-5.0);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(List.of(MissingRequirement.MILEAGE), ex.getMissingRequirements());
    }

    @Test
    void mileageNotRequired_nullIgnored_withValidReport_passes() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        workOrder.setRequireMileage(false);
        workOrder.setMileageTraveled(null);

        assertDoesNotThrow(() -> validator.validate(workOrder, new Company()));
    }

    // ===== Combinacoes / null-safety =====

    // Sem relato (regra base) + check-in ausente + assinatura + km -> todos
    // os codigos aparecem, inclusive FIELD_REPORT.
    @Test
    void multipleMissingRequirements_includingFieldReport_allCodesReturned() {
        WorkOrder workOrder = baseWorkOrder();
        workOrder.setCheckInAt(null);
        workOrder.setRequiredSignature(true);
        workOrder.setRequireMileage(true);

        WorkOrderCompletionException ex = assertThrows(WorkOrderCompletionException.class,
                () -> validator.validate(workOrder, new Company()));
        assertEquals(
                Set.of(MissingRequirement.CHECK_IN, MissingRequirement.FIELD_REPORT,
                        MissingRequirement.SIGNATURE, MissingRequirement.MILEAGE),
                new HashSet<>(ex.getMissingRequirements()));
    }

    @Test
    void companySettingsPresentButFieldConfigurationsNull_withValidReport_isNullSafe() {
        WorkOrder workOrder = baseWorkOrderWithValidReport();
        Company company = new Company();
        CompanySettings settings = new CompanySettings(company);
        WorkOrderConfiguration configuration = new WorkOrderConfiguration(settings);
        configuration.setWorkOrderFieldConfigurations(null);
        settings.setWorkOrderConfiguration(configuration);
        company.setCompanySettings(settings);

        assertDoesNotThrow(() -> validator.validate(workOrder, company));
    }
}
