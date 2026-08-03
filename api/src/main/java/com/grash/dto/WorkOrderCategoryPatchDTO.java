package com.grash.dto;

import com.grash.model.Checklist;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@Schema(description = "DTO for patching an existing work order category (\"tipo de tarefa\")")
public class WorkOrderCategoryPatchDTO extends CategoryPatchDTO {
    @Schema(description = "Tolerance time in minutes before the work order is considered late")
    private Integer toleranceMinutes;

    @Schema(description = "Default estimated duration in hours suggested to pre-fill the work order's " +
            "estimatedDuration when creating a work order of this category")
    private Double defaultEstimatedDuration;

    @Schema(description = "Checklist suggested by default when creating a work order of this category")
    private Checklist defaultChecklist;

    @Schema(description = "Whether work orders of this category should require a signature on completion")
    private boolean requireSignature;

    @Schema(description = "Whether work orders of this category should require the signer's name on completion")
    private boolean requireSignerName;

    @Schema(description = "Whether work orders of this category should require the signer's CPF/CNPJ on completion")
    private boolean requireSignerDocument;

    @Schema(description = "Whether work orders of this category should require at least one photo on completion")
    private boolean requirePhotos;

    @Schema(description = "Whether work orders of this category should require the field report/feedback on " +
            "completion")
    private boolean requireFieldReport;

    @Schema(description = "Whether work orders of this category should require mileage traveled on completion")
    private boolean requireMileage;

    @Schema(description = "Whether work orders of this category should require the checklist to be fully filled " +
            "on completion")
    private boolean requireChecklistCompletion;
}
