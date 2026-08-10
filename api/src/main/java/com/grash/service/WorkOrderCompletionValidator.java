package com.grash.service;

import com.grash.exception.WorkOrderCompletionException;
import com.grash.model.Comment;
import com.grash.model.Company;
import com.grash.model.CompanySettings;
import com.grash.model.Task;
import com.grash.model.WorkOrder;
import com.grash.model.WorkOrderConfiguration;
import com.grash.model.enums.FieldType;
import com.grash.model.enums.FileType;
import com.grash.model.enums.MissingRequirement;
import com.grash.model.enums.TaskType;
import com.grash.repository.CommentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static com.grash.model.enums.MissingRequirement.*;

/**
 * Sprint 3B - enforca os requisitos de conclusao da WorkOrder usando os
 * snapshots congelados pela Sprint 3A (WorkOrder.requireXxx/requiredSignature)
 * e a config global da empresa (completeFiles/completeTasks) - NUNCA a
 * Category ao vivo, que pode ter mudado depois que a OS foi criada. So deve
 * ser chamado numa transicao GENUINA de status para COMPLETE (ver guarda em
 * WorkOrderController.changeStatus) - nunca em reenvio duplicado (status ja
 * COMPLETE) nem em import historico (excecao administrativa documentada
 * separadamente).
 */
@Service
@RequiredArgsConstructor
public class WorkOrderCompletionValidator {

    private static final String FIELD_REPORT_PREFIX = "[Relato em campo]";
    // Duplicado de proposito de WorkOrderController/WorkOrderOperationalReportService
    // (decisao da Sprint 3B - nao criar dependencia cruzada com o relatorio
    // operacional nesta sprint, pra nao arriscar regressao nele antes do
    // freeze; duplicacao temporaria aceita explicitamente).
    private static final List<String> PHOTO_ONLY_FIELD_REPORT_TEXTS = List.of(
            "Photo evidence registered.",
            "Evidencia fotografica registrada.",
            "Evidência fotográfica registrada.",
            "EvidÃªncia fotogrÃ¡fica registrada."
    );

    private final TaskService taskService;
    private final CommentRepository commentRepository;

    public void validate(WorkOrder workOrder, Company company) {
        List<MissingRequirement> missing = new ArrayList<>();

        if (workOrder.getCheckInAt() == null) missing.add(CHECK_IN);
        if (workOrder.getCheckOutAt() == null) missing.add(CHECK_OUT);

        boolean fieldReportRequired = workOrder.isRequireFieldReport();
        boolean photoRequired = workOrder.isRequirePhotos() || isGlobalFieldRequired(company, "completeFiles");
        if (fieldReportRequired || photoRequired) {
            List<Comment> fieldReportComments = findFieldReportComments(workOrder.getId());
            if (fieldReportRequired && !hasFieldReportText(fieldReportComments)) missing.add(FIELD_REPORT);
            if (photoRequired && !hasFieldEvidencePhoto(fieldReportComments)) missing.add(PHOTO);
        }

        boolean checklistRequired = workOrder.isRequireChecklistCompletion()
                || isGlobalFieldRequired(company, "completeTasks");
        if (checklistRequired && !isChecklistComplete(workOrder.getId())) missing.add(CHECKLIST);

        // signerName/signerDocument so sao exigidos quando a assinatura em si
        // e' exigida - nunca isolados (decisao explicita, pra nao criar uma
        // forma de bloquear a conclusao por um requisito "filho" cujo "pai"
        // nem esta ligado).
        if (workOrder.isRequiredSignature()) {
            if (isBlank(workOrder.getSignature())) missing.add(SIGNATURE);
            if (workOrder.isRequireSignerName() && isBlank(workOrder.getSignerName())) missing.add(SIGNER_NAME);
            if (workOrder.isRequireSignerDocument() && isBlank(workOrder.getSignerDocument()))
                missing.add(SIGNER_DOCUMENT);
        }

        if (workOrder.isRequireMileage()) {
            Double mileage = workOrder.getMileageTraveled();
            if (mileage == null || mileage < 0) missing.add(MILEAGE);
        }

        if (!missing.isEmpty()) throw new WorkOrderCompletionException(missing);
    }

