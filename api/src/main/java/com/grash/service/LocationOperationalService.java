package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.LocationOperationalSummaryDTO;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.Status;
import com.grash.repository.AssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

// Mesmo padrao de CustomerOperationalService.getSummary - contadores
// agregados no banco (COUNT/Page.totalElements), NUNCA carregar a colecao
// inteira de Assets/WorkOrders pra contar em Java.
@Service
@RequiredArgsConstructor
public class LocationOperationalService {
    private final AssetRepository assetRepository;
    private final WorkOrderService workOrderService;

    public LocationOperationalSummaryDTO getSummary(User user, Long locationId) {
        long totalAssets = 0;
        if (user.getRole().getViewPermissions().contains(PermissionEntity.ASSETS)) {
            totalAssets = canViewOther(user, PermissionEntity.ASSETS)
                    ? assetRepository.countByLocation_Id(locationId)
                    : assetRepository.countByLocation_IdAndCreatedBy(locationId, user.getId());
        }

        long open = countWorkOrders(user, locationId, Status.OPEN);
        long enRoute = countWorkOrders(user, locationId, Status.EN_ROUTE);
        long inProgress = countWorkOrders(user, locationId, Status.IN_PROGRESS);
        long onHold = countWorkOrders(user, locationId, Status.ON_HOLD);
        long complete = countWorkOrders(user, locationId, Status.COMPLETE);
        long totalWorkOrders = open + enRoute + inProgress + onHold + complete;

        return LocationOperationalSummaryDTO.builder()
                .totalAssets(totalAssets)
                .openWorkOrders(open)
                .enRouteWorkOrders(enRoute)
                .inProgressWorkOrders(inProgress)
                .onHoldWorkOrders(onHold)
                .completedWorkOrders(complete)
                .totalWorkOrders(totalWorkOrders)
                .build();
    }

    private long countWorkOrders(User user, Long locationId, Status status) {
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS)) {
            return 0;
        }
        SearchCriteria criteria = SearchCriteria.builder()
                .filterFields(new ArrayList<>(List.of(
                        FilterField.builder()
                                .field("location")
                                .operation("eq")
                                .value(locationId)
                                .values(new ArrayList<>())
                                .build(),
                        FilterField.builder()
                                .field("status")
                                .operation("eq")
                                .value(status)
                                .values(new ArrayList<>())
                                .build(),
                        FilterField.builder()
                                .field("archived")
                                .operation("eq")
                                .value(false)
                                .values(new ArrayList<>())
                                .build()
                )))
                .pageNum(0)
                .pageSize(1)
                .sortField("id")
                .direction(Sort.Direction.ASC)
                .build();
        return workOrderService.findBySearchCriteria(workOrderService.getSearchCriteria(user, criteria), user)
                .getTotalElements();
    }

    private boolean canViewOther(User user, PermissionEntity permissionEntity) {
        Collection<PermissionEntity> permissions = user.getRole().getViewOtherPermissions();
        return permissions != null && permissions.contains(permissionEntity);
    }
}
