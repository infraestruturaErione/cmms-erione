package com.grash.controller;

import com.grash.dto.FileCleanupRequestDTO;
import com.grash.dto.FileCleanupResponseDTO;
import com.grash.factory.StorageServiceFactory;
import com.grash.mapper.FileMapper;
import com.grash.model.Company;
import com.grash.model.User;
import com.grash.service.FileService;
import com.grash.service.LicenseService;
import com.grash.service.RateLimiterService;
import com.grash.service.RequestPortalService;
import com.grash.service.StorageService;
import com.grash.service.TaskService;
import com.grash.service.UserService;
import com.grash.service.WorkOrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static com.grash.service.FileService.CleanupSkipReason.IN_USE;
import static com.grash.service.FileService.CleanupSkipReason.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileControllerCleanupTest {
    @Mock
    private StorageServiceFactory storageServiceFactory;
    @Mock
    private StorageService storageService;
    @Mock
    private FileService fileService;
    @Mock
    private UserService userService;
    @Mock
    private TaskService taskService;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private FileMapper fileMapper;
    @Mock
    private LicenseService licenseService;
    @Mock
    private RequestPortalService requestPortalService;
    @Mock
    private RateLimiterService rateLimiterService;
    @Mock
    private HttpServletRequest request;

    private FileController controller;

    @BeforeEach
    void setUp() {
        controller = new FileController(storageServiceFactory, fileService, userService, taskService,
                workOrderService, fileMapper, licenseService, requestPortalService, rateLimiterService);
        Company company = new Company();
        company.setId(1L);
        User user = new User();
        user.setId(2L);
        user.setCompany(company);
        when(userService.whoami(request)).thenReturn(user);
        when(storageServiceFactory.getStorageService()).thenReturn(storageService);
    }

    @Test
    void removableAndInUseFilesProduceExplicitPartialResult() {
        when(fileService.cleanupUnused(10L, 1L, 2L))
                .thenReturn(FileService.CleanupOutcome.removed(10L, "file-10.jpg"));
        when(fileService.cleanupUnused(11L, 1L, 2L))
                .thenReturn(FileService.CleanupOutcome.skipped(11L, IN_USE));

        FileCleanupResponseDTO result = controller.cleanupUnused(request(10L, 11L), request);

        assertEquals(List.of(10L), result.getRemoved());
        assertEquals(1, result.getSkipped().size());
        assertEquals(11L, result.getSkipped().get(0).getFileId());
        assertEquals(IN_USE, result.getSkipped().get(0).getReason());
        verify(storageService).delete("file-10.jpg");
        verify(storageService, never()).delete("file-11.jpg");
    }

    @Test
    void missingOtherTenantAndOtherOwnerRemainNonDisclosing() {
        when(fileService.cleanupUnused(20L, 1L, 2L))
                .thenReturn(FileService.CleanupOutcome.skipped(20L, NOT_FOUND));

        FileCleanupResponseDTO result = controller.cleanupUnused(request(20L), request);

        assertEquals(List.of(), result.getRemoved());
        assertEquals(NOT_FOUND, result.getSkipped().get(0).getReason());
        verify(storageService, never()).delete(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void duplicateIdsAreProcessedOnlyOnce() {
        when(fileService.cleanupUnused(30L, 1L, 2L))
                .thenReturn(FileService.CleanupOutcome.removed(30L, "file-30.jpg"));

        FileCleanupResponseDTO result = controller.cleanupUnused(request(30L, 30L), request);

        assertEquals(List.of(30L), result.getRemoved());
        verify(fileService).cleanupUnused(30L, 1L, 2L);
        verify(storageService).delete("file-30.jpg");
    }

    @Test
    void storageFailureDoesNotRecreateDeletedDatabaseRow() {
        when(fileService.cleanupUnused(40L, 1L, 2L))
                .thenReturn(FileService.CleanupOutcome.removed(40L, "file-40.jpg"));
        doThrow(new RuntimeException("storage unavailable")).when(storageService).delete("file-40.jpg");

        FileCleanupResponseDTO result = controller.cleanupUnused(request(40L), request);

        assertEquals(List.of(40L), result.getRemoved());
        verify(fileService).cleanupUnused(40L, 1L, 2L);
    }

    private FileCleanupRequestDTO request(Long... ids) {
        FileCleanupRequestDTO dto = new FileCleanupRequestDTO();
        dto.setFileIds(List.of(ids));
        return dto;
    }
}
