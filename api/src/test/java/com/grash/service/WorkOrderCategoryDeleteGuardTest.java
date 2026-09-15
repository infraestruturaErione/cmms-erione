package com.grash.service;

import com.grash.exception.CustomException;
import com.grash.mapper.WorkOrderCategoryMapper;
import com.grash.repository.PreventiveMaintenanceRepository;
import com.grash.repository.RequestRepository;
import com.grash.repository.WorkOrderCategoryRepository;
import com.grash.repository.WorkOrderMeterTriggerRepository;
import com.grash.repository.WorkOrderRepository;
import com.grash.repository.WorkflowActionRepository;
import com.grash.repository.WorkflowConditionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * F4 - excluir uma WorkOrderCategory referenciada por historico operacional
 * (OS/PM/Request/meter trigger) ou por regras de Workflow nao pode destruir
 * esse vinculo silenciosamente (SET NULL/CASCADE no schema). Mesmo padrao ja
 * usado em ChecklistDeleteGuardTest.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkOrderCategoryDeleteGuardTest {

    @Mock
    private WorkOrderCategoryRepository workOrderCategoryRepository;
    @Mock
    private CompanySettingsService companySettingsService;
    @Mock
    private WorkOrderCategoryMapper workOrderCategoryMapper;
    @Mock
    private WorkOrderRepository workOrderRepository;
    @Mock
    private PreventiveMaintenanceRepository preventiveMaintenanceRepository;
    @Mock
    private RequestRepository requestRepository;
    @Mock
    private WorkOrderMeterTriggerRepository workOrderMeterTriggerRepository;
    @Mock
    private WorkflowActionRepository workflowActionRepository;
    @Mock
    private WorkflowConditionRepository workflowConditionRepository;

    @InjectMocks
    private WorkOrderCategoryService workOrderCategoryService;

    private void stubAllUsesFalse(Long id) {
        when(workOrderRepository.existsByCategory_Id(id)).thenReturn(false);
        when(preventiveMaintenanceRepository.existsByCategory_Id(id)).thenReturn(false);
        when(requestRepository.existsByCategory_Id(id)).thenReturn(false);
        when(workOrderMeterTriggerRepository.existsByCategory_Id(id)).thenReturn(false);
        when(workflowActionRepository.existsByWorkOrderCategory_Id(id)).thenReturn(false);
        when(workflowConditionRepository.existsByWorkOrderCategory_Id(id)).thenReturn(false);
    }

    // 1) Category sem uso nenhum -> exclusao permitida.
    @Test
    void unusedCategory_canBeDeleted() {
        stubAllUsesFalse(1L);

        assertDoesNotThrow(() -> workOrderCategoryService.delete(1L));

        verify(workOrderCategoryRepository).deleteById(1L);
    }

    // 2) Category usada por WorkOrder -> exclusao recusada, WorkOrder
    // historica permanece intacta (deleteById nunca chamado).
    @Test
    void categoryUsedByWorkOrder_deletionIsRefused() {
        stubAllUsesFalse(2L);
        when(workOrderRepository.existsByCategory_Id(2L)).thenReturn(true);

        CustomException exception = assertThrows(CustomException.class,
                () -> workOrderCategoryService.delete(2L));

        assertEquals(HttpStatus.CONFLICT, exception.getHttpStatus());
        verify(workOrderCategoryRepository, never()).deleteById(2L);
    }

    // 3) Category usada por PreventiveMaintenance -> tambem recusada.
    @Test
    void categoryUsedByPreventiveMaintenance_deletionIsRefused() {
        stubAllUsesFalse(3L);
        when(preventiveMaintenanceRepository.existsByCategory_Id(3L)).thenReturn(true);

        assertThrows(CustomException.class, () -> workOrderCategoryService.delete(3L));
        verify(workOrderCategoryRepository, never()).deleteById(3L);
    }

    // 4) Category usada por Request -> tambem recusada.
    @Test
    void categoryUsedByRequest_deletionIsRefused() {
        stubAllUsesFalse(4L);
        when(requestRepository.existsByCategory_Id(4L)).thenReturn(true);

        assertThrows(CustomException.class, () -> workOrderCategoryService.delete(4L));
        verify(workOrderCategoryRepository, never()).deleteById(4L);
    }

    // 5) Category usada por WorkOrderMeterTrigger -> tambem recusada.
    @Test
    void categoryUsedByMeterTrigger_deletionIsRefused() {
        stubAllUsesFalse(5L);
        when(workOrderMeterTriggerRepository.existsByCategory_Id(5L)).thenReturn(true);

        assertThrows(CustomException.class, () -> workOrderCategoryService.delete(5L));
        verify(workOrderCategoryRepository, never()).deleteById(5L);
    }

    // 6) Category referenciada por uma WorkflowAction -> recusada (senao a
    // regra de automacao seria apagada em cascata silenciosamente).
    @Test
    void categoryUsedByWorkflowAction_deletionIsRefused() {
        stubAllUsesFalse(6L);
        when(workflowActionRepository.existsByWorkOrderCategory_Id(6L)).thenReturn(true);

        CustomException exception = assertThrows(CustomException.class,
                () -> workOrderCategoryService.delete(6L));
        assertEquals(HttpStatus.CONFLICT, exception.getHttpStatus());
        verify(workOrderCategoryRepository, never()).deleteById(6L);
    }

    // 7) Category referenciada por uma WorkflowCondition -> recusada.
    @Test
    void categoryUsedByWorkflowCondition_deletionIsRefused() {
        stubAllUsesFalse(7L);
        when(workflowConditionRepository.existsByWorkOrderCategory_Id(7L)).thenReturn(true);

        assertThrows(CustomException.class, () -> workOrderCategoryService.delete(7L));
        verify(workOrderCategoryRepository, never()).deleteById(7L);
    }

    // 8) Mensagem de erro e previsivel/tratavel pelo frontend (mesma
    // estrutura ja usada por ChecklistService.delete()).
    @Test
    void refusalMessage_isPredictable() {
        stubAllUsesFalse(8L);
        when(workOrderRepository.existsByCategory_Id(8L)).thenReturn(true);

        CustomException exception = assertThrows(CustomException.class,
                () -> workOrderCategoryService.delete(8L));

        assertEquals("Work order category is in use and cannot be deleted", exception.getMessage());
    }
}
