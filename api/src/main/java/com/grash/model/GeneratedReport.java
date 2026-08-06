package com.grash.model;

import com.grash.model.abstracts.Audit;
import com.grash.model.enums.GeneratedReportStatus;
import com.grash.model.enums.GeneratedReportType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.util.Date;

// Rastreia cada PDF gerado (hoje so o relatorio em massa) pra alimentar a
// tela "Central de Relatorios": quem pediu, quando, com quais filtros, e por
// quanto tempo ainda fica disponivel pra download antes de ser apagado.
// createdAt/createdBy vem de Audit e ja servem como "data da solicitacao" e
// "quem solicitou" - nao precisa duplicar esses campos aqui.
@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Tracks a generated report file (bulk work order report today) for the download history screen")
public class GeneratedReport extends Audit {
    // IDENTITY (nao AUTO) de proposito: a tabela foi criada via SQL cru com
    // BIGSERIAL (sequencia implicita "generated_report_id_seq"), nao com uma
    // sequencia chamada "generated_report_seq" que GenerationType.AUTO espera
    // por convencao do Hibernate nesse projeto. IDENTITY usa o auto-incremento
    // nativo do Postgres direto, sem exigir sequencia com nome especifico.
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Schema(description = "Unique identifier", accessMode = Schema.AccessMode.READ_ONLY)
    private Long id;

    @Schema(description = "Company that requested this report")
    private Long companyId;

    @Enumerated(EnumType.STRING)
    @Schema(description = "Type of report")
    private GeneratedReportType type;

    @Enumerated(EnumType.STRING)
    @Schema(description = "Generation status - always DONE today since generation is synchronous")
    private GeneratedReportStatus status;

    @Schema(description = "Human-readable summary of the filters used (period, city, CNPJ)")
    private String description;

    @Schema(description = "Storage path of the generated PDF")
    private String filePath;

    @Schema(description = "When the file (and this record) gets deleted")
    private Date expiresAt;
}
