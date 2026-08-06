package com.grash.dto.workOrder.report;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotNull;
import java.util.Date;

@Data
@NoArgsConstructor
@Schema(description = "Request for the bulk work order report (all completed work orders of a city, in a period, " +
        "combined into a single PDF)")
public class WorkOrderBulkReportRequestDTO {
    // Cliente escolhido no dropdown - sempre obrigatorio. O backend decide
    // sozinho se agrupa por cidade (quando esse cliente tem Customer.city
    // preenchido) ou se usa so esse cliente (quando nao tem cidade
    // cadastrada) - o usuario nao precisa entender/preencher cidade pra
    // conseguir gerar o relatorio.
    @Schema(description = "Selected customer id - if that customer has a city set, the report groups every " +
            "customer sharing that city; otherwise it falls back to just this one customer")
    @NotNull
    private Long customerId;

    // Opcional por enquanto (ver Customer.cnpj) - quando informado, restringe
    // ainda mais o grupo de clientes (por cidade ou so o cliente escolhido) a
    // quem tenha esse CNPJ exato.
    @Schema(description = "Optional CNPJ/CPF to narrow the customer group down to a single customer")
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
