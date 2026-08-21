package com.grash.service;

import com.grash.model.File;
import com.grash.model.Task;
import com.grash.repository.FileReferenceChecker;
import com.grash.repository.FileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static com.grash.service.FileService.CleanupSkipReason.IN_USE;
import static com.grash.service.FileService.CleanupSkipReason.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileServiceCleanupTest {
    @Mock
    private FileRepository fileRepository;
    @Mock
    private FileReferenceChecker fileReferenceChecker;

    private FileService fileService;

    @BeforeEach
    void setUp() {
        fileService = new FileService(fileRepository, fileReferenceChecker);
    }

    @Test
    void ownTenantUnreferencedFileIsDeletedFromDatabase() {
        File file = file(10L, "company 1/file.jpg");
        when(fileRepository.findCleanupCandidate(10L, 1L, 2L)).thenReturn(Optional.of(file));
        when(fileReferenceChecker.isReferenced(10L)).thenReturn(false);

        FileService.CleanupOutcome outcome = fileService.cleanupUnused(10L, 1L, 2L);

        assertTrue(outcome.removed());
        assertEquals("company 1/file.jpg", outcome.path());
        verify(fileRepository).delete(file);
        verify(fileRepository).flush();
    }

    @Test
    void commentOrAnyIncomingEntityReferenceSkipsDeletion() {
        File file = file(11L, "in-use.jpg");
        when(fileRepository.findCleanupCandidate(11L, 1L, 2L)).thenReturn(Optional.of(file));
        when(fileReferenceChecker.isReferenced(11L)).thenReturn(true);

        FileService.CleanupOutcome outcome = fileService.cleanupUnused(11L, 1L, 2L);

        assertFalse(outcome.removed());
        assertEquals(IN_USE, outcome.skipReason());
        verify(fileRepository, never()).delete(file);
    }

    @Test
    void taskAssociationSkipsDeletionWithoutDependingOnReverseForeignKeys() {
        File file = file(12L, "task.jpg");
        file.setTask(new Task());
        when(fileRepository.findCleanupCandidate(12L, 1L, 2L)).thenReturn(Optional.of(file));

        FileService.CleanupOutcome outcome = fileService.cleanupUnused(12L, 1L, 2L);

        assertEquals(IN_USE, outcome.skipReason());
        verify(fileReferenceChecker, never()).isReferenced(12L);
        verify(fileRepository, never()).delete(file);
    }

    @Test
    void otherTenantOtherUploaderAndMissingIdsHaveSameNonDisclosingResult() {
        when(fileRepository.findCleanupCandidate(13L, 1L, 2L)).thenReturn(Optional.empty());

        FileService.CleanupOutcome outcome = fileService.cleanupUnused(13L, 1L, 2L);

        assertFalse(outcome.removed());
        assertEquals(NOT_FOUND, outcome.skipReason());
        assertNull(outcome.path());
        verify(fileReferenceChecker, never()).isReferenced(13L);
        verify(fileRepository, never()).delete(org.mockito.ArgumentMatchers.any(File.class));
    }

    private File file(Long id, String path) {
        File file = new File();
        file.setId(id);
        file.setName("evidence.jpg");
        file.setPath(path);
        return file;
    }
}
