package com.grash.service;

import com.grash.model.Location;
import com.grash.model.enums.LocationReferenceType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

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
}
