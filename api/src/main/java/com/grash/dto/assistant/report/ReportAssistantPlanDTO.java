package com.grash.dto.assistant.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportAssistantPlanDTO {
    private ReportAssistantIntent intent;
    private String clarificationQuestion;
    private Long customerId;
    private String customerName;
    private String startDate;
    private String endDate;
    private String periodField;
    private String status;
    private String cnpj;
    private String workOrderCode;
    private String technicianName;
    private String notes;
}
