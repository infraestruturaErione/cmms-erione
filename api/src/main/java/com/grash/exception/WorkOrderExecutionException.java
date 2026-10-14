package com.grash.exception;

import com.grash.model.WorkOrder;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class WorkOrderExecutionException extends CustomException {
    private final String code;
    private final Long workOrderId;
    private final Long executionOwnerId;
    private final String executionOwnerName;

    public WorkOrderExecutionException(String code, WorkOrder workOrder) {
        super("WORK_ORDER_EXECUTION_COMPLETED".equals(code) ? "Esta OS ja foi concluida."
                : workOrder.getExecutionOwner() == null
                ? "Assuma a execucao desta OS antes de registrar o atendimento."
                : "Esta OS esta sendo executada por " + workOrder.getExecutionOwner().getFullName() + ".",
                HttpStatus.CONFLICT);
        this.code = code;
        this.workOrderId = workOrder.getId();
        this.executionOwnerId = workOrder.getExecutionOwner() == null ? null : workOrder.getExecutionOwner().getId();
        this.executionOwnerName = workOrder.getExecutionOwner() == null ? null : workOrder.getExecutionOwner().getFullName();
    }
}
