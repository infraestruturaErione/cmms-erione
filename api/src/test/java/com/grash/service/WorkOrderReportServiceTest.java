package com.grash.service;

import com.grash.model.File;
import com.grash.model.Location;
import com.grash.model.Task;
import com.grash.model.WorkOrder;
import com.grash.model.enums.FileType;
import com.grash.model.enums.LocationReferenceType;
import com.grash.repository.CommentRepository;
import com.grash.utils.Utils;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regras PURAS de formatacao usadas no PDF de OS (WorkOrderReportService) -
 * mesmos casos ja cobertos em frontend/src/utils/locationDisplay.test.js
 * (referencia ID/PC) e conceitualmente equivalentes a
 * fieldExecutionRules.ts (distancia/duracao), agora espelhados no backend
 * porque o PDF e' renderizado la'. Nenhum Spring context aqui - metodos
 * static package-private, testados direto.
 */
class WorkOrderReportServiceTest {

    @Test
    void allStatusesRendersOpenAndInProgressWithoutInventingSignatureOrCompletion() throws Exception {
        TaskService tasks = mock(TaskService.class);
        CommentRepository comments = mock(CommentRepository.class);
        var messages = new org.springframework.context.support.ResourceBundleMessageSource();
        messages.setBasename("messages"); messages.setDefaultEncoding("UTF-8");
        var service = new WorkOrderReportService(tasks, comments, messages, new Utils(), new PdfImageOptimizer());
        var resolver = new org.thymeleaf.templateresolver.ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/"); resolver.setSuffix(".html"); resolver.setCharacterEncoding("UTF-8");
        var engine = new org.thymeleaf.spring5.SpringTemplateEngine();
        engine.setTemplateResolver(resolver); engine.setMessageSource(messages);
        var user = new com.grash.model.User(); user.setCompany(new com.grash.model.Company());
        user.getCompany().getCompanySettings().getGeneralPreferences().setLanguage(com.grash.model.enums.Language.PT_BR);
        var variables = new java.util.HashMap<>(service.buildCompanyReportVariables(user));
        var reports = new java.util.ArrayList<Map<String, Object>>();
        for (var status : List.of(com.grash.model.enums.Status.OPEN, com.grash.model.enums.Status.IN_PROGRESS)) {
            var wo = new WorkOrder(); wo.setId((long) status.ordinal()+10); wo.setStatus(status);
            wo.setCustomId("QA-" + status); wo.setTitle("QA " + status); wo.setRequiredSignature(true);
            when(tasks.findByWorkOrder(wo.getId())).thenReturn(List.of());
            when(comments.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(List.of(wo.getId()), "[Relato em campo]"))
                    .thenReturn(List.of());
            reports.add(service.buildWorkOrderReportVariables(wo, mock(StorageService.class)));
        }
        variables.put("workOrderReports", reports); variables.put("includeAllStatuses", true);
        variables.put("customerLabel", "QA CUSTOMER"); variables.put("periodStart", "01/10/2026"); variables.put("periodEnd", "31/10/2026");
        var context = new org.thymeleaf.context.Context(java.util.Locale.forLanguageTag("pt-BR")); context.setVariables(variables);
        String html = engine.process("work-orders-bulk-report", context);
        assertTrue(html.contains("todos os status"));
        byte[] bytes = service.renderPdf(html);
        try (var pdf = new com.itextpdf.kernel.pdf.PdfDocument(new com.itextpdf.kernel.pdf.PdfReader(new ByteArrayInputStream(bytes)))) {
            StringBuilder text = new StringBuilder();
            for (int page=1;page<=pdf.getNumberOfPages();page++) text.append(com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor.getTextFromPage(pdf.getPage(page)));
            assertTrue(text.toString().contains("QA-OPEN")); assertTrue(text.toString().contains("QA-IN_PROGRESS"));
            assertFalse(text.toString().contains("Aceite do servico"));
            assertFalse(text.toString().contains("Concluido por"));
        }
    }

