package com.grash.service;

import com.grash.exception.CustomException;
import com.grash.factory.StorageServiceFactory;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.PermissionEntity;
import com.grash.utils.MultipartFileImpl;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.ByteBuffer;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkOrderPdfCacheService {
    private static final Duration RETENTION = Duration.ofDays(7);
    private final WorkOrderService workOrders;
    private final WorkOrderPdfSnapshotService snapshots;
    private final StorageServiceFactory storageFactory;
    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;
    private final TransactionTemplate transactions;

    @Transactional
    public String getPdf(Long id, User user) {
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS)) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        WorkOrder workOrder = workOrders.checkAccessToWorkOrderId(id, user);
        Long companyId = user.getCompany().getId();
        lock(companyId, id);
        // A request may have waited for another generator; don't use its old managed WO.
        entityManager.refresh(workOrder);
        workOrders.checkAccessToWorkOrderId(id, user);
        var snapshot = snapshots.capture(workOrder, user);
        StorageService storage = storageFactory.getStorageService();
        List<String> paths = jdbc.queryForList("SELECT file_path FROM work_order_pdf_cache "
                        + "WHERE company_id=? AND work_order_id=? AND fingerprint=?",
                String.class, companyId, id, snapshot.fingerprint());
        Timestamp expiry = Timestamp.from(Instant.now().plus(RETENTION));
        if (!paths.isEmpty() && paths.get(0).startsWith(folder(companyId, id) + "/")
                && storage.exists(paths.get(0))) {
            jdbc.update("UPDATE work_order_pdf_cache SET expires_at=? "
                            + "WHERE company_id=? AND work_order_id=? AND fingerprint=?",
                    expiry, companyId, id, snapshot.fingerprint());
            return storage.generateSignedUrl(paths.get(0), 10);
        }

        var rendered = snapshots.render(snapshot, workOrder, user, storage);
        String path = storage.upload(new MultipartFileImpl(rendered.bytes(), "Work Order Report.pdf"),
                folder(companyId, id));
        // Storage is not transactional. Remove only this new derivative if DB/signing fails.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    try { storage.delete(path); }
                    catch (Exception e) { log.warn("Failed to remove rolled-back PDF cache object {}", path, e); }
                }
            }
        });
        String fingerprint = rendered.cacheable() ? snapshot.fingerprint()
                : WorkOrderPdfSnapshotService.sha256(snapshot.fingerprint() + UUID.randomUUID());
        jdbc.update("INSERT INTO work_order_pdf_cache (company_id,work_order_id,fingerprint,file_path,expires_at) "
                        + "VALUES (?,?,?,?,?) ON CONFLICT (company_id,work_order_id,fingerprint) "
                        + "DO UPDATE SET file_path=EXCLUDED.file_path, expires_at=EXCLUDED.expires_at",
                companyId, id, fingerprint, path, expiry);
        return storage.generateSignedUrl(path, 10);
    }

    // Both generation and maintenance use the SAME transaction-scoped cross-instance lock.
    void lock(Long companyId, Long id) {
        long key = ByteBuffer.wrap(HexFormat.of().parseHex(WorkOrderPdfSnapshotService.sha256(
                "individual-pdf:" + companyId + ":" + id))).getLong();
        jdbc.execute("SET LOCAL lock_timeout = '30s'");
        jdbc.query("SELECT pg_advisory_xact_lock(?)", result -> { return null; }, key);
    }

    public void cleanupExpired() {
        List<Expired> expired = jdbc.query("SELECT company_id,work_order_id,fingerprint FROM work_order_pdf_cache "
                        + "WHERE expires_at < CURRENT_TIMESTAMP ORDER BY expires_at LIMIT 100",
                (row, index) -> new Expired(row.getLong(1), row.getLong(2), row.getString(3)));
        for (Expired candidate : expired) {
            try {
                transactions.executeWithoutResult(status -> {
                    lock(candidate.companyId(), candidate.workOrderId());
                    List<String> paths = jdbc.queryForList("SELECT file_path FROM work_order_pdf_cache "
                                    + "WHERE company_id=? AND work_order_id=? AND fingerprint=? "
                                    + "AND expires_at < CURRENT_TIMESTAMP",
                            String.class, candidate.companyId(), candidate.workOrderId(), candidate.fingerprint());
                    if (paths.isEmpty()) return;
                    String path = paths.get(0);
                    if (!path.startsWith(folder(candidate.companyId(), candidate.workOrderId()) + "/")) {
                        throw new IllegalStateException("Refusing to delete outside individual PDF cache");
                    }
                    storageFactory.getStorageService().delete(path);
                    jdbc.update("DELETE FROM work_order_pdf_cache WHERE company_id=? AND work_order_id=? AND fingerprint=?",
                            candidate.companyId(), candidate.workOrderId(), candidate.fingerprint());
                });
            } catch (Exception e) {
                // Keep the row to retry. Never delete evidence/signatures/OS or bulk objects.
                log.warn("Failed to expire individual PDF cache for WO {}", candidate.workOrderId(), e);
            }
        }
    }

    private static String folder(Long companyId, Long id) {
        return "reports/" + companyId + "/individual-cache/" + id;
    }

    private record Expired(Long companyId, Long workOrderId, String fingerprint) { }
}
