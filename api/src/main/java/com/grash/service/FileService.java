package com.grash.service;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.advancedsearch.SpecificationBuilder;
import com.grash.model.File;
import com.grash.repository.FileReferenceChecker;
import com.grash.repository.FileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FileService {
    private final FileRepository fileRepository;
    private final FileReferenceChecker fileReferenceChecker;
    private AssetService assetService;
    private PartService partService;
    private RequestService requestService;
    private WorkOrderService workOrderService;
    private LocationService locationService;

    @Autowired
    public void setDeps(@Lazy AssetService assetService, @Lazy PartService partService,
                        @Lazy RequestService requestService, @Lazy LocationService locationService,
                        @Lazy WorkOrderService workOrderService
    ) {
        this.assetService = assetService;
        this.partService = partService;
        this.requestService = requestService;
        this.locationService = locationService;
        this.workOrderService = workOrderService;
    }

    public File create(File File) {
        return fileRepository.save(File);
    }

    public File update(File File) {
        return fileRepository.save(File);
    }

    public Collection<File> getAll() {
        return fileRepository.findAll();
    }

    public void delete(Long id) {
        fileRepository.deleteById(id);
    }

    public Optional<File> findById(Long id) {
        return fileRepository.findById(id);
    }

    /**
     * Deletes one explicitly requested File only when it belongs to the given
     * tenant/uploader and no database entity references it. The pessimistic
     * lock stays held through the reference check and DB deletion; storage is
     * intentionally handled by the controller only after this transaction
     * commits.
     */
    @Transactional
    public CleanupOutcome cleanupUnused(Long id, Long companyId, Long uploaderId) {
        Optional<File> candidate = fileRepository.findCleanupCandidate(id, companyId, uploaderId);
        if (candidate.isEmpty()) {
            return CleanupOutcome.skipped(id, CleanupSkipReason.NOT_FOUND);
        }

        File file = candidate.get();
        // File.task is an outgoing FK, so it is not returned by the exported-key
        // metadata used for all incoming references.
        if (file.getTask() != null || fileReferenceChecker.isReferenced(id)) {
            return CleanupOutcome.skipped(id, CleanupSkipReason.IN_USE);
        }

        String path = file.getPath();
        fileRepository.delete(file);
        fileRepository.flush();
        return CleanupOutcome.removed(id, path);
    }

    public Collection<File> findByCompany(Long id) {
        return fileRepository.findByCompany_Id(id);
    }

    public Page<File> findBySearchCriteria(SearchCriteria searchCriteria) {
        SpecificationBuilder<File> builder = new SpecificationBuilder<>();
        searchCriteria.getFilterFields().forEach(builder::with);
        Pageable page = PageRequest.of(searchCriteria.getPageNum(), searchCriteria.getPageSize(),
                searchCriteria.getDirection(), searchCriteria.getSortField());
        return fileRepository.findAll(builder.build(), page);
    }

    public enum CleanupSkipReason {
        IN_USE,
        NOT_FOUND
    }

    public record CleanupOutcome(Long fileId, String path, CleanupSkipReason skipReason) {
        public static CleanupOutcome removed(Long fileId, String path) {
            return new CleanupOutcome(fileId, path, null);
        }

        public static CleanupOutcome skipped(Long fileId, CleanupSkipReason reason) {
            return new CleanupOutcome(fileId, null, reason);
        }

        public boolean removed() {
            return skipReason == null;
        }
    }
}
