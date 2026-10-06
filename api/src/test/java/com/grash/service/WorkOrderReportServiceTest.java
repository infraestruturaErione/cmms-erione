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
