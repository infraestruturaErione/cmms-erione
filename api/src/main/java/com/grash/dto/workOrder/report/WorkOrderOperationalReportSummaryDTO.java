package com.grash.dto.workOrder.report;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "Operational work order report summary for the returned page")
public class WorkOrderOperationalReportSummaryDTO {
    private long total;
    private long open;
    private long enRoute;
    private long inProgress;
    private long onHold;
    private long complete;
    private long withCheckIn;
    private long withCheckOut;
    private long withFieldReport;
    private long withAttachments;
    private long withSignature;
}
