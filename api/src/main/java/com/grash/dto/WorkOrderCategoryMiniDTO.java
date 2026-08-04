package com.grash.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

// Usado no lugar de CategoryMiniDTO especificamente onde category e uma
// WorkOrderCategory (WorkOrderBaseShowDTO, herdado por WorkOrder/Preventive
// Maintenance/Request), para o front conseguir ler as configuracoes de "Tipo
// de Tarefa" (obrigatoriedades, checklist padrao, duracao sugerida) sem uma
// chamada extra a /work-order-categories/{id}.
@SuperBuilder
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class WorkOrderCategoryMiniDTO extends CategoryMiniDTO {
    @Schema(description = "Tolerance time in minutes before the work order is considered late")
    private Integer toleranceMinutes;

    @Schema(description = "Default estimated duration in hours suggested for work orders of this category")
    private Double defaultEstimatedDuration;

    @Schema(description = "Checklist suggested by default for work orders of this category")
    private ChecklistMiniDTO defaultChecklist;

    @Schema(description = "Whether work orders of this category require a signature on completion")
    private boolean requireSignature;

    @Schema(description = "Whether work orders of this category require the signer's name on completion")
    private boolean requireSignerName;

    @Schema(description = "Whether work orders of this category require the signer's CPF/CNPJ on completion")
    private boolean requireSignerDocument;

    @Schema(description = "Whether work orders of this category require at least one photo on completion")
    private boolean requirePhotos;

    @Schema(description = "Whether work orders of this category require the field report on completion")
    private boolean requireFieldReport;

    @Schema(description = "Whether work orders of this category require mileage traveled on completion")
    private boolean requireMileage;

    @Schema(description = "Whether work orders of this category require the checklist to be fully filled on completion")
    private boolean requireChecklistCompletion;
}
