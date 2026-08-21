package com.grash.dto.assistant.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportAssistantChatResponseDTO {
    private boolean success;
    private String agentName;
    private String reply;
    private ReportAssistantIntent intent;
    private Long generatedReportId;
    private Date generatedReportRequestedAt;
    private Date generatedReportExpiresAt;
    private Date linkExpiresAt;
    private List<ReportAssistantLinkDTO> links;
}
