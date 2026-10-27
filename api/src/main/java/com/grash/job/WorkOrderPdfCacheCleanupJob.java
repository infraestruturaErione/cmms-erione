package com.grash.job;

import com.grash.service.WorkOrderPdfCacheService;
import lombok.RequiredArgsConstructor;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.scheduling.quartz.QuartzJobBean;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@DisallowConcurrentExecution
public class WorkOrderPdfCacheCleanupJob extends QuartzJobBean {
    private final WorkOrderPdfCacheService cache;

    @Override
    protected void executeInternal(JobExecutionContext context) {
        cache.cleanupExpired();
    }
}
