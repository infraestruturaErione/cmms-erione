package com.grash.configuration;

import com.grash.job.DeleteDemoCompaniesJob;
import com.grash.job.WorkOrderPdfCacheCleanupJob;
import org.quartz.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class QuartzConfig {

    @Bean
    public JobDetail workOrderPdfCacheCleanupJobDetail() {
        return JobBuilder.newJob(WorkOrderPdfCacheCleanupJob.class)
                .withIdentity("individual-pdf-cache-cleanup").storeDurably().build();
    }

    @Bean
    public Trigger workOrderPdfCacheCleanupTrigger() {
        return TriggerBuilder.newTrigger().forJob(workOrderPdfCacheCleanupJobDetail())
                .withIdentity("individual-pdf-cache-cleanup-trigger")
                .startAt(new java.util.Date(System.currentTimeMillis() + 15 * 60_000L))
                .withSchedule(SimpleScheduleBuilder.simpleSchedule().withIntervalInMinutes(15).repeatForever())
                .build();
    }

    @Bean
    public JobDetail deleteDemoCompaniesJobDetail() {
        return JobBuilder.newJob(DeleteDemoCompaniesJob.class)
                .withIdentity("deleteDemoCompaniesJob")
                .storeDurably()
                .build();
    }
    @Bean
    public Trigger deleteDemoCompaniesTrigger() {
        return TriggerBuilder.newTrigger()
                .forJob(deleteDemoCompaniesJobDetail())
                .withIdentity("deleteDemoCompaniesTrigger")
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInHours(1)
                        .repeatForever())
                .build();
    }
}
