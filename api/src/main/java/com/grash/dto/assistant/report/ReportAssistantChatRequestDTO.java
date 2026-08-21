package com.grash.dto.assistant.report;

import com.grash.dto.assistant.AssistantChatMessageDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportAssistantChatRequestDTO {
    @Valid
    @NotEmpty
    @Builder.Default
    private List<AssistantChatMessageDTO> messages = new ArrayList<>();
}
