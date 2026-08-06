package com.grash.dto.workOrder.report;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Date;

@Data
@NoArgsConstructor
@Schema(description = "Request for the bulk work order report (all completed work orders of a city, in a period, " +
        "combined into a single PDF)")
public class WorkOrderBulkReportRequestDTO {
    @Schema(description = "City name, matched against Customer.city (case-insensitive)")
    @NotBlank
    private String city;

    // Opcional por enquanto (ver Customer.cnpj) - quando informado, restringe
    // ainda mais o grupo de clientes da cidade a quem tenha esse CNPJ exato,
    // em vez de trazer todos os clientes daquela cidade.
    @Schema(description = "Optional CNPJ/CPF to narrow the city match down to a single customer")
    private String cnpj;

    @Schema(description = "Period field used by start/end filters")
    private WorkOrderOperationalReportPeriodField periodField = WorkOrderOperationalReportPeriodField.COMPLETED_ON;

    // Periodo obrigatorio de proposito: sem isso o relatorio em massa
    // tenderia a trazer TODAS as OS concluidas historicas de uma cidade de
    // uma vez, o que nao e' o uso pretendido (relatorio de um periodo
    // especifico) e pode gerar um PDF gigante.
    @Schema(description = "Period start (required)")
    @NotNull
    private Date start;

    @Schema(description = "Period end (required)")
    @NotNull
    private Date end;
}
