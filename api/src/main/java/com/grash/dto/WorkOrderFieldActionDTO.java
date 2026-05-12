package com.grash.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "DTO for field service actions on a work order (start-travel, check-in, check-out)")
public class WorkOrderFieldActionDTO {

    @Schema(description = "Latitude coordinate of the action")
    private BigDecimal latitude;

    @Schema(description = "Longitude coordinate of the action")
    private BigDecimal longitude;

    @Schema(description = "Address where the action took place")
    private String address;

    @Schema(description = "Optional note about the action")
    private String note;
}
