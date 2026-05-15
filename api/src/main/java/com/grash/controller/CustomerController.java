package com.grash.controller;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.CustomerMiniDTO;
import com.grash.dto.CustomerPatchDTO;
import com.grash.dto.CustomerPostDTO;
import com.grash.dto.CustomerShowDTO;
import com.grash.dto.SuccessResponse;
import com.grash.dto.customer.CustomerLocationListDTO;
import com.grash.dto.customer.CustomerLocationMapDTO;
import com.grash.dto.customer.CustomerOperationalSummaryDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.CustomerMapper;
import com.grash.model.Customer;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.service.CustomerService;
import com.grash.service.CustomerOperationalService;
import com.grash.service.UserService;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/customers")
@Tag(name = "Customers", description = "Operations on customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;
    private final CustomerOperationalService customerOperationalService;
    private final UserService userService;
    private final CustomerMapper customerMapper;

    @PostMapping("/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Page<Customer>> search(@Parameter(description = "Customer search criteria") @RequestBody SearchCriteria searchCriteria, HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (user.getRole().getViewPermissions().contains(PermissionEntity.VENDORS_AND_CUSTOMERS)) {
                searchCriteria.filterCompany(user);
            } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
        }
        return ResponseEntity.ok(customerService.findBySearchCriteria(searchCriteria));
    }

    @GetMapping("/mini")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public Collection<CustomerMiniDTO> getMini(HttpServletRequest req) {
        User user = userService.whoami(req);
        return customerService.findByCompany(user.getCompany().getId()).stream().map(customerMapper::toMiniDto).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")

    public CustomerShowDTO getById(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Customer> optionalCustomer = customerService.findById(id);
        if (optionalCustomer.isPresent()) {
            Customer savedCustomer = optionalCustomer.get();
            if (user.getRole().getViewPermissions().contains(PermissionEntity.VENDORS_AND_CUSTOMERS)) {
                return customerMapper.toShowDto(savedCustomer);
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/{id}/locations")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<Page<CustomerLocationListDTO>> getLocationsByCustomer(@PathVariable("id") Long id, Pageable pageable,
                                                                        HttpServletRequest req) {
        User user = userService.whoami(req);
        ensureCustomerInCompanyAndReadable(id, user);
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS)) {
            throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
        }
        return ResponseEntity.ok(customerOperationalService.findLocations(user, id, pageable));
    }

    @GetMapping("/{id}/summary")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<CustomerOperationalSummaryDTO> getOperationalSummary(@PathVariable("id") Long id,
                                                                              HttpServletRequest req) {
        User user = userService.whoami(req);
        ensureCustomerInCompanyAndReadable(id, user);
        return ResponseEntity.ok(customerOperationalService.getSummary(user, id));
    }

    @GetMapping("/{id}/locations/map")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<List<CustomerLocationMapDTO>> getLocationMap(@PathVariable("id") Long id,
                                                                       HttpServletRequest req) {
        User user = userService.whoami(req);
        ensureCustomerInCompanyAndReadable(id, user);
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS)) {
            throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
        }
        return ResponseEntity.ok(customerOperationalService.findLocationMap(user, id));
    }

    @PostMapping("")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    CustomerShowDTO create(@Parameter(description = "Customer to create") @Valid @RequestBody CustomerPostDTO customerReq,
                           HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getCreatePermissions().contains(PermissionEntity.VENDORS_AND_CUSTOMERS)) {
            Customer savedCustomer = customerService.create(customerReq, user.getCompany());
            return customerMapper.toShowDto(savedCustomer);
        } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public CustomerShowDTO patch(@Parameter(description = "Customer fields to update") @Valid @RequestBody CustomerPatchDTO customer,
                                 @PathVariable("id") Long id,
                                 HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Customer> optionalCustomer = customerService.findById(id);

        if (optionalCustomer.isPresent()) {
            Customer savedCustomer = optionalCustomer.get();
            if (user.getRole().getEditOtherPermissions().contains(PermissionEntity.VENDORS_AND_CUSTOMERS) || savedCustomer.getCreatedBy().equals(user.getId())) {
                Customer updatedCustomer = customerService.update(id, customer, user.getCompany());
                return customerMapper.toShowDto(updatedCustomer);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Customer not found", HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public ResponseEntity delete(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);

        Optional<Customer> optionalCustomer = customerService.findById(id);
        if (optionalCustomer.isPresent()) {
            Customer savedCustomer = optionalCustomer.get();
            if (user.getId().equals(savedCustomer.getCreatedBy()) ||
                    user.getRole().getDeleteOtherPermissions().contains(PermissionEntity.VENDORS_AND_CUSTOMERS)) {
                    customerService.delete(id);
                return new ResponseEntity(new SuccessResponse(true, "Deleted successfully"),
                        HttpStatus.OK);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Customer not found", HttpStatus.NOT_FOUND);
    }

    private Customer ensureCustomerInCompanyAndReadable(Long id, User user) {
        Optional<Customer> optionalCustomer = customerService.findById(id);
        if (optionalCustomer.isEmpty()) {
            throw new CustomException("Not found", HttpStatus.NOT_FOUND);
        }
        Customer savedCustomer = optionalCustomer.get();
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.VENDORS_AND_CUSTOMERS)) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT) &&
                !savedCustomer.getCompany().getId().equals(user.getCompany().getId())) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        return savedCustomer;
    }

}

