package com.grash.dto.workOrder.report;

import com.grash.advancedsearch.SearchCriteria;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@Schema(description = "Request for the operational work order report")
public class WorkOrderOperationalReportRequestDTO {
    @Schema(description = "Search criteria reused from work order search")
    private SearchCriteria searchCriteria = new SearchCriteria();

    @Schema(description = "Period field used by start/end filters")
    private WorkOrderOperationalReportPeriodField periodField = WorkOrderOperationalReportPeriodField.CREATED_AT;

    // Data civil (sem hora/fuso), igual WorkOrderBulkReportRequestDTO - o
    // frontend nao deve fingir que a data local ja e' um instante UTC; quem
    // resolve pro instante certo, no fuso configurado da empresa, e' o
    // backend (ver WorkOrderOperationalReportService.addPeriodFilters).
    @Schema(description = "Period start, civil date in the company's configured timezone", example = "2026-08-01")
    private LocalDate start;

    @Schema(description = "Period end, civil date in the company's configured timezone, inclusive", example = "2026-08-31")
    private LocalDate end;
}
