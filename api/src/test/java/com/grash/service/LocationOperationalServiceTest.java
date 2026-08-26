package com.grash.service;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.LocationOperationalSummaryDTO;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.PermissionEntity;
import com.grash.repository.AssetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reforma de Locations/Customer, Etapa 1: LocationOperationalService.getSummary
 * - contadores agregados (COUNT/Page.totalElements), NUNCA carregar colecao
 * inteira. Aqui validamos so a logica de gating por permissao (ASSETS/
 * WORK_ORDERS view) e a soma dos status - os repositorios/service reais de
 * contagem sao mockados (ja cobertos por seus proprios testes/uso existente
 * em CustomerOperationalService).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LocationOperationalServiceTest {

    @Mock
    private AssetRepository assetRepository;
    @Mock
    private WorkOrderService workOrderService;

    private LocationOperationalService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new LocationOperationalService(assetRepository, workOrderService);
        Role role = new Role();
        role.setViewPermissions(new HashSet<>(List.of(PermissionEntity.ASSETS, PermissionEntity.WORK_ORDERS)));
        role.setViewOtherPermissions(new HashSet<>(List.of(PermissionEntity.ASSETS, PermissionEntity.WORK_ORDERS)));
        user = new User();
        user.setId(1L);
        user.setRole(role);

        when(workOrderService.getSearchCriteria(any(), any())).thenAnswer(inv -> inv.getArgument(1));
    }

    private Page<WorkOrder> pageOfSize(long total) {
        return new PageImpl<>(Collections.emptyList(), Pageable.ofSize(1), total);
    }

    @Test
    void withFullPermissions_countsAssetsAndAllWorkOrderStatuses() {
        when(assetRepository.countByLocation_Id(10L)).thenReturn(24L);
        when(workOrderService.findBySearchCriteria(any(SearchCriteria.class), any())).thenReturn(pageOfSize(3));

        LocationOperationalSummaryDTO summary = service.getSummary(user, 10L);

        assertEquals(24L, summary.getTotalAssets());
        // 5 status contados (OPEN/EN_ROUTE/IN_PROGRESS/ON_HOLD/COMPLETE), cada
        // um mockado pra devolver 3 -> soma = 15.
        assertEquals(15L, summary.getTotalWorkOrders());
        assertEquals(3L, summary.getOpenWorkOrders());
        assertEquals(3L, summary.getCompletedWorkOrders());
    }

    @Test
    void withoutAssetsViewPermission_totalAssetsIsZero_repositoryNeverCalled() {
        user.getRole().setViewPermissions(new HashSet<>(List.of(PermissionEntity.WORK_ORDERS)));
        when(workOrderService.findBySearchCriteria(any(SearchCriteria.class), any())).thenReturn(pageOfSize(0));

        LocationOperationalSummaryDTO summary = service.getSummary(user, 10L);

        assertEquals(0L, summary.getTotalAssets());
        verify(assetRepository, never()).countByLocation_Id(any());
        verify(assetRepository, never()).countByLocation_IdAndCreatedBy(any(), any());
    }

    @Test
    void withoutWorkOrdersViewPermission_allWorkOrderCountsAreZero_serviceNeverCalled() {
        user.getRole().setViewPermissions(new HashSet<>(List.of(PermissionEntity.ASSETS)));
        when(assetRepository.countByLocation_Id(10L)).thenReturn(5L);

        LocationOperationalSummaryDTO summary = service.getSummary(user, 10L);

        assertEquals(0L, summary.getTotalWorkOrders());
        assertEquals(0L, summary.getOpenWorkOrders());
        verify(workOrderService, never()).findBySearchCriteria(any(), any());
    }

    // Sem viewOther (ASSETS) - usa a contagem escopada por createdBy, nao a
    // contagem geral da Location.
    @Test
    void withoutViewOtherAssets_usesCreatedByScopedCount() {
        user.getRole().setViewOtherPermissions(new HashSet<>(List.of(PermissionEntity.WORK_ORDERS)));
        when(assetRepository.countByLocation_IdAndCreatedBy(10L, user.getId())).thenReturn(4L);
        when(workOrderService.findBySearchCriteria(any(SearchCriteria.class), any())).thenReturn(pageOfSize(0));

        LocationOperationalSummaryDTO summary = service.getSummary(user, 10L);

        assertEquals(4L, summary.getTotalAssets());
        verify(assetRepository, never()).countByLocation_Id(any());
    }
}
