package com.grash.repository;

import com.grash.model.GeneratedReport;
import com.grash.model.enums.GeneratedReportType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Date;
import java.util.List;

import java.util.Optional;

public interface GeneratedReportRepository extends JpaRepository<GeneratedReport, Long> {
    List<GeneratedReport> findByCompanyIdAndTypeOrderByCreatedAtDesc(Long companyId, GeneratedReportType type);

    Optional<GeneratedReport> findTopByCompanyIdAndTypeOrderByCreatedAtDesc(Long companyId, GeneratedReportType type);

    List<GeneratedReport> findByExpiresAtBefore(Date date);
}
