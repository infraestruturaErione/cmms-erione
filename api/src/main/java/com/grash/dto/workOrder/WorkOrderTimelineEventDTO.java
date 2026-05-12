package com.grash.dto.workOrder;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "A single event in the work order timeline")
public class WorkOrderTimelineEventDTO {

    @Schema(description = "Timestamp of the event")
    private Date timestamp;

    @Schema(description = "Event type identifier (e.g. STATUS_CHANGE, CHECK_IN, CHECK_OUT, COMMENT)")
    private String type;

    @Schema(description = "Human-readable description of the event")
    private String description;

    @Schema(description = "Name of the user who performed the action")
    private String userName;

    @Schema(description = "Latitude associated with the event (if applicable)")
    private BigDecimal latitude;

    @Schema(description = "Longitude associated with the event (if applicable)")
    private BigDecimal longitude;

    @Schema(description = "Address associated with the event (if applicable)")
    private String address;
}
