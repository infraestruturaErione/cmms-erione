package com.grash.controller;

import com.grash.dto.ChecklistPatchDTO;
import com.grash.dto.ChecklistPostDTO;
import com.grash.dto.WorkOrderCategoryPatchDTO;
import com.grash.exception.CustomException;
import com.grash.model.*;
import com.grash.model.enums.PermissionEntity;
import com.grash.service.ChecklistService;
import com.grash.service.UserService;
import com.grash.service.WorkOrderCategoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import jakarta.servlet.http.HttpServletRequest;

import java.util.HashSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ChecklistAndWorkOrderCategoryAuthorizationTest {

    @Mock
    private ChecklistService checklistService;
    @Mock
    private WorkOrderCategoryService workOrderCategoryService;
    @Mock
    private UserService userService;
    @Mock
    private HttpServletRequest req;

    @InjectMocks
    private ChecklistController checklistController;
    @InjectMocks
    private WorkOrderCategoryController workOrderCategoryController;

    private User user(Long id,
                      HashSet<PermissionEntity> createPermissions,
                      HashSet<PermissionEntity> editOtherPermissions,
                      HashSet<PermissionEntity> viewPermissions) {
        User user = new User();
        user.setId(id);
        Role role = Role.builder()
                .createPermissions(createPermissions)
                .editOtherPermissions(editOtherPermissions)
                .viewPermissions(viewPermissions)
                .deleteOtherPermissions(new HashSet<>())
                .build();
        user.setRole(role);
        Company company = new Company();
        company.setId(2L);
        CompanySettings companySettings = new CompanySettings();
        companySettings.setId(2L);
        companySettings.setCompany(company);
        company.setCompanySettings(companySettings);
        Subscription subscription = new Subscription();
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setFeatures(new HashSet<>());
        plan.getFeatures().add(com.grash.model.enums.PlanFeatures.CHECKLIST);
        subscription.setSubscriptionPlan(plan);
        company.setSubscription(subscription);
        user.setCompany(company);
        return user;
    }

    private Checklist checklist(Long companyId) {
        Checklist checklist = new Checklist();
        Company company = new Company();
        company.setId(companyId);
        CompanySettings companySettings = new CompanySettings();
        companySettings.setId(companyId);
        companySettings.setCompany(company);
        checklist.setCompanySettings(companySettings);
        return checklist;
    }

    private WorkOrderCategory category(Long createdBy, Long companyId) {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(10L);
        category.setCreatedBy(createdBy);
        Company company = new Company();
        company.setId(companyId);
        CompanySettings companySettings = new CompanySettings();
        companySettings.setId(companyId);
        companySettings.setCompany(company);
        category.setCompanySettings(companySettings);
        return category;
    }

    private HashSet<PermissionEntity> permissions(PermissionEntity... permissions) {
        return new HashSet<>(java.util.Arrays.asList(permissions));
    }

    @Test
    void checklist_settingsOnlyCannotCreate() {
        User settingsOnly = user(1L, new HashSet<>(), new HashSet<>(), permissions(PermissionEntity.SETTINGS));
        when(userService.whoami(req)).thenReturn(settingsOnly);

        CustomException ex = assertThrows(CustomException.class,
                () -> checklistController.create(new ChecklistPostDTO(), req));
        assertTrue(ex.getMessage().contains("Access denied"));
    }

    @Test
    void checklist_settingsOnlyCannotPatch() {
        User settingsOnly = user(7L, new HashSet<>(), new HashSet<>(), permissions(PermissionEntity.SETTINGS));
        when(userService.whoami(req)).thenReturn(settingsOnly);
        when(checklistService.findById(6L)).thenReturn(Optional.of(checklist(2L)));

        CustomException ex = assertThrows(CustomException.class,
                () -> checklistController.patch(new ChecklistPatchDTO(), 6L, req));
        assertTrue(ex.getMessage().contains("Forbidden"));
    }

    @Test
    void checklist_createCategoriesCanCreateAndPatch() {
        User creator = user(2L,
                permissions(PermissionEntity.CATEGORIES),
                new HashSet<>(),
                new HashSet<>());
        when(userService.whoami(req)).thenReturn(creator);
        when(checklistService.createPost(any(), eq(creator.getCompany()))).thenReturn(checklist(2L));
        when(checklistService.findById(5L)).thenReturn(Optional.of(checklist(2L)));
        when(checklistService.update(eq(5L), any(ChecklistPatchDTO.class), eq(creator.getCompany()))).thenReturn(checklist(2L));

        assertDoesNotThrow(() -> checklistController.create(new ChecklistPostDTO(), req));
        assertDoesNotThrow(() -> checklistController.patch(new ChecklistPatchDTO(), 5L, req));
    }

    @Test
    void checklist_deleteOutsideCompanyIsForbiddenBeforeDelete() {
        User creator = user(2L,
                permissions(PermissionEntity.CATEGORIES),
                new HashSet<>(),
                new HashSet<>());
        when(userService.whoami(req)).thenReturn(creator);
        when(checklistService.findById(6L)).thenReturn(Optional.of(checklist(99L)));

        CustomException ex = assertThrows(CustomException.class,
                () -> checklistController.delete(6L, req));

        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, ex.getHttpStatus());
        verify(checklistService, never()).delete(6L);
    }

    @Test
    void workOrderCategory_createCategoriesOnlyCannotEditForeignCategory() {
        User creatorOnly = user(3L,
                permissions(PermissionEntity.CATEGORIES),
                new HashSet<>(),
                permissions(PermissionEntity.CATEGORIES));
        when(userService.whoami(req)).thenReturn(creatorOnly);
        when(workOrderCategoryService.findById(10L)).thenReturn(Optional.of(category(99L, 2L)));

        CustomException ex = assertThrows(CustomException.class,
                () -> workOrderCategoryController.patch(new WorkOrderCategoryPatchDTO(), 10L, req));
        assertTrue(ex.getMessage().contains("Access Denied"));
    }

    @Test
    void workOrderCategory_ownerCanEditOwnCategory() {
        User owner = user(4L,
                permissions(PermissionEntity.CATEGORIES),
                new HashSet<>(),
                permissions(PermissionEntity.CATEGORIES));
        WorkOrderCategory own = category(4L, 2L);
        when(userService.whoami(req)).thenReturn(owner);
        when(workOrderCategoryService.findById(11L)).thenReturn(Optional.of(own));
        when(workOrderCategoryService.update(eq(11L), any(WorkOrderCategoryPatchDTO.class))).thenReturn(own);

        assertDoesNotThrow(() -> workOrderCategoryController.patch(new WorkOrderCategoryPatchDTO(), 11L, req));
    }

    @Test
    void workOrderCategory_editOtherPermissionCanEditForeignCategory() {
        User adminLike = user(5L,
                new HashSet<>(),
                permissions(PermissionEntity.CATEGORIES),
                permissions(PermissionEntity.CATEGORIES));
        WorkOrderCategory foreign = category(77L, 2L);
        when(userService.whoami(req)).thenReturn(adminLike);
        when(workOrderCategoryService.findById(12L)).thenReturn(Optional.of(foreign));
        when(workOrderCategoryService.update(eq(12L), any(WorkOrderCategoryPatchDTO.class))).thenReturn(foreign);

        assertDoesNotThrow(() -> workOrderCategoryController.patch(new WorkOrderCategoryPatchDTO(), 12L, req));
    }

    @Test
    void workOrderCategory_nullCreatedByIsForbiddenWithoutEditOther() {
        User creatorOnly = user(6L,
                permissions(PermissionEntity.CATEGORIES),
                new HashSet<>(),
                permissions(PermissionEntity.CATEGORIES));
        when(userService.whoami(req)).thenReturn(creatorOnly);
        when(workOrderCategoryService.findById(13L)).thenReturn(Optional.of(category(null, 2L)));

        CustomException ex = assertThrows(CustomException.class,
                () -> workOrderCategoryController.patch(new WorkOrderCategoryPatchDTO(), 13L, req));
        assertTrue(ex.getMessage().contains("Access Denied"));
    }
}
