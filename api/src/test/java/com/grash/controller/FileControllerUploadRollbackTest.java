package com.grash.controller;

import com.grash.dto.FileShowDTO;
import com.grash.factory.StorageServiceFactory;
import com.grash.mapper.FileMapper;
import com.grash.model.Company;
import com.grash.model.File;
import com.grash.model.Role;
import com.grash.model.Subscription;
import com.grash.model.SubscriptionPlan;
import com.grash.model.User;
import com.grash.model.enums.FileType;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.PlanFeatures;
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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FileControllerUploadRollbackTest {

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
    private final AtomicLong fileIds = new AtomicLong(100L);

    @BeforeEach
    void setUp() {
        controller = new FileController(storageServiceFactory, fileService, userService, taskService,
                workOrderService, fileMapper, licenseService, requestPortalService, rateLimiterService);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.getFeatures().add(PlanFeatures.FILE);
        Subscription subscription = new Subscription();
        subscription.setSubscriptionPlan(plan);
        Company company = new Company();
        company.setId(10L);
        company.setSubscription(subscription);
        Role role = new Role();
        role.getCreatePermissions().add(PermissionEntity.FILES);
        User user = new User();
        user.setId(20L);
        user.setCompany(company);
        user.setRole(role);

        when(licenseService.hasEntitlement(any())).thenReturn(true);
        when(userService.whoami(request)).thenReturn(user);
        when(storageServiceFactory.getStorageService()).thenReturn(storageService);
        when(fileService.create(any(File.class))).thenAnswer(invocation -> {
            File file = invocation.getArgument(0);
            file.setId(fileIds.getAndIncrement());
            return file;
        });
        when(fileMapper.toShowDto(any(File.class))).thenReturn(new FileShowDTO());
    }

    @Test
    void secondStorageUploadFailure_removesOnlyFirstCreatedFileAndObject() {
        RuntimeException uploadFailure = new RuntimeException("second upload failed");
        MultipartFile first = image("first.jpg");
        MultipartFile second = image("second.jpg");
        when(storageService.upload(first, "company 10")).thenReturn("company 10/path-first");
        when(storageService.upload(second, "company 10")).thenThrow(uploadFailure);

        RuntimeException thrown = assertThrows(RuntimeException.class,
                () -> upload(first, second));

        assertSame(uploadFailure, thrown);
        verify(fileService).delete(100L);
        verify(storageService).delete("company 10/path-first");
        verify(storageService, never()).delete("company 10/path-second");
    }

    @Test
    void secondDatabaseSaveFailure_removesFirstRowAndBothUploadedObjects() {
        RuntimeException saveFailure = new RuntimeException("second save failed");
        MultipartFile first = image("first.jpg");
        MultipartFile second = image("second.jpg");
        when(storageService.upload(first, "company 10")).thenReturn("company 10/path-first");
        when(storageService.upload(second, "company 10")).thenReturn("company 10/path-second");
        when(fileService.create(any(File.class)))
                .thenAnswer(invocation -> {
                    File file = invocation.getArgument(0);
                    file.setId(100L);
                    return file;
                })
                .thenThrow(saveFailure);

        RuntimeException thrown = assertThrows(RuntimeException.class,
                () -> upload(first, second));

        assertSame(saveFailure, thrown);
        verify(fileService).delete(100L);
        verify(storageService).delete("company 10/path-first");
        verify(storageService).delete("company 10/path-second");
    }

    @Test
    void firstDatabaseSaveFailure_removesStorageObjectWithoutDeletingPreexistingRows() {
        RuntimeException saveFailure = new RuntimeException("save failed");
        MultipartFile first = image("first.jpg");
        when(storageService.upload(first, "company 10")).thenReturn("company 10/path-first");
        when(fileService.create(any(File.class))).thenThrow(saveFailure);

        RuntimeException thrown = assertThrows(RuntimeException.class,
                () -> upload(first));

        assertSame(saveFailure, thrown);
        verify(fileService, never()).delete(any());
        verify(storageService).delete("company 10/path-first");
    }

    @Test
    void successfulBatchDoesNotRunCleanup() {
        MultipartFile first = image("first.jpg");
        MultipartFile second = image("second.jpg");
        when(storageService.upload(first, "company 10")).thenReturn("company 10/path-first");
        when(storageService.upload(second, "company 10")).thenReturn("company 10/path-second");

        List<FileShowDTO> result = upload(first, second);

        assertEquals(2, result.size());
        verify(fileService, never()).delete(any());
        verify(storageService, never()).delete(any(String.class));
    }

    @Test
    void databaseCleanupFailurePreservesItsStorageObjectAndOriginalException() {
        RuntimeException uploadFailure = new RuntimeException("second upload failed");
        RuntimeException databaseCleanupFailure = new RuntimeException("delete failed");
        MultipartFile first = image("first.jpg");
        MultipartFile second = image("second.jpg");
        when(storageService.upload(first, "company 10")).thenReturn("company 10/path-first");
        when(storageService.upload(second, "company 10")).thenThrow(uploadFailure);
        doThrow(databaseCleanupFailure).when(fileService).delete(100L);

        RuntimeException thrown = assertThrows(RuntimeException.class,
                () -> upload(first, second));

        assertSame(uploadFailure, thrown);
        assertEquals(1, thrown.getSuppressed().length);
        assertSame(databaseCleanupFailure, thrown.getSuppressed()[0]);
        verify(storageService, never()).delete("company 10/path-first");
    }

    private List<FileShowDTO> upload(MultipartFile... files) {
        return controller.handleFileUpload(files, "ignored-client-folder", "true", request,
                FileType.IMAGE, null);
    }

    private MockMultipartFile image(String name) {
        return new MockMultipartFile("files", name, "image/jpeg",
                new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x01});
    }
}
