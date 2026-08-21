package com.grash.dto.assistant;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssistantChatMessageDTO {
    @NotBlank
    private String role;

    @NotBlank
    private String content;
}
