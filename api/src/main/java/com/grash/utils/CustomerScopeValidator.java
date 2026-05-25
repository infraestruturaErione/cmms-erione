package com.grash.utils;

import com.grash.exception.CustomException;
import com.grash.model.*;
import com.grash.model.enums.RoleType;
import org.springframework.http.HttpStatus;

import java.util.List;

public class CustomerScopeValidator {

    public static void validateWorkOrderAccess(User user, WorkOrder workOrder) {
        if (user.getRole().getRoleType().equals(RoleType.ROLE_SUPER_ADMIN)) {
            return;
        }
        if (user.hasRestrictedCustomers()) {
            List<Customer> woCustomers = workOrder.getCustomers();
            if (woCustomers == null || woCustomers.isEmpty()) {
                throw new CustomException("Access denied: work order has no customer assigned",
                        HttpStatus.FORBIDDEN);
            }
            boolean hasAccess = woCustomers.stream()
                    .anyMatch(c -> user.getCustomers().stream()
                            .anyMatch(uc -> uc.getId().equals(c.getId())));
            if (!hasAccess) {
                throw new CustomException("Access denied: work order belongs to a customer outside your scope",
                        HttpStatus.FORBIDDEN);
            }
        }
    }

    public static void validateAssetAccess(User user, Asset asset) {
        if (user.getRole().getRoleType().equals(RoleType.ROLE_SUPER_ADMIN)) {
            return;
        }
        if (user.hasRestrictedCustomers()) {
            List<Customer> assetCustomers = asset.getCustomers();
            if (assetCustomers == null || assetCustomers.isEmpty()) {
                throw new CustomException("Access denied: asset has no customer assigned",
                        HttpStatus.FORBIDDEN);
            }
            boolean hasAccess = assetCustomers.stream()
                    .anyMatch(c -> user.getCustomers().stream()
                            .anyMatch(uc -> uc.getId().equals(c.getId())));
            if (!hasAccess) {
                throw new CustomException("Access denied: asset belongs to a customer outside your scope",
                        HttpStatus.FORBIDDEN);
            }
        }
    }

    public static void validateLocationAccess(User user, Location location) {
        if (user.getRole().getRoleType().equals(RoleType.ROLE_SUPER_ADMIN)) {
            return;
        }
        if (user.hasRestrictedCustomers()) {
            List<Customer> locCustomers = location.getCustomers();
            if (locCustomers == null || locCustomers.isEmpty()) {
                throw new CustomException("Access denied: location has no customer assigned",
                        HttpStatus.FORBIDDEN);
            }
            boolean hasAccess = locCustomers.stream()
                    .anyMatch(c -> user.getCustomers().stream()
                            .anyMatch(uc -> uc.getId().equals(c.getId())));
            if (!hasAccess) {
                throw new CustomException("Access denied: location belongs to a customer outside your scope",
                        HttpStatus.FORBIDDEN);
            }
        }
    }
}
