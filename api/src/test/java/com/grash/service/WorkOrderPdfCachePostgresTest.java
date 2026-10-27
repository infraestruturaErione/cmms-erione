package com.grash.service;

import com.grash.exception.CustomException;
import com.grash.factory.StorageServiceFactory;
import com.grash.model.*;
import com.grash.model.enums.PermissionEntity;
import jakarta.persistence.EntityManager;
import liquibase.*;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Runs only against an explicitly supplied, disposable PostgreSQL test database. */
class WorkOrderPdfCachePostgresTest {
    private static DriverManagerDataSource source;
    private JdbcTemplate jdbc;
    private TransactionTemplate tx;
    private WorkOrderService orders;
    private WorkOrderPdfSnapshotService snapshots;
    private StorageService storage;
    private WorkOrderPdfCacheService cache;
    private StorageServiceFactory factory;
    private EntityManager em;
    private User user;
    private WorkOrder order;
    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();
    private AtomicInteger uploads;

    @BeforeAll
    static void migrateDisposableDatabase() throws Exception {
        String url = System.getProperty("pdf.cache.test.url");
        Assumptions.assumeTrue(url != null, "Supply -Dpdf.cache.test.url for isolated PostgreSQL tests");
        if (!url.endsWith("/pdf_cache_test")) throw new IllegalArgumentException("Requires disposable pdf_cache_test database");
        source = new DriverManagerDataSource(url, "pdf_cache_test", "pdf_cache_test");
        try (var connection = source.getConnection()) {
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            new Liquibase("db/changelog/2026_10_22_00000000001_work_order_pdf_cache.xml",
                    new ClassLoaderResourceAccessor(), database).update(new Contexts(), new LabelExpression());
        }
    }

    @BeforeEach
    void setup() {
        jdbc = new JdbcTemplate(source); jdbc.execute("TRUNCATE work_order_pdf_cache");
        tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        orders = mock(WorkOrderService.class); snapshots = mock(WorkOrderPdfSnapshotService.class);
        storage = mock(StorageService.class); factory = mock(StorageServiceFactory.class); em = mock(EntityManager.class);
        cache = new WorkOrderPdfCacheService(orders, snapshots, factory, jdbc, em, tx);
        user = new User(); Company company = new Company(); company.setId(1L); user.setCompany(company);
        Role role = new Role(); role.setViewPermissions(new HashSet<>(Set.of(PermissionEntity.WORK_ORDERS))); user.setRole(role);
        order = new WorkOrder(); order.setId(10L); order.setCompany(company);
        when(orders.checkAccessToWorkOrderId(10L, user)).thenReturn(order);
        when(factory.getStorageService()).thenReturn(storage);
        when(snapshots.capture(order, user)).thenReturn(new WorkOrderPdfSnapshotService.Snapshot("a".repeat(64), "html", Map.of()));
        when(snapshots.render(any(), eq(order), eq(user), eq(storage)))
                .thenReturn(new WorkOrderPdfSnapshotService.Rendered("%PDF-test".getBytes(), true));
        uploads = new AtomicInteger(); AtomicInteger signatures = new AtomicInteger();
        when(storage.upload(any(), anyString())).thenAnswer(call -> {
            String path = call.getArgument(1) + "/" + uploads.incrementAndGet() + ".pdf";
            objects.put(path, ((org.springframework.web.multipart.MultipartFile) call.getArgument(0)).getBytes());
            return path;
        });
        when(storage.exists(anyString())).thenAnswer(call -> objects.containsKey(call.getArgument(0)));
        when(storage.generateSignedUrl(anyString(), eq(10L))).thenAnswer(call -> call.getArgument(0) + "?signature=" + signatures.incrementAndGet());
        doAnswer(call -> { objects.remove(call.getArgument(0)); return null; }).when(storage).delete(anyString());
    }

    private String get() { return tx.execute(status -> cache.getPdf(10L, user)); }
    private int count() { return jdbc.queryForObject("SELECT COUNT(*) FROM work_order_pdf_cache", Integer.class); }

    @Test
    void reusesFileButRenewsSignedUrlAndWorksAcrossServiceInstances() {
        String first = get();
        cache = new WorkOrderPdfCacheService(orders, snapshots, factory, jdbc, em, tx);
        String second = get();
        assertNotEquals(first, second); assertEquals(first.split("\\?")[0], second.split("\\?")[0]);
        assertEquals(1, uploads.get()); assertEquals(1, count());
        verify(snapshots, times(1)).render(any(), any(), any(), any());
        verify(orders, times(4)).checkAccessToWorkOrderId(10L, user);
    }

