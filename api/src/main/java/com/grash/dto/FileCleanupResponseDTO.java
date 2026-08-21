package com.grash.dto;

import com.grash.service.FileService.CleanupSkipReason;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class FileCleanupResponseDTO {
    private List<Long> removed;
    private List<SkippedFile> skipped;

    @Data
    @AllArgsConstructor
    public static class SkippedFile {
        private Long fileId;
        private CleanupSkipReason reason;
    }
}
