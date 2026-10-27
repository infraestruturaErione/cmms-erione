package com.grash.service;

import com.grash.model.*;
import com.grash.model.File;
import com.grash.model.enums.*;
import com.grash.repository.CommentRepository;
import com.grash.utils.Utils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring5.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkOrderPdfSnapshotServiceTest {
    private final TaskService tasks = mock(TaskService.class);
    private final CommentRepository comments = mock(CommentRepository.class);
    private final StorageService storage = mock(StorageService.class);
    private WorkOrderReportService reports;
    private WorkOrderPdfSnapshotService snapshots;
    private SpringTemplateEngine templates;
    private User user;
    private WorkOrder order;
    private Task task;
    private Comment comment;
    private File photo;

    @BeforeEach
    void setup() throws Exception {
        var messages = new ResourceBundleMessageSource();
        messages.setBasename("messages"); messages.setDefaultEncoding("UTF-8");
        reports = spy(new WorkOrderReportService(tasks, comments, messages, new Utils(), new PdfImageOptimizer()));
        var resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/"); resolver.setSuffix(".html"); resolver.setCharacterEncoding("UTF-8");
        templates = new SpringTemplateEngine(); templates.setTemplateResolver(resolver); templates.setMessageSource(messages);
        snapshots = new WorkOrderPdfSnapshotService(reports, templates);
        user = new User(); var company = new Company(); company.setId(1L);
        company.getCompanySettings().getGeneralPreferences().setLanguage(Language.PT_BR); user.setCompany(company);
        order = new WorkOrder(); order.setId(10L); order.setCustomId("WO-DEV-CACHE");
        order.setTitle("Manutencao DEV"); order.setDescription("Descricao original"); order.setStatus(Status.COMPLETE);
        User technician = new User(); technician.setId(2L); technician.setFirstName("Tecnico"); technician.setLastName("DEV");
        order.setPrimaryUser(technician); order.setExecutionOwner(technician); order.setCompletedBy(technician);
        Customer customer = new Customer(); customer.setName("Cliente DEV"); customer.setAddress("Rua A");
        order.setCustomers(new ArrayList<>(List.of(customer)));
        Location location = new Location(); location.setName("Local DEV"); location.setAddress("Endereco A");
        order.setLocation(location); order.setCheckInAt(new Date(100_000)); order.setCheckOutAt(new Date(200_000));
        task = new Task(); task.setId(20L); TaskBase base = new TaskBase(); base.setLabel("Pergunta DEV");
        task.setTaskBase(base); task.setValue("Resposta A");
        photo = new File("Foto DEV.jpg", "company 1/unique-a.jpg", FileType.IMAGE, null, false); photo.setId(30L);
        photo.setUpdatedAt(new Date(123));
        comment = new Comment(); comment.setContent("[Relato em campo] Servico A"); comment.setFiles(new ArrayList<>(List.of(photo)));
        when(tasks.findByWorkOrder(10L)).thenReturn(List.of(task));
        when(comments.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(List.of(10L), "[Relato em campo]"))
                .thenReturn(List.of(comment));
        var bytes = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(16, 16, BufferedImage.TYPE_INT_RGB), "jpg", bytes);
        when(storage.download(anyString())).thenReturn(bytes.toByteArray());
    }

    @Test
    void stableSnapshotDoesNotDownloadOrSignAndIgnoresUnrenderedAuditDates() {
        var first = snapshots.capture(order, user);
        order.setUpdatedAt(new Date());
        assertEquals(first.fingerprint(), snapshots.capture(order, user).fingerprint());
        assertTrue(first.html().contains("urn:erione-pdf-file:"));
        verifyNoInteractions(storage);
    }

    @Test
    void everyDisplayedChangeInvalidatesWithoutDependingOnWorkOrderUpdatedAt() {
        List<Consumer<WorkOrder>> changes = List.of(
                wo -> wo.setDescription("Descricao B"), wo -> task.setValue("Resposta B"),
                wo -> task.setNotes("Nota B"), wo -> task.getTaskBase().setLabel("Pergunta B"),
                wo -> comment.setContent("[Relato em campo] Servico B"),
                wo -> photo.setPath("company 1/unique-b.jpg"), wo -> photo.setUpdatedAt(new Date(124)),
                wo -> comment.getFiles().clear(), wo -> task.getImages().add(photo),
                wo -> wo.setSignature("data:image/png;base64,assinatura"), wo -> wo.setSignerName("Cliente Assinante"),
                wo -> wo.setSignerDocument("Documento DEV"), wo -> wo.getCustomers().get(0).setName("Cliente B"),
                wo -> wo.getCustomers().get(0).setAddress("Rua B"), wo -> wo.getLocation().setAddress("Endereco B"),
                wo -> wo.getPrimaryUser().setFirstName("Executor B"), wo -> wo.setCompletedAssignedUserNames("Equipe congelada"),
                wo -> wo.setCheckOutAt(new Date(350_000)), wo -> wo.setPriority(Priority.HIGH),
                wo -> wo.setStatus(Status.IN_PROGRESS),
                wo -> user.getCompany().getCompanySettings().getGeneralPreferences().setLanguage(Language.EN),
                wo -> user.getCompany().getCompanySettings().getGeneralPreferences().setTimeZone("UTC"),
                wo -> user.getCompany().getCompanySettings().getGeneralPreferences().setDateFormat(DateFormat.MMDDYY));
        for (Consumer<WorkOrder> change : changes) {
            String before = snapshots.capture(order, user).fingerprint();
            change.accept(order);
            assertNotEquals(before, snapshots.capture(order, user).fingerprint(), "Changed rendered data must invalidate");
            assertNull(order.getUpdatedAt());
        }
    }

    @Test
    void hydratedSnapshotMatchesOriginalHtmlAndProducesRealPdf() throws Exception {
        var snapshot = snapshots.capture(order, user);
        var rendered = snapshots.render(snapshot, order, user, storage);
        var variables = new HashMap<>(reports.buildCompanyReportVariables(user));
        variables.putAll(reports.buildWorkOrderReportVariables(order, storage));
        Context context = new Context(com.grash.utils.Helper.getLocale(user)); context.setVariables(variables);
        String originalHtml = templates.process("work-order-report.html", context);
        verify(reports).renderPdf(originalHtml);
        assertTrue(rendered.cacheable());
        try (var pdf = new com.itextpdf.kernel.pdf.PdfDocument(new com.itextpdf.kernel.pdf.PdfReader(
                new ByteArrayInputStream(rendered.bytes())))) {
            String text = com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor.getTextFromPage(pdf.getFirstPage());
            assertTrue(text.contains("Cliente DEV")); assertTrue(text.contains("Resposta A"));
            assertTrue(text.contains("Servico A"));
        }
    }

    @Test
    void missingImageIsNeverCacheableAndRetainsBestEffortBehavior() {
        when(storage.download(anyString())).thenThrow(new IllegalStateException("Temporary outage"));
        var rendered = snapshots.render(snapshots.capture(order, user), order, user, storage);
        assertFalse(rendered.cacheable()); assertTrue(rendered.bytes().length > 1000);
    }

    @Test
    void equalCreationDatesHaveStableQuestionOrderDespiteRepositoryTieReordering() {
        task.setCreatedAt(new Date(1_000));
        Task second = new Task(); second.setId(21L); second.setCreatedAt(new Date(1_000));
        TaskBase base = new TaskBase(); base.setLabel("Segunda pergunta");
        second.setTaskBase(base); second.setValue("Segunda resposta");
        when(tasks.findByWorkOrder(10L)).thenReturn(List.of(task, second));
        var first = snapshots.capture(order, user);
        when(tasks.findByWorkOrder(10L)).thenReturn(List.of(second, task));
        var reordered = snapshots.capture(order, user);
        assertEquals(first.fingerprint(), reordered.fingerprint());
        assertTrue(reordered.html().indexOf("Pergunta DEV") < reordered.html().indexOf("Segunda pergunta"));
        // Creation time remains the primary order, even when IDs were allocated in another order.
        second.setCreatedAt(new Date(500));
        assertNotEquals(first.fingerprint(), snapshots.capture(order, user).fingerprint());
        var variables = reports.buildWorkOrderReportVariables(order, storage);
        assertEquals(List.of(second, task), variables.get("tasks"));
    }
}