    @Test
    void concurrentClicksAcrossInstancesGenerateExactlyOnce() throws Exception {
        var other = new WorkOrderPdfCacheService(orders, snapshots, factory, jdbc, em, tx);
        ExecutorService workers = Executors.newFixedThreadPool(8); CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<String>> requests = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                var service = i % 2 == 0 ? cache : other;
                requests.add(workers.submit(() -> { start.await(); return tx.execute(status -> service.getPdf(10L, user)); }));
            }
            start.countDown(); Set<String> paths = new HashSet<>();
            for (var request : requests) paths.add(request.get(20, TimeUnit.SECONDS).split("\\?")[0]);
            assertEquals(1, paths.size()); assertEquals(1, uploads.get()); assertEquals(1, count());
            verify(snapshots, times(1)).render(any(), any(), any(), any());
        } finally { workers.shutdownNow(); }
    }

    @Test
    void changedFingerprintGeneratesNewFileAndOldVersionExpiresSeparately() {
        String first = get();
        when(snapshots.capture(order, user)).thenReturn(new WorkOrderPdfSnapshotService.Snapshot("b".repeat(64), "changed", Map.of()));
        assertNotEquals(first.split("\\?")[0], get().split("\\?")[0]);
        assertEquals(2, count()); assertEquals(2, uploads.get());
    }

    @Test
    void missingCachedObjectIsRegeneratedWithoutDuplicateMetadata() {
        get(); objects.clear(); get(); assertEquals(2, uploads.get()); assertEquals(1, count());
    }

    @Test
    void deniedPermissionAndRevokedAccessCannotReadCache() {
        get(); clearInvocations(storage, snapshots);
        user.getRole().getViewPermissions().clear();
        assertThrows(CustomException.class, this::get);
        user.getRole().getViewPermissions().add(PermissionEntity.WORK_ORDERS);
        when(orders.checkAccessToWorkOrderId(10L, user)).thenThrow(new CustomException("Denied", HttpStatus.FORBIDDEN));
        assertThrows(CustomException.class, this::get);
        verifyNoInteractions(storage, snapshots); assertEquals(1, count());
    }

    @Test
    void signingFailureRollsBackMetadataAndRemovesOnlyNewDerivative() {
        when(storage.generateSignedUrl(anyString(), anyLong())).thenThrow(new IllegalStateException("Signing failed"));
        assertThrows(IllegalStateException.class, this::get);
        assertEquals(0, count()); assertTrue(objects.isEmpty());
        verify(storage).delete(startsWith("reports/1/individual-cache/10/"));
    }

    @Test
    void incompleteReportsAreTrackedForCleanupButNeverReused() {
        when(snapshots.render(any(), any(), any(), any())).thenReturn(new WorkOrderPdfSnapshotService.Rendered(new byte[]{1}, false));
        get(); get(); assertEquals(2, uploads.get()); assertEquals(2, count());
    }

    @Test
    void expiresOnlyIndividualDerivativesAndKeepsFailedDeletesForRetry() {
        String expiredPath = get().split("\\?")[0];
        jdbc.update("UPDATE work_order_pdf_cache SET expires_at=?", java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
        doThrow(new IllegalStateException("Storage unavailable")).when(storage).delete(expiredPath);
        cache.cleanupExpired(); assertEquals(1, count()); assertTrue(objects.containsKey(expiredPath));
        doAnswer(call -> { objects.remove(call.getArgument(0)); return null; }).when(storage).delete(expiredPath);
        cache.cleanupExpired(); assertEquals(0, count()); assertTrue(objects.isEmpty());
    }

    @Test
    void cleanupRefusesAnyPathOutsideItsOwnPrefixAndLeavesFreshFilesAlone() {
        get(); cache.cleanupExpired(); assertEquals(1, count()); verify(storage, never()).delete(anyString());
        jdbc.update("UPDATE work_order_pdf_cache SET file_path='company 1/evidence.jpg', expires_at=?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
        cache.cleanupExpired(); assertEquals(1, count()); verify(storage, never()).delete(anyString());
    }

    @Test
    void cacheHitRenewsRetentionBeforeCleanup() {
        get(); jdbc.update("UPDATE work_order_pdf_cache SET expires_at=?", java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
        get(); cache.cleanupExpired(); assertEquals(1, count()); assertEquals(1, uploads.get());
        verify(storage, never()).delete(anyString());
    }

    @Test
    void renderingAndUploadFailuresDoNotCreateCacheRows() {
        when(snapshots.render(any(), any(), any(), any())).thenThrow(new IllegalStateException("Render failed"));
        assertThrows(IllegalStateException.class, this::get); assertEquals(0, count());
        verify(storage, never()).upload(any(), anyString());
        doReturn(new WorkOrderPdfSnapshotService.Rendered(new byte[]{1}, true))
                .when(snapshots).render(any(), any(), any(), any());
        doThrow(new IllegalStateException("Upload failed")).when(storage).upload(any(), anyString());
        assertThrows(IllegalStateException.class, this::get); assertEquals(0, count());
    }

    @Test
    void storageExistenceFailureNeverFallsBackToAnUnverifiedLink() {
        get(); when(storage.exists(anyString())).thenThrow(new IllegalStateException("Storage outage"));
        assertThrows(IllegalStateException.class, this::get); assertEquals(1, uploads.get()); assertEquals(1, count());
    }

    @Test
    void identicalContentFromDifferentCompaniesCannotShareTheCache() {
        get(); Company company = new Company(); company.setId(2L); user.setCompany(company); order.setCompany(company);
        String second = get(); assertTrue(second.startsWith("reports/2/individual-cache/10/"));
        assertEquals(2, count()); assertEquals(2, uploads.get());
    }

    @Test
    void physicalMinioObjectIsReusedAndOnlyDerivativeIsDeletedAfterExpiry() throws Exception {
        String endpoint = System.getProperty("pdf.cache.test.minio");
        Assumptions.assumeTrue(endpoint != null, "Supply disposable MinIO endpoint for physical storage check");
        if (!endpoint.contains("erione-pdf-cache-minio-20261022")) throw new IllegalArgumentException("Requires disposable MinIO");
        MinioService minio = new MinioService();
        org.springframework.test.util.ReflectionTestUtils.setField(minio, "minioEndpoint", endpoint);
        org.springframework.test.util.ReflectionTestUtils.setField(minio, "minioPublicEndpoint", endpoint);
        org.springframework.test.util.ReflectionTestUtils.setField(minio, "minioBucket", "pdf-cache-test");
        org.springframework.test.util.ReflectionTestUtils.setField(minio, "minioAccessKey", "pdfcachetest");
        org.springframework.test.util.ReflectionTestUtils.setField(minio, "minioSecretKey", "pdfcachetest2026");
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(minio, "init");
        var physicalStorage = spy(minio); when(factory.getStorageService()).thenReturn(physicalStorage);
        var bytes = new java.io.ByteArrayOutputStream();
        try (var document = new com.itextpdf.layout.Document(new com.itextpdf.kernel.pdf.PdfDocument(
                new com.itextpdf.kernel.pdf.PdfWriter(bytes)))) {
            document.add(new com.itextpdf.layout.element.Paragraph("PDF CACHE - ISOLATED DEV TEST"));
        }
        when(snapshots.render(any(), any(), any(), eq(physicalStorage)))
                .thenReturn(new WorkOrderPdfSnapshotService.Rendered(bytes.toByteArray(), true));
        String sourcePath = physicalStorage.upload(new org.springframework.mock.web.MockMultipartFile(
                "file", "evidence.jpg", "image/jpeg", new byte[]{1, 2, 3}), "company 1");
        String first = get(); String second = get();
        String cachePath = jdbc.queryForObject("SELECT file_path FROM work_order_pdf_cache", String.class);
        assertTrue(first.contains("X-Amz-Signature=")); assertTrue(second.contains("X-Amz-Signature="));
        assertTrue(physicalStorage.exists(cachePath)); assertArrayEquals(bytes.toByteArray(), physicalStorage.download(cachePath));
        verify(physicalStorage, times(1)).upload(any(), eq("reports/1/individual-cache/10"));
        jdbc.update("UPDATE work_order_pdf_cache SET expires_at=?", java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
        cache.cleanupExpired(); assertEquals(0, count()); assertFalse(physicalStorage.exists(cachePath));
        assertTrue(physicalStorage.exists(sourcePath));
        physicalStorage.delete(sourcePath);
    }
}
