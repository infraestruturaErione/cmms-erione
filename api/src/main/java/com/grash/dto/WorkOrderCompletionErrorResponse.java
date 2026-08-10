package com.grash.dto;

import com.grash.model.enums.MissingRequirement;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Error response for a work order that does not meet its completion requirements")
public class WorkOrderCompletionErrorResponse {
    @Schema(description = "Always false")
    private boolean success;

    @Schema(description = "Response message")
    private String message;

    @Schema(description = "Stable codes for each unmet completion requirement")
    private List<MissingRequirement> missingRequirements;
}
