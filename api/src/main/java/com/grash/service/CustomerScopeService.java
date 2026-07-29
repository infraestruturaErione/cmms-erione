package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.WorkOrderBasePatchDTO;
import com.grash.exception.CustomException;
import com.grash.model.Asset;
import com.grash.model.Customer;
import com.grash.model.Location;
import com.grash.model.Request;
import com.grash.model.User;
import com.grash.model.abstracts.WorkOrderBase;
import com.grash.model.enums.RoleCode;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import jakarta.persistence.criteria.JoinType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomerScopeService {
    private final CustomerRepository customerRepository;
    private final LocationRepository locationRepository;
    private final AssetRepository assetRepository;

    public boolean isRequester(User user) {
        return user != null && user.getRole() != null && RoleCode.REQUESTER.equals(user.getRole().getCode());
    }

    public List<Long> getAllowedCustomerIds(User user) {
        if (!isRequester(user) || user.getAllowedCustomers() == null) {
            return Collections.emptyList();
        }
        return user.getAllowedCustomers().stream()
                .filter(Objects::nonNull)
                .map(Customer::getId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    public boolean canAccessCustomer(User user, Long customerId) {
        if (!isRequester(user)) {
            return true;
        }
        return customerId != null && getAllowedCustomerIds(user).contains(customerId);
    }

    public Collection<Customer> filterCustomers(User user, Collection<Customer> customers) {
        if (!isRequester(user)) {
            return customers;
        }
        List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
        if (allowedCustomerIds.isEmpty()) {
            return Collections.emptyList();
        }
        return customers.stream()
                .filter(customer -> allowedCustomerIds.contains(customer.getId()))
                .collect(Collectors.toList());
    }

    public List<Location> findAllowedLocations(User user) {
        return findAllowedLocations(user, null);
    }

    public List<Location> findAllowedLocations(User user, Long customerId) {
        if (!isRequester(user)) {
            if (customerId == null) {
                return new ArrayList<>(locationRepository.findByCompany_Id(user.getCompany().getId()));
            }
            return locationRepository.findByCompanyAndCustomerIds(user.getCompany().getId(),
                    Collections.singletonList(customerId));
        }
        List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
        if (allowedCustomerIds.isEmpty()) {
            return Collections.emptyList();
        }
        if (customerId != null) {
            if (!allowedCustomerIds.contains(customerId)) {
                return Collections.emptyList();
            }
            return locationRepository.findByCompanyAndCustomerIds(user.getCompany().getId(),
                    Collections.singletonList(customerId));
        }
        return locationRepository.findByCompanyAndCustomerIds(user.getCompany().getId(), allowedCustomerIds);
    }

    public List<Asset> findAllowedAssets(User user, Long locationId) {
        return findAllowedAssets(user, locationId, null);
    }

    public List<Asset> findAllowedAssets(User user, Long locationId, Long customerId) {
        List<Asset> assets;
        if (!isRequester(user)) {
            if (customerId == null) {
                assets = locationId == null
                        ? assetRepository.findByCompany_Id(user.getCompany().getId())
                        : assetRepository.findByLocation_Id(locationId);
            } else {
                assets = assetRepository.findByCompanyAndCustomerIds(user.getCompany().getId(),
                        Collections.singletonList(customerId));
                if (locationId != null) {
                    assets = assets.stream()
                            .filter(asset -> asset.getLocation() != null && locationId.equals(asset.getLocation().getId()))
                            .collect(Collectors.toList());
                }
            }
        } else {
            List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
            if (allowedCustomerIds.isEmpty()) {
                return Collections.emptyList();
            }
            if (customerId != null) {
                if (!allowedCustomerIds.contains(customerId)) {
                    return Collections.emptyList();
                }
                assets = assetRepository.findByCompanyAndCustomerIds(user.getCompany().getId(),
                        Collections.singletonList(customerId));
            } else {
                assets = assetRepository.findByCompanyAndCustomerIds(user.getCompany().getId(), allowedCustomerIds);
            }
            if (locationId != null) {
                assets = assets.stream()
                        .filter(asset -> asset.getLocation() != null && locationId.equals(asset.getLocation().getId()))
                        .collect(Collectors.toList());
            }
        }
        return assets;
    }

    public void addCustomerScopeFilter(SearchCriteria searchCriteria, User user, String field) {
        if (!isRequester(user)) {
            return;
        }
        List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
        List<Object> filterValues = allowedCustomerIds.isEmpty()
                ? Collections.singletonList(-1L)
                : new ArrayList<>(allowedCustomerIds);
        searchCriteria.getFilterFields().add(FilterField.builder()
                .field(field)
                .operation("in")
                .value("")
                .values(filterValues)
                .build());
    }

    public void addCustomerManyToManyScopeFilter(SearchCriteria searchCriteria, User user, String field) {
        if (!isRequester(user)) {
            return;
        }
        List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
        List<Object> filterValues = allowedCustomerIds.isEmpty()
                ? Collections.singletonList(-1L)
                : new ArrayList<>(allowedCustomerIds);
        searchCriteria.getFilterFields().add(FilterField.builder()
                .field(field)
                .operation("inm")
                .joinType(JoinType.LEFT)
                .value("")
                .values(filterValues)
                .build());
    }

    public void assertCanAccessCustomer(User user, Customer customer) {
        if (customer == null || !customer.getCompany().getId().equals(user.getCompany().getId())) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (!canAccessCustomer(user, customer.getId())) {
            throw new CustomException("Customer outside user scope", HttpStatus.FORBIDDEN);
        }
    }

    public void assertCanAccessLocation(User user, Long locationId) {
        if (!isRequester(user) || locationId == null) {
            return;
        }
        Location location = locationRepository.findByIdAndCompany_Id(locationId, user.getCompany().getId())
                .orElseThrow(() -> new CustomException("Location not found", HttpStatus.NOT_FOUND));
        boolean allowed = location.getCustomers().stream()
                .anyMatch(customer -> canAccessCustomer(user, customer.getId()));
        if (!allowed) {
            throw new CustomException("Location outside user scope", HttpStatus.FORBIDDEN);
        }
    }

    public void assertCanAccessAsset(User user, Long assetId) {
        if (!isRequester(user) || assetId == null) {
            return;
        }
        Asset asset = assetRepository.findByIdAndCompany_Id(assetId, user.getCompany().getId())
                .orElseThrow(() -> new CustomException("Asset not found", HttpStatus.NOT_FOUND));
        boolean directCustomerAllowed = asset.getCustomers().stream()
                .anyMatch(customer -> canAccessCustomer(user, customer.getId()));
        boolean locationCustomerAllowed = asset.getLocation() != null && asset.getLocation().getCustomers().stream()
                .anyMatch(customer -> canAccessCustomer(user, customer.getId()));
        if (!directCustomerAllowed && !locationCustomerAllowed) {
            throw new CustomException("Asset outside user scope", HttpStatus.FORBIDDEN);
        }
    }

    public void prepareAndValidateRequestScope(Request request, User user) {
        if (!isRequester(user)) {
            return;
        }
        List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
        if (allowedCustomerIds.isEmpty()) {
            throw new CustomException("No allowed customers configured for this user", HttpStatus.FORBIDDEN);
        }

        List<Customer> requestCustomers = request.getCustomers() == null ? new ArrayList<>() : request.getCustomers();
        if (requestCustomers.isEmpty()) {
            if (allowedCustomerIds.size() == 1) {
                Customer allowedCustomer = customerRepository.findById(allowedCustomerIds.get(0))
                        .orElseThrow(() -> new CustomException("Allowed customer not found", HttpStatus.NOT_FOUND));
                request.setCustomers(new ArrayList<>(Collections.singletonList(allowedCustomer)));
            } else {
                throw new CustomException("Customer is required", HttpStatus.FORBIDDEN);
            }
        } else {
            for (Customer customer : requestCustomers) {
                assertCanAccessCustomer(user, customerRepository.findById(customer.getId())
                        .orElseThrow(() -> new CustomException("Customer not found", HttpStatus.NOT_FOUND)));
            }
        }

        Optional.ofNullable(request.getLocation()).map(Location::getId).ifPresent(locationId -> assertCanAccessLocation(user, locationId));
        Optional.ofNullable(request.getAsset()).map(Asset::getId).ifPresent(assetId -> assertCanAccessAsset(user, assetId));
    }

    public void prepareAndValidateRequestScope(WorkOrderBase workOrderBase, User user) {
        if (!isRequester(user)) {
            return;
        }
        List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
        if (allowedCustomerIds.isEmpty()) {
            throw new CustomException("No allowed customers configured for this user", HttpStatus.FORBIDDEN);
        }
        List<Customer> workOrderCustomers =
                workOrderBase.getCustomers() == null ? new ArrayList<>() : workOrderBase.getCustomers();
        if (workOrderCustomers.isEmpty()) {
            if (allowedCustomerIds.size() == 1) {
                Customer allowedCustomer = customerRepository.findById(allowedCustomerIds.get(0))
                        .orElseThrow(() -> new CustomException("Allowed customer not found", HttpStatus.NOT_FOUND));
                workOrderBase.setCustomers(new ArrayList<>(Collections.singletonList(allowedCustomer)));
            } else {
                throw new CustomException("Customer is required", HttpStatus.FORBIDDEN);
            }
        } else {
            for (Customer customer : workOrderCustomers) {
                assertCanAccessCustomer(user, customerRepository.findById(customer.getId())
                        .orElseThrow(() -> new CustomException("Customer not found", HttpStatus.NOT_FOUND)));
            }
        }
        Optional.ofNullable(workOrderBase.getLocation()).map(Location::getId)
                .ifPresent(locationId -> assertCanAccessLocation(user, locationId));
        Optional.ofNullable(workOrderBase.getAsset()).map(Asset::getId)
                .ifPresent(assetId -> assertCanAccessAsset(user, assetId));
    }

    public void prepareAndValidateRequestScope(WorkOrderBasePatchDTO request, User user) {
        if (!isRequester(user)) {
            return;
        }
        List<Long> allowedCustomerIds = getAllowedCustomerIds(user);
        if (allowedCustomerIds.isEmpty()) {
            throw new CustomException("No allowed customers configured for this user", HttpStatus.FORBIDDEN);
        }
        List<Customer> requestCustomers = request.getCustomers() == null ? new ArrayList<>() : request.getCustomers();
        if (!requestCustomers.isEmpty()) {
            for (Customer customer : requestCustomers) {
                assertCanAccessCustomer(user, customerRepository.findById(customer.getId())
                        .orElseThrow(() -> new CustomException("Customer not found", HttpStatus.NOT_FOUND)));
            }
        }
        Optional.ofNullable(request.getLocation()).map(Location::getId).ifPresent(locationId -> assertCanAccessLocation(user, locationId));
        Optional.ofNullable(request.getAsset()).map(Asset::getId).ifPresent(assetId -> assertCanAccessAsset(user, assetId));
    }

    public void validateWorkOrderAssociations(WorkOrderBase workOrderBase, Long companyId) {
        validateWorkOrderAssociations(workOrderBase, companyId, true, true);
    }

    public void validateWorkOrderAssociations(WorkOrderBasePatchDTO patch,
                                              WorkOrderBase workOrderBase,
                                              Long companyId) {
        if (patch == null || workOrderBase == null || companyId == null) {
            return;
        }

        boolean customersChanged = patch.getCustomers() != null;
        boolean locationChanged = patch.getLocation() != null;
        boolean assetChanged = patch.getAsset() != null;

        if (!customersChanged && !locationChanged && !assetChanged) {
            return;
        }

        validateWorkOrderAssociations(
                workOrderBase,
                companyId,
                customersChanged || locationChanged,
                customersChanged || assetChanged
        );
    }

    private void validateWorkOrderAssociations(WorkOrderBase workOrderBase,
                                               Long companyId,
                                               boolean validateLocationAgainstCustomers,
                                               boolean validateAssetAgainstCustomers) {
        if (workOrderBase == null || companyId == null) {
            return;
        }

        Set<Long> customerIds = resolveCompanyCustomerIds(workOrderBase.getCustomers(), companyId);
        Location location = resolveCompanyLocation(workOrderBase.getLocation(), companyId);
        Asset asset = resolveCompanyAsset(workOrderBase.getAsset(), companyId);

        if (validateLocationAgainstCustomers && !customerIds.isEmpty() && location != null) {
            boolean customerMatchesLocation = location.getCustomers().stream()
                    .map(Customer::getId)
                    .anyMatch(customerIds::contains);
            if (!customerMatchesLocation) {
                throw new CustomException("Selected location is not linked to the chosen customer",
                        HttpStatus.NOT_ACCEPTABLE);
            }
        }

        if (validateAssetAgainstCustomers && !customerIds.isEmpty() && asset != null) {
            boolean assetMatchesCustomers = asset.getCustomers().stream()
                    .map(Customer::getId)
                    .anyMatch(customerIds::contains);
            boolean assetLocationMatchesCustomers = asset.getLocation() != null &&
                    asset.getLocation().getCustomers().stream()
                            .map(Customer::getId)
                            .anyMatch(customerIds::contains);
            if (!assetMatchesCustomers && !assetLocationMatchesCustomers) {
                throw new CustomException("Selected asset is not linked to the chosen customer",
                        HttpStatus.NOT_ACCEPTABLE);
            }
        }
    }

    private Set<Long> resolveCompanyCustomerIds(Collection<Customer> customers, Long companyId) {
        if (customers == null || customers.isEmpty()) {
            return Collections.emptySet();
        }

        Set<Long> requestedIds = customers.stream()
                .filter(Objects::nonNull)
                .map(Customer::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (requestedIds.isEmpty()) {
            return Collections.emptySet();
        }

        Collection<Customer> savedCustomers = customerRepository.findByIdInAndCompany_Id(requestedIds, companyId);
        if (savedCustomers.size() != requestedIds.size()) {
            throw new CustomException("Customer not found", HttpStatus.NOT_FOUND);
        }

        return savedCustomers.stream().map(Customer::getId).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Location resolveCompanyLocation(Location location, Long companyId) {
        if (location == null || location.getId() == null) {
            return null;
        }
        return locationRepository.findByIdAndCompany_Id(location.getId(), companyId)
                .orElseThrow(() -> new CustomException("Location not found", HttpStatus.NOT_FOUND));
    }

    private Asset resolveCompanyAsset(Asset asset, Long companyId) {
        if (asset == null || asset.getId() == null) {
            return null;
        }
        return assetRepository.findByIdAndCompany_Id(asset.getId(), companyId)
                .orElseThrow(() -> new CustomException("Asset not found", HttpStatus.NOT_FOUND));
    }

    public boolean canAccessWorkOrderBase(User user, WorkOrderBase workOrderBase) {
        if (!isRequester(user)) {
            return true;
        }
        if (getAllowedCustomerIds(user).isEmpty()) {
            return false;
        }
        if (workOrderBase instanceof Request && workOrderBase.getCreatedBy() != null && workOrderBase.getCreatedBy().equals(user.getId())) {
            return true;
        }
        return workOrderBase.getCustomers() != null && workOrderBase.getCustomers().stream()
                .anyMatch(customer -> canAccessCustomer(user, customer.getId()));
    }
}
