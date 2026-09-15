package com.grash.service;

import com.grash.dto.WorkOrderCategoryPatchDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.WorkOrderCategoryMapper;
import com.grash.model.WorkOrderCategory;
import com.grash.repository.PreventiveMaintenanceRepository;
import com.grash.repository.RequestRepository;
import com.grash.repository.WorkOrderCategoryRepository;
import com.grash.repository.WorkOrderMeterTriggerRepository;
import com.grash.repository.WorkOrderRepository;
import com.grash.repository.WorkflowActionRepository;
import com.grash.repository.WorkflowConditionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class WorkOrderCategoryService {
    private final WorkOrderCategoryRepository workOrderCategoryRepository;

    private final CompanySettingsService companySettingsService;
    private final WorkOrderCategoryMapper workOrderCategoryMapper;
    private final WorkOrderRepository workOrderRepository;
    private final PreventiveMaintenanceRepository preventiveMaintenanceRepository;
    private final RequestRepository requestRepository;
    private final WorkOrderMeterTriggerRepository workOrderMeterTriggerRepository;
    private final WorkflowActionRepository workflowActionRepository;
    private final WorkflowConditionRepository workflowConditionRepository;

    public WorkOrderCategory create(WorkOrderCategory workOrderCategory) {
        Optional<WorkOrderCategory> categoryWithSameName =
                workOrderCategoryRepository.findByNameIgnoreCaseAndCompanySettings_Id(workOrderCategory.getName(),
                        workOrderCategory.getCompanySettings().getId());
        if (categoryWithSameName.isPresent()) {
            throw new CustomException("WorkOrderCategory with same name already exists", HttpStatus.NOT_ACCEPTABLE);
        }
        return workOrderCategoryRepository.save(workOrderCategory);
    }

    public WorkOrderCategory update(Long id, WorkOrderCategoryPatchDTO workOrderCategory) {
        if (workOrderCategoryRepository.existsById(id)) {
            WorkOrderCategory saveWorkOrderCategory = workOrderCategoryRepository.findById(id).get();
            return workOrderCategoryRepository.save(workOrderCategoryMapper.updateWorkOrderCategory(saveWorkOrderCategory, workOrderCategory));
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    public Collection<WorkOrderCategory> getAll() {
        return workOrderCategoryRepository.findAll();
    }

    // F4 - historico operacional (OS, PM, Request, meter trigger) e regras
    // de workflow que referenciam esta Category nao podem ser destruidos por
    // uma exclusao administrativa: work_order/preventive_maintenance/
    // request/work_order_meter_trigger.category_id sao ON DELETE SET NULL
    // (perderiam a categorizacao silenciosamente, sem aviso) e
    // workflow_action/workflow_condition.work_order_category_id sao ON
    // DELETE CASCADE (a regra de automacao seria apagada junto, sem aviso).
    // Mesmo padrao ja usado em ChecklistService.delete() (409 quando em
    // uso) - reaproveitado aqui, nao um mecanismo novo.
    @Transactional
    public void delete(Long id) {
        if (workOrderRepository.existsByCategory_Id(id)
                || preventiveMaintenanceRepository.existsByCategory_Id(id)
                || requestRepository.existsByCategory_Id(id)
                || workOrderMeterTriggerRepository.existsByCategory_Id(id)
                || workflowActionRepository.existsByWorkOrderCategory_Id(id)
                || workflowConditionRepository.existsByWorkOrderCategory_Id(id)) {
            throw new CustomException(
                    "Work order category is in use and cannot be deleted",
                    HttpStatus.CONFLICT);
        }
        workOrderCategoryRepository.deleteById(id);
    }

    public Optional<WorkOrderCategory> findById(Long id) {
        return workOrderCategoryRepository.findById(id);
    }

    public Collection<WorkOrderCategory> findByCompanySettings(Long id) {
        return workOrderCategoryRepository.findByCompanySettings_Id(id);
    }

    public Optional<WorkOrderCategory> findByNameIgnoreCaseAndCompanySettings(String name, Long id) {
        return workOrderCategoryRepository.findByNameIgnoreCaseAndCompanySettings_Id(name, id);
    }
}
