package com.grash.dto;

import com.grash.model.Asset;
import com.grash.model.Meter;
import com.grash.model.User;
import com.grash.model.enums.TaskType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotNull;

import java.util.List;

@Data
@NoArgsConstructor
@Schema(description = "Base DTO for task definitions")
public class TaskBaseDTO {
    // Preenchido pelo cliente so no bulk sync de checklist de uma WorkOrder/
    // PreventiveMaintenance existente (PATCH /tasks/work-order/{id} e
    // /tasks/preventive-maintenance/{id}) para identificar qual Task ja
    // existente este item representa, preservando resposta/foto/timestamps
    // ja registrados mesmo que label/tipo/etc tenha mudado. Ignorado em
    // ChecklistService (create/update de template de checklist), onde nao
    // ha Task nenhuma envolvida. Null = item novo.
    @Schema(description = "ID of the existing Task this item represents, when editing a WorkOrder/PreventiveMaintenance checklist that already has answers; null when creating a new item")
    private Long id;

    @Schema(description = "Task label or title")
    @NotNull
    private String label;

    @Schema(description = "Type of task")
    private TaskType taskType = TaskType.SUBTASK;

    @Schema(description = "Assigned user")
    private User user;

    @Schema(description = "Associated asset")
    private Asset asset;

    @Schema(description = "Associated meter")
    private Meter meter;

    @Schema(description = "List of task options")
    private List<String> options;
}

