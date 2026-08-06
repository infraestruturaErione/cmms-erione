package com.grash.job;

import com.grash.factory.StorageServiceFactory;
import com.grash.model.GeneratedReport;
import com.grash.repository.GeneratedReportRepository;
import com.grash.service.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.scheduling.quartz.QuartzJobBean;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.List;

// Roda 1x por dia (ver GeneratedReportCleanupJobScheduler). Apaga tanto o
// arquivo no storage quanto o registro no banco pra tudo que passou dos 7
// dias de disponibilidade - o historico so mostra o que ainda pode ser
// baixado, sem lixo acumulando.
@Component
@RequiredArgsConstructor
@Slf4j
public class GeneratedReportCleanupJob extends QuartzJobBean {

    private final GeneratedReportRepository generatedReportRepository;
    private final StorageServiceFactory storageServiceFactory;

    @Override
    protected void executeInternal(JobExecutionContext context) throws JobExecutionException {
        List<GeneratedReport> expired = generatedReportRepository.findByExpiresAtBefore(new Date());
        if (expired.isEmpty()) {
            return;
        }
        log.info("Cleaning up {} expired generated report(s)", expired.size());
        StorageService storageService = storageServiceFactory.getStorageService();
        for (GeneratedReport report : expired) {
            try {
                if (report.getFilePath() != null) {
                    storageService.delete(report.getFilePath());
                }
            } catch (Exception e) {
                log.warn("Failed to delete file for expired report {}: {}", report.getId(), e.getMessage());
            }
        }
        generatedReportRepository.deleteAll(expired);
    }
}
