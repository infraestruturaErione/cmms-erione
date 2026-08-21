package com.grash.controller;

import com.grash.dto.SuccessResponse;
import com.grash.dto.assistant.report.ReportAssistantChatRequestDTO;
import com.grash.dto.assistant.report.ReportAssistantChatResponseDTO;
import com.grash.dto.assistant.report.ReportAssistantIntent;
import com.grash.dto.assistant.report.ReportAssistantLinkDTO;
import com.grash.dto.assistant.report.ReportAssistantPlanDTO;
import com.grash.dto.workOrder.report.WorkOrderOperationalReportResponseDTO;
import com.grash.model.Customer;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.security.CurrentUser;
import com.grash.service.ReportAssistantService;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/assistant/report")
@RequiredArgsConstructor
@Tag(name = "Report Assistant", description = "Conversational report assistant backed by DeepSeek")
public class ReportAssistantController {
    private final ReportAssistantService reportAssistantService;
    private final WorkOrderController workOrderController;

    @PostMapping("/chat")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ReportAssistantChatResponseDTO chat(@Valid @RequestBody ReportAssistantChatRequestDTO request,
                                               @Parameter(hidden = true) @CurrentUser User user,
                                               HttpServletRequest rawRequest) {
        reportAssistantService.assertReportAccess(user);

        String forbiddenReply = reportAssistantService.checkForbiddenScope(request.getMessages());
        if (forbiddenReply != null) {
            return ReportAssistantChatResponseDTO.builder()
                    .success(true)
                    .agentName(reportAssistantService.getAgentName())
                    .intent(ReportAssistantIntent.UNSUPPORTED)
                    .reply(forbiddenReply)
                    .build();
        }

        List<Customer> accessibleCustomers = reportAssistantService.getAccessibleCustomers(user);
        ReportAssistantPlanDTO deterministicPlan = reportAssistantService.detectDeterministicIntent(request.getMessages());
        ReportAssistantPlanDTO plan = deterministicPlan != null
                ? deterministicPlan
                : reportAssistantService.plan(request.getMessages(), user, accessibleCustomers);

        if (plan.getIntent() == ReportAssistantIntent.HELP) {
            return ReportAssistantChatResponseDTO.builder()
                    .success(true)
                    .agentName(reportAssistantService.getAgentName())
                    .intent(plan.getIntent())
                    .reply(reportAssistantService.buildHelpReply(reportAssistantService.isRestrictedScopeUser(user)))
                    .build();
        }

        if (plan.getIntent() == ReportAssistantIntent.ASK_CLARIFICATION ||
                plan.getIntent() == ReportAssistantIntent.UNSUPPORTED) {
            return ReportAssistantChatResponseDTO.builder()
                    .success(true)
                    .agentName(reportAssistantService.getAgentName())
                    .intent(plan.getIntent())
                    .reply(plan.getClarificationQuestion() == null || plan.getClarificationQuestion().isBlank()
                            ? "Eu cuido apenas de relatórios. Me diga qual cliente e qual período você quer consultar."
                            : plan.getClarificationQuestion())
                    .build();
        }

        if (plan.getIntent() == ReportAssistantIntent.LIST_CUSTOMERS) {
            String reply = reportAssistantService.composeCustomerListReply(request.getMessages(), accessibleCustomers);
            return ReportAssistantChatResponseDTO.builder()
                    .success(true)
                    .agentName(reportAssistantService.getAgentName())
                    .intent(plan.getIntent())
                    .reply(reply)
                    .build();
        }

        if (plan.getIntent() == ReportAssistantIntent.OPERATIONAL_REPORT) {
            Customer customer = reportAssistantService.requireCustomer(plan.getCustomerId(), user);
            WorkOrderOperationalReportResponseDTO report = reportAssistantService.loadOperationalReport(plan, user);
            String reply = reportAssistantService.composeOperationalReply(request.getMessages(), plan, report, customer);
            return ReportAssistantChatResponseDTO.builder()
                    .success(true)
                    .agentName(reportAssistantService.getAgentName())
                    .intent(plan.getIntent())
                    .reply(reply)
                    .build();
        }

        if (plan.getIntent() == ReportAssistantIntent.GENERATE_BULK_REPORT) {
            Customer customer = reportAssistantService.requireCustomer(plan.getCustomerId(), user);
            var generatedReport = reportAssistantService.findReusableBulkReport(plan, customer, user);
            Date linkExpiresAt = reportAssistantService.computeLinkExpiresAt(user);
            String downloadUrl;
            String reply;
            if (generatedReport != null) {
                downloadUrl = reportAssistantService.generateBulkDownloadLink(generatedReport);
                reply = reportAssistantService.composeBulkReusedReply(
                        request.getMessages(),
                        plan,
                        customer,
                        generatedReport,
                        linkExpiresAt
                );
            } else {
                ResponseEntity<?> response = workOrderController.getBulkPDF(reportAssistantService.toBulkRequest(plan), rawRequest);
                SuccessResponse success = (SuccessResponse) response.getBody();
                generatedReport = reportAssistantService.getLatestBulkReport(user);
                downloadUrl = success.getMessage();
                reply = reportAssistantService.composeBulkGeneratedReply(
                        request.getMessages(),
                        plan,
                        customer,
                        generatedReport,
                        linkExpiresAt
                );
            }
            List<ReportAssistantLinkDTO> links = reportAssistantService.buildLinks("Baixar PDF", downloadUrl, linkExpiresAt);
            return ReportAssistantChatResponseDTO.builder()
                    .success(true)
                    .agentName(reportAssistantService.getAgentName())
                    .intent(plan.getIntent())
                    .reply(reply)
                    .generatedReportId(generatedReport.getId())
                    .generatedReportRequestedAt(generatedReport.getCreatedAt())
                    .generatedReportExpiresAt(generatedReport.getExpiresAt())
                    .linkExpiresAt(linkExpiresAt)
                    .links(links)
                    .build();
        }

        if (plan.getIntent() == ReportAssistantIntent.INDIVIDUAL_REPORT) {
            ReportAssistantService.IndividualReportResolution resolution = reportAssistantService.resolveIndividualReportTarget(plan, user);
            if (resolution.getWorkOrder() == null) {
                return ReportAssistantChatResponseDTO.builder()
                        .success(true)
                        .agentName(reportAssistantService.getAgentName())
                        .intent(ReportAssistantIntent.ASK_CLARIFICATION)
                        .reply(resolution.getClarificationQuestion())
                        .build();
            }
            WorkOrder workOrder = resolution.getWorkOrder();
            SuccessResponse success;
            try {
                success = (SuccessResponse) workOrderController.getPDF(workOrder.getId(), rawRequest, null).getBody();
            } catch (java.io.IOException ex) {
                throw new com.grash.exception.CustomException("Falha ao gerar relatorio individual", org.springframework.http.HttpStatus.BAD_GATEWAY);
            }
            Date linkExpiresAt = reportAssistantService.computeLinkExpiresAt(user);
            String reply = reportAssistantService.composeIndividualReportReply(request.getMessages(), workOrder, linkExpiresAt);
            List<ReportAssistantLinkDTO> links = reportAssistantService.buildLinks("Baixar relatório", success.getMessage(), linkExpiresAt);
            return ReportAssistantChatResponseDTO.builder()
                    .success(true)
                    .agentName(reportAssistantService.getAgentName())
                    .intent(plan.getIntent())
                    .reply(reply)
                    .linkExpiresAt(linkExpiresAt)
                    .links(links)
                    .build();
        }

        String reply = reportAssistantService.composeBulkHistoryReply(
                request.getMessages(),
                reportAssistantService.loadBulkHistory(user)
        );
        return ReportAssistantChatResponseDTO.builder()
                .success(true)
                .agentName(reportAssistantService.getAgentName())
                .intent(ReportAssistantIntent.BULK_HISTORY)
                .reply(reply)
                .build();
    }
}
