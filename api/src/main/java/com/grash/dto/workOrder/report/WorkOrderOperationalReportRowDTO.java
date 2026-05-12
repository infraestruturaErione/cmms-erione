package com.grash.dto.workOrder.report;

import com.grash.model.enums.Priority;
import com.grash.model.enums.Status;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.Date;
import java.util.List;

@Data
@Builder
@Schema(description = "A single row in the operational work order report")
public class WorkOrderOperationalReportRowDTO {
    private Long id;
    private String customId;
    private String title;
    private String description;
    private List<String> customerNames;
    private String locationName;
    private String assetName;
    private String technicianName;
    private Priority priority;
    private Status status;
    private Date createdAt;
    private Date completedOn;
    private Date departureAt;
    private Date checkInAt;
    private Date checkOutAt;
    private Long travelDurationSeconds;
    private Long siteDurationSeconds;
    private Long totalFieldDurationSeconds;
    private String fieldReport;
    private int filesCount;
    private boolean hasImage;
    private boolean hasSignature;
}
