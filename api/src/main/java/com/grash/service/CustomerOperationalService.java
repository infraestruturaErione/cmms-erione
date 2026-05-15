package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.customer.CustomerLocationListDTO;
import com.grash.dto.customer.CustomerLocationMapDTO;
import com.grash.dto.customer.CustomerOperationalSummaryDTO;
import com.grash.model.Location;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.Status;
import com.grash.repository.AssetRepository;
import com.grash.repository.LocationRepository;
import jakarta.persistence.criteria.JoinType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomerOperationalService {
    private final LocationRepository locationRepository;
    private final AssetRepository assetRepository;
    private final WorkOrderService workOrderService;

    public Page<CustomerLocationListDTO> findLocations(User user, Long customerId, Pageable pageable) {
        Page<Location> locations = canViewOther(user, PermissionEntity.LOCATIONS)
                ? locationRepository.findDistinctByCustomers_IdAndCompany_Id(customerId, user.getCompany().getId(), pageable)
                : locationRepository.findDistinctByCustomers_IdAndCompany_IdAndCreatedBy(customerId,
                user.getCompany().getId(), user.getId(), pageable);
        return locations.map(location -> CustomerLocationListDTO.builder()
                .id(location.getId())
                .name(location.getName())
                .customId(location.getCustomId())
                .address(location.getAddress())
                .latitude(location.getLatitude())
                .longitude(location.getLongitude())
                .build());
    }

    public List<CustomerLocationMapDTO> findLocationMap(User user, Long customerId) {
        if (canViewOther(user, PermissionEntity.LOCATIONS)) {
            return locationRepository.findMapPointsByCustomer(customerId, user.getCompany().getId());
        }
        return locationRepository.findMapPointsByCustomerAndCreatedBy(customerId, user.getCompany().getId(),
                user.getId());
    }

    public CustomerOperationalSummaryDTO getSummary(User user, Long customerId) {
        long totalLocations = 0;
        long locationsWithCoordinates = 0;
        if (user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS)) {
            totalLocations = canViewOther(user, PermissionEntity.LOCATIONS)
                    ? locationRepository.countDistinctByCustomers_IdAndCompany_Id(customerId, user.getCompany().getId())
                    : locationRepository.countDistinctByCustomers_IdAndCompany_IdAndCreatedBy(customerId,
                    user.getCompany().getId(), user.getId());
            locationsWithCoordinates = canViewOther(user, PermissionEntity.LOCATIONS)
                    ? locationRepository.countMapPointsByCustomer(customerId, user.getCompany().getId())
                    : locationRepository.countMapPointsByCustomerAndCreatedBy(customerId, user.getCompany().getId(),
                    user.getId());
        }

        long totalAssets = 0;
        long locationsWithAssets = 0;
        if (user.getRole().getViewPermissions().contains(PermissionEntity.ASSETS)) {
            totalAssets = canViewOther(user, PermissionEntity.ASSETS)
                    ? assetRepository.countDistinctByCustomers_IdAndCompany_Id(customerId, user.getCompany().getId())
                    : assetRepository.countDistinctByCustomers_IdAndCompany_IdAndCreatedBy(customerId,
                    user.getCompany().getId(), user.getId());
            locationsWithAssets = canViewOther(user, PermissionEntity.ASSETS)
                    ? assetRepository.countDistinctLocationsWithAssetsByCustomer(customerId, user.getCompany().getId())
                    : assetRepository.countDistinctLocationsWithAssetsByCustomerAndCreatedBy(customerId,
                    user.getCompany().getId(), user.getId());
        }

        long open = countWorkOrders(user, customerId, Status.OPEN);
        long enRoute = countWorkOrders(user, customerId, Status.EN_ROUTE);
        long inProgress = countWorkOrders(user, customerId, Status.IN_PROGRESS);
        long onHold = countWorkOrders(user, customerId, Status.ON_HOLD);
        long complete = countWorkOrders(user, customerId, Status.COMPLETE);
        long totalWorkOrders = open + enRoute + inProgress + onHold + complete;

        return CustomerOperationalSummaryDTO.builder()
                .totalLocations(totalLocations)
                .totalAssets(totalAssets)
                .locationsWithAssets(locationsWithAssets)
                .locationsWithoutAssets(Math.max(totalLocations - locationsWithAssets, 0))
                .locationsWithCoordinates(locationsWithCoordinates)
                .openWorkOrders(open)
                .enRouteWorkOrders(enRoute)
                .inProgressWorkOrders(inProgress)
                .onHoldWorkOrders(onHold)
                .completedWorkOrders(complete)
                .totalWorkOrders(totalWorkOrders)
                .build();
    }

    private long countWorkOrders(User user, Long customerId, Status status) {
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS)) {
            return 0;
        }
        SearchCriteria criteria = SearchCriteria.builder()
                .filterFields(new ArrayList<>(List.of(
                        FilterField.builder()
                                .field("customers")
                                .operation("inm")
                                .value("")
                                .values(values(customerId))
                                .joinType(JoinType.LEFT)
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
        return workOrderService.findBySearchCriteria(workOrderService.getSearchCriteria(user, criteria))
                .getTotalElements();
    }

    private boolean canViewOther(User user, PermissionEntity permissionEntity) {
        Collection<PermissionEntity> permissions = user.getRole().getViewOtherPermissions();
        return permissions != null && permissions.contains(permissionEntity);
    }

    private ArrayList<Object> values(Object value) {
        ArrayList<Object> values = new ArrayList<>();
        values.add(value);
        return values;
    }
}
