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

    // Boolean (nao boolean primitivo) DE PROPOSITO nestes 7 campos: permite
    // ao WorkOrderCategoryMapper diferenciar "omitido" (null - PATCH parcial
    // preserva o valor ja salvo) de "true"/"false" explicito (aplica). Sem
    // isso, um PATCH tipo {"name":"Eletrica"} zerava os 7 requisitos da
    // categoria - o mesmo bug ja corrigido para WorkOrder.requiredSignature
    // (WorkOrderService.enforceRequiredSignatureFromCategory), so que aqui na
    // definicao da categoria, nao na instancia da OS. Ver
    // WorkOrderCategoryMapper.updateWorkOrderCategory para o outro lado desta
    // correcao (nullValuePropertyMappingStrategy=IGNORE por campo).
    @Schema(description = "Whether work orders of this category should require a signature on completion. " +
            "Omit to preserve the existing value; send true/false to change it.")
    private Boolean requireSignature;

    @Schema(description = "Whether work orders of this category should require the signer's name on completion. " +
            "Omit to preserve the existing value; send true/false to change it.")
    private Boolean requireSignerName;

    @Schema(description = "Whether work orders of this category should require the signer's CPF/CNPJ on " +
            "completion. Omit to preserve the existing value; send true/false to change it.")
    private Boolean requireSignerDocument;

    @Schema(description = "Whether work orders of this category should require at least one photo on completion. " +
            "Omit to preserve the existing value; send true/false to change it.")
    private Boolean requirePhotos;

    @Schema(description = "Whether work orders of this category should require the field report/feedback on " +
            "completion. Omit to preserve the existing value; send true/false to change it.")
    private Boolean requireFieldReport;

    @Schema(description = "Whether work orders of this category should require mileage traveled on completion. " +
            "Omit to preserve the existing value; send true/false to change it.")
    private Boolean requireMileage;

    @Schema(description = "Whether work orders of this category should require the checklist to be fully filled " +
            "on completion. Omit to preserve the existing value; send true/false to change it.")
    private Boolean requireChecklistCompletion;
}
