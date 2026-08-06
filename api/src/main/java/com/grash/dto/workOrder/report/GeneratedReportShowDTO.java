package com.grash.dto.workOrder.report;

import com.grash.model.enums.GeneratedReportStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Row for the generated-report download history screen")
public class GeneratedReportShowDTO {
    @Schema(description = "Unique identifier", accessMode = Schema.AccessMode.READ_ONLY)
    private Long id;

    @Schema(description = "Human-readable summary of the filters used to generate this report")
    private String description;

    @Schema(description = "Full name of the user who requested the report")
    private String requestedByName;

    @Schema(description = "When the report was requested")
    private Date requestedAt;

    @Schema(description = "Generation status")
    private GeneratedReportStatus status;

    @Schema(description = "When this report (and its file) will be deleted")
    private Date expiresAt;

    @Schema(description = "Whether the file is still downloadable (false once expired)")
    private boolean available;
}
