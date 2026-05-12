package com.grash.dto.workOrder;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Schema(description = "DTO for technician departure action on a work order")
public class WorkOrderDepartDTO {
    @Schema(description = "Latitude when the technician started travel")
    private BigDecimal departureLat;

    @Schema(description = "Longitude when the technician started travel")
    private BigDecimal departureLng;
}
