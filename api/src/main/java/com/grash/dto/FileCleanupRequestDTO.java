package com.grash.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FileCleanupRequestDTO {
    @NotEmpty
    @Size(max = 100)
    private List<@NotNull Long> fileIds = new ArrayList<>();
}
