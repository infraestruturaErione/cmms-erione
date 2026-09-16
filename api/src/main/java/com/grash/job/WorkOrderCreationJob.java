package com.grash.job;

import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.model.PreventiveMaintenance;
import com.grash.model.Schedule;
import com.grash.model.Task;
import com.grash.model.TaskBase;
import com.grash.model.TaskOption;
import com.grash.model.WorkOrder;
import com.grash.model.enums.RecurrenceType;
import com.grash.repository.ScheduleRepository;
import com.grash.service.ScheduleService;
import com.grash.service.TaskBaseService;
import com.grash.service.TaskService;
import com.grash.service.WorkOrderService;
import com.grash.utils.Helper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.scheduling.quartz.QuartzJobBean;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class WorkOrderCreationJob extends QuartzJobBean {

    private final ScheduleRepository scheduleRepository;
    private final WorkOrderService workOrderService;
    private final TaskService taskService;
    private final ScheduleService scheduleService;
    private final TaskBaseService taskBaseService;

    @Override
    @Transactional
    public void executeInternal(JobExecutionContext context) throws JobExecutionException {
        Long scheduleId = context.getMergedJobDataMap().getLong("scheduleId");

        // We fetch fresh data from DB to ensure validity
        Schedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null || schedule.isDisabled()) {
            return;
        }
        scheduleService.checkIfWeeklyShouldRun(schedule);

        PreventiveMaintenance preventiveMaintenance = schedule.getPreventiveMaintenance();

        WorkOrderPostDTO workOrder = workOrderService.getWorkOrderFromWorkOrderBase(preventiveMaintenance);
        workOrder.getCustomFields().removeIf(customFieldValue -> !workOrder.getCustomFieldValues()
                .stream().filter(customFieldValue1 -> customFieldValue1.getCustomField().getId().equals(customFieldValue.getId()))
                .findFirst().get().getCustomField().isCopyOnRepeat());

        Collection<Task> tasks = taskService.findByPreventiveMaintenance(preventiveMaintenance.getId());
        workOrder.setParentPreventiveMaintenance(preventiveMaintenance);

        if (schedule.getDueDateDelay() != null) {
            workOrder.setDueDate(Helper.incrementDays(new Date(), schedule.getDueDateDelay()));
        }

        WorkOrder savedWorkOrder = workOrderService.create(workOrder, preventiveMaintenance.getCompany());

        // create() ja pode ter clonado o defaultChecklist da Category pra
        // dentro desta OS (WorkOrderService.applyCategoryDefaults), ANTES
        // deste loop copiar as Tasks proprias da PM. Sem essa checagem, uma
        // pergunta que exista nos dois lugares (Category.defaultChecklist E
        // na lista propria da PM - cenario comum quando o usuario configura
        // a PM usando o mesmo Questionario da categoria) aparecia 2x na OS
        // gerada. So pulamos a copia de uma Task da PM se o CONTEUDO dela
        // (label/tipo/user/asset/meter/opcoes) ja bate com algo que o clone
        // da categoria acabou de criar - Task da PM com conteudo DIFERENTE
        // (pergunta especifica da PM, sem equivalente na categoria) continua
        // sendo copiada normalmente, sem perder customizacao legitima.
        // Mesmo criterio de comparacao ja usado em
        // TaskController.tasksMatch, so' que entre dois TaskBase (nao contra
        // um TaskBaseDTO recebido de uma requisicao).
        List<Task> alreadyOnWorkOrder = taskService.findByWorkOrder(savedWorkOrder.getId());

        tasks.forEach(task -> {
            // Deduplicacao INTOCADA: continua comparando pelo TaskBase
            // ORIGINAL da PM (task.getTaskBase(), antes de qualquer clone) -
            // e' o mesmo objeto que ja era comparado antes desta correcao.
            boolean duplicatesCategoryChecklist = alreadyOnWorkOrder.stream()
                    .anyMatch(existing -> taskBasesMatch(existing.getTaskBase(), task.getTaskBase()));
            if (duplicatesCategoryChecklist) {
                return;
            }
            // Clona a TaskBase da PM antes de criar a Task da OS - mesmo
            // padrao ja usado em WorkOrderService.applyCategoryDefaults pro
            // clone do defaultChecklist da Category. Sem isso, a Task da OS
            // e a Task propria da PM compartilhavam a MESMA linha de
            // TaskBase: editar/excluir a pergunta na PM depois reescrevia
            // (ou apagava, via ON DELETE CASCADE de task.task_base_id)
            // retroativamente toda OS ja gerada que a usou - confirmado por
            // WorkOrderCreationJobPmTaskHistoricalIndependenceTest.
            // company explicita: o Quartz nao tem SecurityContext, entao o
            // @PrePersist de CompanyAudit nao consegue descobrir a empresa
            // sozinho (ver TaskBaseService.cloneForNewOwner).
            TaskBase clonedTaskBase = taskBaseService.cloneForNewOwner(
                    task.getTaskBase(), preventiveMaintenance.getCompany());
            Task copiedTask = new Task(clonedTaskBase, savedWorkOrder, null, task.getValue());
            copiedTask.setCompany(preventiveMaintenance.getCompany());
            taskService.create(copiedTask);
        });

//        log.info("Generated Work Order for Schedule ID: {}", scheduleId);
    }

    private boolean taskBasesMatch(TaskBase a, TaskBase b) {
        if (!Objects.equals(a.getLabel(), b.getLabel())) return false;
        if (!Objects.equals(a.getTaskType(), b.getTaskType())) return false;
        if (!idsMatch(a.getUser() == null ? null : a.getUser().getId(),
                b.getUser() == null ? null : b.getUser().getId())) return false;
        if (!idsMatch(a.getAsset() == null ? null : a.getAsset().getId(),
                b.getAsset() == null ? null : b.getAsset().getId())) return false;
        if (!idsMatch(a.getMeter() == null ? null : a.getMeter().getId(),
                b.getMeter() == null ? null : b.getMeter().getId())) return false;
        return optionLabels(a).equals(optionLabels(b));
    }

    private boolean idsMatch(Long a, Long b) {
        return Objects.equals(a, b);
    }

    private List<String> optionLabels(TaskBase taskBase) {
        if (taskBase.getOptions() == null) return Collections.emptyList();
        return taskBase.getOptions().stream()
                .map(TaskOption::getLabel)
                .sorted()
                .collect(Collectors.toList());
    }
}