    @Test
    void bulkPreservesEachIndividualReportBodyWithoutLeakingValuesBetweenOrders() throws Exception {
        TaskService tasks = mock(TaskService.class);
        CommentRepository comments = mock(CommentRepository.class);
        WorkOrderReportService service = new WorkOrderReportService(tasks, comments,
                mock(MessageSource.class), mock(Utils.class), new PdfImageOptimizer());
        when(comments.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                anyCollection(), anyString())).thenReturn(List.of());
        org.thymeleaf.templateresolver.ClassLoaderTemplateResolver resolver =
                new org.thymeleaf.templateresolver.ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/"); resolver.setSuffix(".html"); resolver.setCharacterEncoding("UTF-8");
        org.thymeleaf.TemplateEngine engine = new org.thymeleaf.TemplateEngine();
        engine.setTemplateResolver(resolver);
        Map<String, Object> shared = new java.util.HashMap<>();
        shared.put("companyName", "Erione CMMS"); shared.put("dateFormat", com.grash.model.enums.DateFormat.DDMMYY);
        shared.put("timeZone", "America/Sao_Paulo"); shared.put("utils", mock(Utils.class));
        String testImage = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(jpeg(200, 100));
        List<Map<String, Object>> reports = new java.util.ArrayList<>();
        for (int i = 0; i < 3; i++) {
            WorkOrder wo = new WorkOrder(); wo.setId(100L + i); wo.setCustomId("WO-BULK-" + i);
            wo.setTitle("Servico " + i); wo.setStatus(com.grash.model.enums.Status.COMPLETE);
            when(tasks.findByWorkOrder(wo.getId())).thenReturn(List.of());
            if (i < 2) {
                wo.setPrimaryUser(reportUser(1L, "Principal " + i));
                wo.setExecutionOwner(reportUser(2L, "Executor " + i));
                wo.setCompletedBy(reportUser(3L, "Finalizador " + i));
                wo.setCompletedAssignedUserNames("Principal " + i + ", Executor " + i);
                wo.setCompletedTeamName("Equipe congelada " + i);
                wo.setDepartureAt(new Date(0)); wo.setCheckInAt(new Date((i + 6) * 60_000L));
                wo.setCheckOutAt(new Date((i + 20) * 60_000L));
                wo.setSignature(testImage); wo.setSignerName("ASSINATURA SINTETICA DEV " + i);
            }
            Map<String, Object> data = service.buildWorkOrderReportVariables(wo, mock(StorageService.class));
            if (i < 2) {
                Task question = mock(Task.class);
                com.grash.model.TaskBase base = new com.grash.model.TaskBase();
                base.setLabel("Pergunta " + i);
                when(question.getId()).thenReturn(500L + i); when(question.getTaskBase()).thenReturn(base);
                when(question.getTranslatedValue(org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any())).thenReturn("Resposta " + i);
                data.put("tasks", List.of(question));
                data.put("tasksImagesUrls", new java.util.HashMap<>(Map.of(500L + i, new String[]{testImage})));
                data.put("fieldReports", List.of("Relato exclusivo " + i));
                data.put("fieldEvidenceRows", List.of(List.of(Map.of(
                        "image", true, "url", testImage, "note", "Foto exclusiva " + i))));
                data.put("fieldEvidenceCount", 1);
            }
            reports.add(data);
        }
        Map<String, Object> bulkVariables = new java.util.HashMap<>(shared);
        bulkVariables.put("workOrderReports", reports); bulkVariables.put("customerLabel", "Cliente DEV");
        bulkVariables.put("periodStart", "15/10/2026"); bulkVariables.put("periodEnd", "15/10/2026");
        org.thymeleaf.context.Context bulkContext = new org.thymeleaf.context.Context(java.util.Locale.forLanguageTag("pt-BR"));
        bulkContext.setVariables(bulkVariables);
        String bulkHtml = engine.process("work-orders-bulk-report", bulkContext);
        String normalizedBulk = normalizeReportMarkup(bulkHtml);
        for (Map<String, Object> report : reports) {
            Map<String, Object> individualVariables = new java.util.HashMap<>(shared);
            individualVariables.putAll(report);
            org.thymeleaf.context.Context context = new org.thymeleaf.context.Context(java.util.Locale.forLanguageTag("pt-BR"));
            context.setVariables(individualVariables);
            String individualHtml = engine.process("work-order-report", context);
            String body = individualHtml.substring(individualHtml.indexOf("<body>") + 6, individualHtml.indexOf("</body>"));
            assertTrue(normalizedBulk.contains(normalizeReportMarkup(body)),
                    "Bulk must preserve the entire individual body for " + ((WorkOrder) report.get("workOrder")).getCustomId());
        }
        try (com.itextpdf.kernel.pdf.PdfDocument pdf = new com.itextpdf.kernel.pdf.PdfDocument(
                new com.itextpdf.kernel.pdf.PdfReader(new ByteArrayInputStream(service.renderPdf(bulkHtml))))) {
            StringBuilder text = new StringBuilder();
            for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
                text.append(com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor.getTextFromPage(pdf.getPage(page)));
            }
            String all = text.toString();
            for (int i = 0; i < 2; i++) {
                String section = all.substring(all.indexOf("Codigo da OS WO-BULK-" + i),
                        all.indexOf("Codigo da OS WO-BULK-" + (i + 1)));
                for (String expected : List.of("Operador responsavel", "Executor " + i + " Souza",
                        "Finalizador " + i + " Souza", "Equipe congelada " + i, (i + 6) + "min",
                        "Resposta " + i, "Relato exclusivo " + i, "Foto exclusiva " + i,
                        "ASSINATURA SINTETICA DEV " + i)) {
                    assertTrue(section.contains(expected), expected);
                }
                assertFalse(section.contains("Executor " + (1 - i) + " Souza"));
            }
            String legacy = all.substring(all.indexOf("Codigo da OS WO-BULK-2"));
            assertFalse(legacy.contains("Operador responsavel"));
            assertFalse(legacy.contains("Equipe congelada"));
            assertFalse(legacy.contains("Aceite do servico"));
        }
    }

    private static String normalizeReportMarkup(String html) {
        return html.replaceAll("(?s)<!--.*?-->", "").replaceAll(">\\s+<", "><").trim();
    }

    @Test
    void reportDistinguishesOperatorAllExplicitAssigneesAndTeamWithoutInventingMembers() {
        TaskService tasks = mock(TaskService.class);
        CommentRepository comments = mock(CommentRepository.class);
        WorkOrderReportService service = new WorkOrderReportService(tasks, comments,
                mock(MessageSource.class), mock(Utils.class), new PdfImageOptimizer());
        WorkOrder wo = new WorkOrder(); wo.setId(42L); wo.setTitle("Shared OS");
        com.grash.model.User caio = reportUser(1L, "Caio");
        com.grash.model.User ronaldo = reportUser(2L, "Ronaldo");
        com.grash.model.User tecnico = reportUser(3L, "Tecnico Teste");
        com.grash.model.User member = reportUser(4L, "Team-only member");
        wo.setPrimaryUser(caio); wo.setAssignedTo(List.of(caio, ronaldo, tecnico)); wo.setExecutionOwner(ronaldo);
        com.grash.model.Team team = new com.grash.model.Team(); team.setName("Equipe Rodoviario");
        team.setUsers(List.of(member)); wo.setTeam(team);
        when(tasks.findByWorkOrder(42L)).thenReturn(List.of());
        when(comments.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(anyCollection(), anyString())).thenReturn(List.of());
        Map<String, Object> data = service.buildWorkOrderReportVariables(wo, mock(StorageService.class));
        assertEquals(caio.getFullName(), data.get("primaryUserName"));
        assertEquals(ronaldo.getFullName(), data.get("executionOwnerName"));
        assertEquals("Caio Souza, Ronaldo Souza, Tecnico Teste Souza", data.get("assignedUserNames"));
        assertEquals("Equipe Rodoviario", data.get("assignedTeamName"));
        assertFalse(data.get("assignedUserNames").toString().contains(member.getFullName()));
        org.thymeleaf.templateresolver.ClassLoaderTemplateResolver resolver = new org.thymeleaf.templateresolver.ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/"); resolver.setSuffix(".html"); resolver.setCharacterEncoding("UTF-8");
        org.thymeleaf.TemplateEngine engine = new org.thymeleaf.TemplateEngine(); engine.setTemplateResolver(resolver);
        data.put("companyName", "Erione CMMS"); data.put("dateFormat", "dd/MM/yyyy"); data.put("timeZone", "America/Sao_Paulo");
        data.put("utils", mock(Utils.class));
        org.thymeleaf.context.Context context = new org.thymeleaf.context.Context(java.util.Locale.forLanguageTag("pt-BR"));
        context.setVariables(data);
        byte[] pdf = service.renderPdf(engine.process("work-order-report", context));
        try (com.itextpdf.kernel.pdf.PdfDocument document = new com.itextpdf.kernel.pdf.PdfDocument(
                new com.itextpdf.kernel.pdf.PdfReader(new ByteArrayInputStream(pdf)))) {
            String text = com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor.getTextFromPage(document.getFirstPage());
            assertTrue(text.contains("Operador responsavel"));
            assertTrue(text.contains("Ronaldo Souza")); assertTrue(text.contains("Tecnico Teste Souza"));
            assertTrue(text.contains("Equipe Rodoviario"));
        } catch (java.io.IOException exception) { throw new AssertionError(exception); }
        wo.setExecutionOwner(null);
        assertNull(service.buildWorkOrderReportVariables(wo, mock(StorageService.class)).get("executionOwnerName"));
        wo.setStatus(com.grash.model.enums.Status.COMPLETE);
        wo.setCompletedAssignedUserNames("Frozen assignment"); wo.setCompletedTeamName("Frozen team");
        data = service.buildWorkOrderReportVariables(wo, mock(StorageService.class));
        assertEquals("Frozen assignment", data.get("assignedUserNames"));
        assertEquals("Frozen team", data.get("assignedTeamName"));
    }

    private static com.grash.model.User reportUser(Long id, String firstName) {
        com.grash.model.User user = new com.grash.model.User();
        user.setId(id); user.setFirstName(firstName); user.setLastName("Souza"); return user;
    }

    private static Location locationWithReference(LocationReferenceType type, String code, String name, String address) {
        Location location = new Location();
        location.setName(name);
        location.setAddress(address);
        location.setReferenceType(type);
        location.setReferenceCode(code);
        return location;
    }

    @Test
    void locationAddressWithReference_id_prependsCodeWithoutPrefixWord() {
        Location location = locationWithReference(LocationReferenceType.ID, "1019", "Pronto Socorro", "Praca Rui Barbosa, 109");
        assertEquals("ID 1019 - Praca Rui Barbosa, 109",
                WorkOrderReportService.locationAddressWithReference(location));
    }

    @Test
    void locationAddressWithReference_pc_prependsPcCode() {
        Location location = locationWithReference(LocationReferenceType.PC, "04", "Ponto de Coleta", "Rua X, 123");
        assertEquals("PC 04 - Rua X, 123", WorkOrderReportService.locationAddressWithReference(location));
    }

    @Test
    void locationAddressWithReference_withoutReference_isJustAddress() {
        Location location = locationWithReference(null, null, "Pronto Socorro", "Praca Rui Barbosa, 109");
        assertEquals("Praca Rui Barbosa, 109", WorkOrderReportService.locationAddressWithReference(location));
    }

    @Test
    void locationAddressWithReference_typeWithoutCode_isTreatedAsAbsent() {
        Location location = locationWithReference(LocationReferenceType.ID, null, "Pronto Socorro", "Praca Rui Barbosa, 109");
        assertEquals("Praca Rui Barbosa, 109", WorkOrderReportService.locationAddressWithReference(location));
    }

    @Test
    void locationAddressWithReference_neverRendersNullOrPlaceholder() {
        Location location = locationWithReference(null, null, "Sem endereco", "");
        String result = WorkOrderReportService.locationAddressWithReference(location);
        assertEquals("", result);
    }

    @Test
    void locationIdentification_stripsLegacyIdPrefixFromName() {
        Location location = locationWithReference(null, null, "ID 1027 - Camera Praca Central", "Rua X, 1");
        assertEquals("Camera Praca Central", WorkOrderReportService.locationIdentification(location));
    }

    @Test
    void locationIdentification_withoutLegacyPrefix_isUnchanged() {
        Location location = locationWithReference(null, null, "Pronto Socorro", "Rua X, 1");
        assertEquals("Pronto Socorro", WorkOrderReportService.locationIdentification(location));
    }

    @Test
    void distanceLabel_missingCoordinates_isNull() {
        assertNull(WorkOrderReportService.distanceLabel(null, null, BigDecimal.ONE, BigDecimal.ONE));
        assertNull(WorkOrderReportService.distanceLabel(-23.0, -45.0, null, null));
    }

    @Test
    void distanceLabel_underOneKm_showsMeters() {
        String label = WorkOrderReportService.distanceLabel(-23.1896, -45.8841,
                new BigDecimal("-23.19"), new BigDecimal("-45.8841"));
        assertEquals("44 m", label);
    }

    @Test
    void distanceLabel_overOneKm_showsKm() {
        String label = WorkOrderReportService.distanceLabel(-23.1896, -45.8841,
                new BigDecimal("-23.30"), new BigDecimal("-45.90"));
        assertEquals("12.4 km", label);
    }

    @Test
    void durationLabel_missingDates_isNull() {
        assertNull(WorkOrderReportService.durationLabel(null, new Date()));
        assertNull(WorkOrderReportService.durationLabel(new Date(), null));
    }

    @Test
    void durationLabel_endBeforeStart_isNull() {
        Date start = new Date(10_000);
        Date end = new Date(5_000);
        assertNull(WorkOrderReportService.durationLabel(start, end));
    }

    @Test
    void durationLabel_hoursAndMinutes() {
        Date start = new Date(0);
        Date end = new Date((26L * 60 + 52) * 1000); // 26min52s
        assertEquals("26min", WorkOrderReportService.durationLabel(start, end));
    }

    @Test
    void durationLabel_wholeHours() {
        Date start = new Date(0);
        Date end = new Date(2 * 3600 * 1000L);
        assertEquals("2h", WorkOrderReportService.durationLabel(start, end));
    }

    @Test
    void durationLabel_hoursAndMinutesCombined() {
        Date start = new Date(0);
        Date end = new Date((6L * 3600 + 47 * 60 + 41) * 1000);
        assertEquals("6h 47min", WorkOrderReportService.durationLabel(start, end));
    }

    @Test
    void durationLabel_underOneMinute() {
        Date start = new Date(0);
        Date end = new Date(30_000);
        assertEquals("menos de 1 min", WorkOrderReportService.durationLabel(start, end));
    }

    @Test
    @SuppressWarnings("unchecked")
    void reportVariablesUseOptimizedBytesForEvidenceAndChecklistImages() throws Exception {
        TaskService taskService = mock(TaskService.class);
        CommentRepository commentRepository = mock(CommentRepository.class);
        StorageService storageService = mock(StorageService.class);
        WorkOrderReportService service = new WorkOrderReportService(taskService, commentRepository,
                mock(MessageSource.class), mock(Utils.class), new PdfImageOptimizer());

        byte[] original = jpeg(2400, 1200);
        File image = new File();
        image.setId(99L);
        image.setName("iphone-photo.jpg");
        image.setPath("work-orders/iphone-photo.jpg");
        image.setType(FileType.IMAGE);

        Task task = new Task();
        task.setId(11L);
        task.setImages(List.of(image));
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(7L);
        workOrder.setTitle("OS com foto");
        workOrder.setFiles(List.of(image));

        when(taskService.findByWorkOrder(7L)).thenReturn(List.of(task));
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                anyCollection(), anyString())).thenReturn(List.of());
        when(storageService.download(image.getPath())).thenReturn(original);

        Map<String, Object> variables = service.buildWorkOrderReportVariables(workOrder, storageService);
        Map<Long, String[]> taskUrls = (Map<Long, String[]>) variables.get("tasksImagesUrls");
        List<List<Map<String, Object>>> evidenceRows =
                (List<List<Map<String, Object>>>) variables.get("fieldEvidenceRows");
        byte[] taskBytes = dataUriBytes(taskUrls.get(11L)[0]);
        byte[] evidenceBytes = dataUriBytes((String) evidenceRows.get(0).get(0).get("url"));

        assertTrue(taskBytes.length < original.length);
        assertTrue(evidenceBytes.length < original.length);
        assertArrayEquals(taskBytes, evidenceBytes);
        assertNotEquals(Base64.getEncoder().encodeToString(original),
                Base64.getEncoder().encodeToString(taskBytes));
        BufferedImage optimized = ImageIO.read(new ByteArrayInputStream(taskBytes));
        assertEquals(1920, optimized.getWidth());
        assertEquals(960, optimized.getHeight());
        optimized.flush();
        verify(storageService, org.mockito.Mockito.times(2)).download(image.getPath());
    }

    @Test
    @SuppressWarnings("unchecked")
    void corruptImageIsOmittedWithoutBreakingReportVariables() {
        TaskService taskService = mock(TaskService.class);
        CommentRepository commentRepository = mock(CommentRepository.class);
        StorageService storageService = mock(StorageService.class);
        WorkOrderReportService service = new WorkOrderReportService(taskService, commentRepository,
                mock(MessageSource.class), mock(Utils.class), new PdfImageOptimizer());

        File image = new File();
        image.setId(100L);
        image.setName("corrupt-photo.jpg");
        image.setPath("work-orders/corrupt-photo.jpg");
        image.setType(FileType.IMAGE);
        Task task = new Task();
        task.setId(12L);
        task.setImages(List.of(image));
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(8L);
        workOrder.setTitle("OS com imagem corrompida");
        workOrder.setFiles(List.of(image));

        when(taskService.findByWorkOrder(8L)).thenReturn(List.of(task));
        when(commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(
                anyCollection(), anyString())).thenReturn(List.of());
        when(storageService.download(image.getPath())).thenReturn("not-an-image".getBytes());

        Map<String, Object> variables = service.buildWorkOrderReportVariables(workOrder, storageService);
        Map<Long, String[]> taskUrls = (Map<Long, String[]>) variables.get("tasksImagesUrls");
        List<List<Map<String, Object>>> evidenceRows =
                (List<List<Map<String, Object>>>) variables.get("fieldEvidenceRows");

        assertEquals(0, taskUrls.get(12L).length);
        assertEquals(1, evidenceRows.size());
        Map<String, Object> evidence = evidenceRows.get(0).get(0);
        assertFalse((Boolean) evidence.get("image"));
        assertNull(evidence.get("url"));
    }

    private static byte[] dataUriBytes(String dataUri) {
        return Base64.getDecoder().decode(dataUri.substring(dataUri.indexOf(',') + 1));
    }

    private static byte[] jpeg(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(42, 91, 138));
        graphics.fillRect(0, 0, width, height);
        graphics.setColor(Color.WHITE);
        graphics.fillOval(width / 4, height / 4, width / 2, height / 2);
        graphics.dispose();
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpeg", output);
            image.flush();
            return output.toByteArray();
        }
    }
}
