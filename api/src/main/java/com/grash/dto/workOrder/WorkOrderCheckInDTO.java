package com.grash.dto.workOrder;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Schema(description = "DTO for technician check-in action on a work order")
public class WorkOrderCheckInDTO {
    @Schema(description = "Latitude when the technician checked in")
    private BigDecimal checkInLat;

    @Schema(description = "Longitude when the technician checked in")
    private BigDecimal checkInLng;

    @Schema(description = "Address where the technician checked in")
    private String checkInAddress;
}
