package com.grash.dto.workOrder.report;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum WorkOrderOperationalReportPeriodField {
    CREATED_AT("createdAt"),
    COMPLETED_ON("completedOn"),
    CHECK_IN_AT("checkInAt");

    private final String fieldName;

    WorkOrderOperationalReportPeriodField(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getFieldName() {
        return fieldName;
    }

    @JsonCreator
    public static WorkOrderOperationalReportPeriodField fromString(String value) {
        if (value == null || value.isBlank()) {
            return CREATED_AT;
        }
        for (WorkOrderOperationalReportPeriodField field : values()) {
            if (field.name().equalsIgnoreCase(value) || field.fieldName.equalsIgnoreCase(value)) {
                return field;
            }
        }
        throw new IllegalArgumentException("Invalid operational report periodField: " + value);
    }
}
