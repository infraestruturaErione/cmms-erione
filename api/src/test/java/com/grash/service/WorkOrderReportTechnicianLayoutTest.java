package com.grash.service;

import com.grash.model.Team;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.DateFormat;
import com.grash.model.enums.Status;
import com.grash.repository.CommentRepository;
import com.grash.utils.Utils;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class WorkOrderReportTechnicianLayoutTest {
    @Test
    void oneAssigneeIsCompactAndMultipleOrUnknownAssignmentsKeepTheirRolesInBothReports() throws Exception {
        TaskService tasks = mock(TaskService.class);
        CommentRepository comments = mock(CommentRepository.class);
        WorkOrderReportService service = new WorkOrderReportService(tasks, comments,
                mock(MessageSource.class), mock(Utils.class), new PdfImageOptimizer());
        when(comments.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                anyCollection(), anyString())).thenReturn(List.of());
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/"); resolver.setSuffix(".html"); resolver.setCharacterEncoding("UTF-8");
        TemplateEngine engine = new TemplateEngine(); engine.setTemplateResolver(resolver);
        Map<String, Object> shared = new HashMap<>();
        shared.put("companyName", "Erione CMMS"); shared.put("dateFormat", DateFormat.DDMMYY);
        shared.put("timeZone", "America/Sao_Paulo"); shared.put("utils", mock(Utils.class));
        List<Map<String, Object>> reports = new ArrayList<>();
        List<String> individualBodies = new ArrayList<>();
        Path review = Path.of("target/pdf-technician-layout"); Files.createDirectories(review);
        boolean[] compact = {true, false, true, false, true, false, false, false, false, true};
        for (int i = 0; i < compact.length; i++) {
            User primary = user(1L, "Tecnico Unico");
            User other = user(2L, "Outro Tecnico");
            WorkOrder wo = new WorkOrder(); wo.setId(100L + i); wo.setCustomId("WO-LAYOUT-" + i);
            wo.setTitle("HOMOLOGACAO DEV - cenario " + i); wo.setStatus(Status.COMPLETE);
            wo.setPrimaryUser(primary); wo.setAssignedTo(List.of(primary));
            wo.setExecutionOwner(primary); wo.setCompletedBy(primary);
            switch (i) {
                case 1 -> { wo.setAssignedTo(List.of(primary, other)); wo.setExecutionOwner(other); }
                case 2 -> wo.setPrimaryUser(null);
                case 3 -> wo.setCompletedAssignedUserNames("Tecnico Unico, Outro Tecnico");
                case 4 -> {
                    wo.setAssignedTo(List.of(primary, other));
                    wo.setCompletedAssignedUserNames("Tecnico Unico");
                    Team team = new Team(); team.setName("Equipe registrada"); wo.setTeam(team);
                }
                case 5 -> { wo.setPrimaryUser(null); wo.setAssignedTo(List.of()); wo.setExecutionOwner(null); }
                case 6 -> wo.setCompletedAssignedUserNames("");
                case 7 -> wo.setAssignedTo(List.of(primary, user(2L, "Tecnico Unico")));
                case 8 -> wo.setCompletedAssignedUserNames("Nome historico, ambiguo");
                case 9 -> { wo.setExecutionOwner(other); wo.setCompletedBy(other); }
                default -> { }
            }
            when(tasks.findByWorkOrder(wo.getId())).thenReturn(List.of());
            User finisher = wo.getCompletedBy();
            Map<String, Object> data = service.buildWorkOrderReportVariables(wo, mock(StorageService.class));
            assertEquals(compact[i], data.get("singleAssignedTechnician"), "scenario " + i);
            assertEquals(finisher.getFullName(), data.get("completedByName"));
            assertSame(finisher, wo.getCompletedBy());
            Map<String, Object> individual = new HashMap<>(shared); individual.putAll(data);
            String html = render(engine, "work-order-report", individual);
            individualBodies.add(normalize(html.substring(html.indexOf("<body>") + 6, html.indexOf("</body>"))));
            byte[] pdf = service.renderPdf(html);
            String text = text(pdf);
            assertFalse(text.contains("Trabalhador principal"));
            if (compact[i]) {
                assertTrue(text.contains("Responsável técnico"));
                assertEquals(1, text.split("Tecnico Unico", -1).length - 1);
                assertFalse(text.contains("Operador responsavel"));
                assertFalse(text.contains("Concluido por"));
                assertFalse(text.contains("Trabalhadores atribuidos"));
            } else {
                assertTrue(text.contains("Concluido por"));
                if (i == 1 || i == 3 || i == 7 || i == 8)
                    assertTrue(text.contains("Trabalhadores atribuidos"));
            }
            if (i == 4) assertTrue(text.contains("Equipe registrada"));
            if (i < 2) Files.write(review.resolve(i == 0 ? "individual-single.pdf" : "individual-multiple.pdf"), pdf);
            reports.add(data);
        }
        Map<String, Object> bulk = new HashMap<>(shared);
        bulk.put("workOrderReports", reports); bulk.put("customerLabel", "Cliente DEV");
        bulk.put("periodStart", "16/10/2026"); bulk.put("periodEnd", "16/10/2026");
        String bulkHtml = render(engine, "work-orders-bulk-report", bulk);
        for (String body : individualBodies) assertTrue(normalize(bulkHtml).contains(body));
        byte[] bulkPdf = service.renderPdf(bulkHtml);
        String bulkText = text(bulkPdf);
        for (int i = 0; i < reports.size(); i++) {
            int start = bulkText.indexOf("Codigo da OS WO-LAYOUT-" + i);
            int end = i + 1 < reports.size() ? bulkText.indexOf("Codigo da OS WO-LAYOUT-" + (i + 1)) : bulkText.length();
            assertTrue(start >= 0 && end > start);
            String section = bulkText.substring(start, end);
            assertEquals(!compact[i], section.contains("Concluido por"));
            if (compact[i]) assertEquals(1, section.split("Tecnico Unico", -1).length - 1);
        }
        Files.write(review.resolve("bulk-layout-scenarios.pdf"), bulkPdf);
    }

    private static User user(Long id, String name) {
        User user = new User(); user.setId(id); user.setFirstName(name); user.setLastName(""); return user;
    }

    private static String render(TemplateEngine engine, String template, Map<String, Object> data) {
        Context context = new Context(Locale.forLanguageTag("pt-BR")); context.setVariables(data);
        return engine.process(template, context);
    }

    private static String normalize(String html) {
        return html.replaceAll("(?s)<!--.*?-->", "").replaceAll(">\\s+<", "><").trim();
    }

    private static String text(byte[] bytes) throws Exception {
        try (PdfDocument pdf = new PdfDocument(new PdfReader(new ByteArrayInputStream(bytes)))) {
            StringBuilder text = new StringBuilder();
            for (int page = 1; page <= pdf.getNumberOfPages(); page++)
                text.append(PdfTextExtractor.getTextFromPage(pdf.getPage(page))).append('\n');
            return text.toString();
        }
    }
}
