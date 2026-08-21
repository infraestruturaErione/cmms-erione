package com.grash.repository;

import com.grash.model.File;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FileRepository extends JpaRepository<File, Long>, JpaSpecificationExecutor<File> {
    Collection<File> findByCompany_Id(Long id);

    List<File> findByIdIn(List<Long> ids);

    @Query(value = "select * from file where id = :id and company_id = :companyId " +
            "and created_by = :createdBy for update", nativeQuery = true)
    Optional<File> findCleanupCandidate(@Param("id") Long id,
                                        @Param("companyId") Long companyId,
                                        @Param("createdBy") Long createdBy);
}
