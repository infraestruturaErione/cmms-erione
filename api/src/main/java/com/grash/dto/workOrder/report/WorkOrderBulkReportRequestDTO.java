package com.grash.dto.workOrder.report;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@Schema(description = "Request for the bulk work order report (all completed work orders of the selected customer, " +
        "across every location linked to it, in a period, combined into a single PDF)")
public class WorkOrderBulkReportRequestDTO {
    // Cliente escolhido no dropdown - sempre obrigatorio. A busca fica
    // restrita EXCLUSIVAMENTE a esse customerId: nunca amplia pra outros
    // clientes (nem por cidade, nem por nenhum outro criterio). O relatorio
    // consolida todas as Locations vinculadas a esse cliente - isso e'
    // esperado, Location nao e' filtro desse relatorio.
    @Schema(description = "Selected customer id - the report is restricted exclusively to this customer's work " +
            "orders (across all of its locations); never expanded to any other customer")
    @NotNull
    private Long customerId;

    // Opcional - quando informado, e' so uma CONFERENCIA contra o CNPJ do
    // cliente selecionado (Customer.cnpj). Se nao bater, retorna erro de
    // validacao - nunca troca ou amplia pra outro cliente.
    @Schema(description = "Optional CNPJ/CPF - when provided, must match the selected customer's own CNPJ " +
            "(validation only, never used to look up a different customer)")
    private String cnpj;

    @Schema(description = "Period field used by start/end filters")
    private WorkOrderOperationalReportPeriodField periodField = WorkOrderOperationalReportPeriodField.COMPLETED_ON;

    // Periodo obrigatorio de proposito: sem isso o relatorio em massa
    // tenderia a trazer TODAS as OS concluidas historicas do cliente de uma
    // vez, o que nao e' o uso pretendido (relatorio de um periodo
    // especifico) e pode gerar um PDF gigante.
    //
    // LocalDate (data civil, sem horario/fuso) de proposito: quem escolhe o
    // periodo pensa em dias no calendario da empresa (ex: "01/08 a 31/08"),
    // nao em um instante UTC. O backend e' quem decide, a partir do
    // timezone configurado da empresa, a que instante UTC cada dia civil
    // corresponde - o frontend nao deve fingir que a data local ja e' UTC.
    @Schema(description = "Period start, civil date in the company's configured timezone (required)",
            example = "2026-08-01")
    @NotNull
    private LocalDate start;

    @Schema(description = "Period end, civil date in the company's configured timezone, inclusive (required)",
            example = "2026-08-31")
    @NotNull
    private LocalDate end;
}
