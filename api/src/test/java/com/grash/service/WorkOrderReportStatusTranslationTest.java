package com.grash.service;

import com.grash.configuration.EmailConfiguration;
import com.grash.model.Company;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.Language;
import com.grash.model.enums.Status;
import com.grash.repository.CommentRepository;
import com.grash.utils.Utils;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.thymeleaf.context.Context;

import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WorkOrderReportStatusTranslationTest {
    private static final Locale PORTUGUESE = Locale.forLanguageTag("pt-BR");
    private static final Map<Status, String> PORTUGUESE_STATUSES = Map.of(
            Status.OPEN, "Aberto", Status.EN_ROUTE, "Em deslocamento",
            Status.IN_PROGRESS, "Em Andamento", Status.ON_HOLD, "Em Espera",
            Status.COMPLETE, "Conclu\u00eddo");

    private ResourceBundleMessageSource messages(String basename) {
        var messages = new ResourceBundleMessageSource();
        messages.setBasename(basename);
        messages.setDefaultEncoding("UTF-8");
        messages.setFallbackToSystemLocale(false);
        return messages;
    }

    @Test
    void everyStatusResolvesInPortugueseAndTheDefaultBundle() {
        for (String basename : List.of("messages", "mailMessages")) {
            var messages = messages(basename);
            for (Status status : Status.values()) {
                assertEquals(PORTUGUESE_STATUSES.get(status),
                        messages.getMessage(status.name(), null, PORTUGUESE), basename + " / " + status);
                assertFalse(messages.getMessage(status.name(), null, Locale.ROOT).isBlank());
            }
            assertEquals("En route", messages.getMessage("EN_ROUTE", null, Locale.ROOT));
            assertEquals("En route", messages.getMessage("EN_ROUTE", null, Locale.forLanguageTag("xx-ZZ")));
        }
    }

    @Test
    void individualAndBulkPdfsRenderEveryStatusWithoutUnresolvedMessages() throws Exception {
        var tasks = mock(TaskService.class);
        var comments = mock(CommentRepository.class);
        when(comments.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                anyCollection(), anyString())).thenReturn(List.of());
        var messages = messages("messages");
        var service = new WorkOrderReportService(tasks, comments, messages, new Utils(), new PdfImageOptimizer());
        var configuration = new EmailConfiguration();
        var engine = configuration.thymeleafTemplateEngine(configuration.emailTemplateResolver());
        var user = new User();
        user.setCompany(new Company());
        user.getCompany().getCompanySettings().getGeneralPreferences().setLanguage(Language.PT_BR);
        for (Status status : Status.values()) {
            var wo = new WorkOrder();
            wo.setId(100L + status.ordinal());
            wo.setCustomId("QA-STATUS-" + status);
            wo.setTitle("QA status translation");
            wo.setStatus(status);
            when(tasks.findByWorkOrder(wo.getId())).thenReturn(List.of());
            var body = service.buildWorkOrderReportVariables(wo, mock(StorageService.class));
            for (String template : List.of("work-order-report", "work-orders-bulk-report")) {
                var variables = new HashMap<>(service.buildCompanyReportVariables(user));
                variables.putAll(body);
                variables.put("workOrderReports", List.of(body));
                variables.put("includeAllStatuses", true);
                variables.put("customerLabel", "QA customer");
                variables.put("periodStart", "28/09/2026");
                variables.put("periodEnd", "27/10/2026");
                var context = new Context(PORTUGUESE);
                context.setVariables(variables);
                String html = engine.process(template, context);
                assertFalse(html.contains("??"), template + " / " + status);
                assertTrue(html.contains(PORTUGUESE_STATUSES.get(status)), template + " / " + status);
                try (var pdf = new com.itextpdf.kernel.pdf.PdfDocument(new com.itextpdf.kernel.pdf.PdfReader(
                        new ByteArrayInputStream(service.renderPdf(html))))) {
                    var text = new StringBuilder();
                    for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
                        text.append(com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor.getTextFromPage(pdf.getPage(page)));
                    }
                    assertFalse(text.toString().contains("??"), template + " / " + status);
                    assertTrue(text.toString().contains(PORTUGUESE_STATUSES.get(status)), template + " / " + status);
                }
            }
        }
    }
}
