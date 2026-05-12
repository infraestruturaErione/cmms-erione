package com.grash.dto.workOrder.report;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "Operational work order report response")
public class WorkOrderOperationalReportResponseDTO {
    private List<WorkOrderOperationalReportRowDTO> rows;
    private WorkOrderOperationalReportSummaryDTO summary;
    private PageInfo page;

    @Data
    @Builder
    public static class PageInfo {
        private long totalElements;
        private int totalPages;
        private int pageNum;
        private int pageSize;
    }
}
