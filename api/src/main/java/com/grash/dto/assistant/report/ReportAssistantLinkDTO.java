package com.grash.dto.assistant.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportAssistantLinkDTO {
    private String label;
    private String url;
    private String kind;
    private java.util.Date expiresAt;
}
