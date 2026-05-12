package com.grash.dto.workOrder;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Schema(description = "DTO for technician check-out action on a work order")
public class WorkOrderCheckOutDTO {
    @Schema(description = "Latitude when the technician checked out")
    private BigDecimal checkOutLat;

    @Schema(description = "Longitude when the technician checked out")
    private BigDecimal checkOutLng;

    @Schema(description = "Address where the technician checked out")
    private String checkOutAddress;
}
