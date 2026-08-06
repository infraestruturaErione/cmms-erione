package com.grash.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.TimeZone;

// Registra o job de limpeza dos relatorios gerados pra rodar todo dia as 3h.
// Horario fixo (sem env var) porque e' manutencao interna, nao precisa ser
// configuravel por instalacao.
@Component
@RequiredArgsConstructor
@Slf4j
@Profile("!test")
public class GeneratedReportCleanupJobScheduler implements ApplicationRunner {

    private static final String DAILY_AT_3AM_CRON = "0 0 3 * * ?";

    private final Scheduler scheduler;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        JobDetail jobDetail = JobBuilder.newJob(GeneratedReportCleanupJob.class)
                .withIdentity("generated-report-cleanup-job", "generated-report-cleanup-group")
                .build();

        CronTrigger trigger = TriggerBuilder.newTrigger()
                .withIdentity("generated-report-cleanup-trigger", "generated-report-cleanup-group")
                .withSchedule(CronScheduleBuilder.cronSchedule(DAILY_AT_3AM_CRON)
                        .inTimeZone(TimeZone.getDefault()))
                .build();

        try {
            if (scheduler.checkExists(jobDetail.getKey())) {
                scheduler.deleteJob(jobDetail.getKey());
            }
            scheduler.scheduleJob(jobDetail, trigger);
            log.info("Generated report cleanup job scheduled successfully (daily at 3am)");
        } catch (SchedulerException e) {
            log.error("Error scheduling generated report cleanup job", e);
        }
    }
}