    // So FieldType.REQUIRED ativa uma obrigatoriedade global - OPTIONAL/HIDDEN
    // nunca viram REQUIRED. Null-safe em toda a cadeia: ausencia de
    // CompanySettings/WorkOrderConfiguration/FieldConfiguration NUNCA vira
    // obrigacao (fail-open pra config ausente, nao fail-closed).
    private boolean isGlobalFieldRequired(Company company, String fieldName) {
        if (company == null) return false;
        CompanySettings companySettings = company.getCompanySettings();
        if (companySettings == null) return false;
        WorkOrderConfiguration configuration = companySettings.getWorkOrderConfiguration();
        if (configuration == null || configuration.getWorkOrderFieldConfigurations() == null) return false;
        return configuration.getWorkOrderFieldConfigurations().stream()
                .anyMatch(fieldConfiguration -> fieldName.equals(fieldConfiguration.getFieldName())
                        && fieldConfiguration.getFieldType() == FieldType.REQUIRED);
    }

    private List<Comment> findFieldReportComments(Long workOrderId) {
        return commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                Collections.singletonList(workOrderId), FIELD_REPORT_PREFIX);
    }

    private boolean hasFieldReportText(List<Comment> fieldReportComments) {
        return fieldReportComments.stream()
                .map(comment -> getRealFieldReportText(comment.getContent()))
                .anyMatch(text -> text != null && !text.isBlank());
    }

    // Definicao RESTRITA de evidencia fotografica (aprovada especificamente
    // para o validator) - diferente e mais estrita que
    // WorkOrderController.buildFieldEvidenceItems (que tambem conta
    // workOrder.image/workOrder.files administrativos, usado so no PDF): so
    // File tipo IMAGE anexado a um Comment identificado como relato em campo
    // pelo prefixo conta como evidencia pra efeito de BLOQUEAR a conclusao.
    // Coerente com hasFieldEvidence do frontend (fieldReportUtils.ts).
    private boolean hasFieldEvidencePhoto(List<Comment> fieldReportComments) {
        return fieldReportComments.stream()
                .filter(comment -> comment.getFiles() != null)
                .flatMap(comment -> comment.getFiles().stream())
                .anyMatch(file -> file.getType() == FileType.IMAGE);
    }

    private String getRealFieldReportText(String content) {
        if (content == null || !content.startsWith(FIELD_REPORT_PREFIX)) return null;
        String text = content.substring(FIELD_REPORT_PREFIX.length()).trim();
        if (PHOTO_ONLY_FIELD_REPORT_TEXTS.contains(text)) return null;
        return text;
    }

    private boolean isChecklistComplete(Long workOrderId) {
        List<Task> tasks = taskService.findByWorkOrder(workOrderId);
        // Zero Tasks nao bloqueia - checklist vazio nao e' checklist incompleto.
        return tasks.isEmpty() || tasks.stream().allMatch(this::isTaskAnswered);
    }

    // Mesma semantica de frontend/src/utils/tasks.ts#isExecutionTaskComplete:
    // valor (trim) precisa estar preenchido; SUBTASK, alem disso, precisa
    // valer exatamente "COMPLETE" (os outros tipos - NUMBER/TEXT/INSPECTION/
    // MULTIPLE/METER - aceitam qualquer valor nao-vazio).
    private boolean isTaskAnswered(Task task) {
        String value = task.getValue() == null ? null : task.getValue().trim();
        if (value == null || value.isEmpty()) return false;
        if (task.getTaskBase() != null && task.getTaskBase().getTaskType() == TaskType.SUBTASK) {
            return "COMPLETE".equals(value);
        }
        return true;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
