package com.grash.exception;

import com.grash.model.enums.MissingRequirement;
import lombok.Getter;

import java.util.List;

@Getter
public class WorkOrderCompletionException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final List<MissingRequirement> missingRequirements;

    public WorkOrderCompletionException(List<MissingRequirement> missingRequirements) {
        super("Work order does not meet completion requirements");
        this.missingRequirements = missingRequirements;
    }
}
