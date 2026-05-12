package com.grash.dto.workOrder.report;

import com.grash.advancedsearch.SearchCriteria;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@NoArgsConstructor
@Schema(description = "Request for the operational work order report")
public class WorkOrderOperationalReportRequestDTO {
    @Schema(description = "Search criteria reused from work order search")
    private SearchCriteria searchCriteria = new SearchCriteria();

    @Schema(description = "Period field used by start/end filters")
    private WorkOrderOperationalReportPeriodField periodField = WorkOrderOperationalReportPeriodField.CREATED_AT;

    @Schema(description = "Period start")
    private Date start;

    @Schema(description = "Period end")
    private Date end;
}
