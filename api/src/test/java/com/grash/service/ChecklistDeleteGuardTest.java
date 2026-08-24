package com.grash.service;

import com.grash.exception.CustomException;
import com.grash.repository.CheckListRepository;
import com.grash.repository.WorkOrderCategoryRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChecklistDeleteGuardTest {

    @Mock
    private CheckListRepository checklistRepository;
    @Mock
    private WorkOrderCategoryRepository workOrderCategoryRepository;
    @Mock
    private CompanySettingsService companySettingsService;
    @Mock
    private TaskBaseService taskBaseService;
    @Mock
    private EntityManager entityManager;
    @Mock
    private LicenseService licenseService;

    @InjectMocks
    private ChecklistService checklistService;

    @Test
    void linkedChecklistCannotBeDeleted() {
        when(workOrderCategoryRepository.existsByDefaultChecklist_Id(10L)).thenReturn(true);

        CustomException exception = assertThrows(CustomException.class,
                () -> checklistService.delete(10L));

        assertEquals(HttpStatus.CONFLICT, exception.getHttpStatus());
        assertEquals("Checklist is linked to a work order category and cannot be deleted",
                exception.getMessage());
        verify(checklistRepository, never()).deleteById(10L);
    }

    @Test
    void unlinkedChecklistCanBeDeleted() {
        when(workOrderCategoryRepository.existsByDefaultChecklist_Id(11L)).thenReturn(false);

        assertDoesNotThrow(() -> checklistService.delete(11L));

        verify(checklistRepository).deleteById(11L);
    }
}
