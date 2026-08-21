package com.grash.service;

import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.RoleCode;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CustomerScopeServiceLimitedAdminScopeTest {

    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private LocationRepository locationRepository;
    @Mock
    private AssetRepository assetRepository;

    private CustomerScopeService customerScopeService;
    private Company company;
    private Customer customerA;
    private Customer customerB;

    @BeforeEach
    void setUp() {
        customerScopeService = new CustomerScopeService(customerRepository, locationRepository, assetRepository);
        company = new Company();
        company.setId(1L);
        customerA = new Customer();
        customerA.setId(10L);
        customerA.setCompany(company);
        customerB = new Customer();
        customerB.setId(20L);
        customerB.setCompany(company);
    }

    private User limitedAdminAllowedTo(Customer... allowed) {
        User user = new User();
        user.setId(7L);
        user.setCompany(company);
        user.setRole(Role.builder().code(RoleCode.LIMITED_ADMIN).build());
        user.setAllowedCustomers(new ArrayList<>(Arrays.asList(allowed)));
        return user;
    }

    @Test
    void limitedAdmin_withAllowedCustomers_hasRestrictedScope() {
        User user = limitedAdminAllowedTo(customerA);

        assertTrue(customerScopeService.hasRestrictedCustomerScope(user));
        assertTrue(customerScopeService.canAccessCustomer(user, 10L));
        assertFalse(customerScopeService.canAccessCustomer(user, 20L));
    }

    @Test
    void limitedAdmin_filterCustomers_returnsOnlyAllowedOnes() {
        User user = limitedAdminAllowedTo(customerA);

        List<Customer> filtered = new ArrayList<>(customerScopeService.filterCustomers(user, List.of(customerA, customerB)));

        assertEquals(1, filtered.size());
        assertEquals(10L, filtered.get(0).getId());
    }

    @Test
    void limitedAdmin_cannotAccessWorkOrderOutsideAllowedCustomers() {
        User user = limitedAdminAllowedTo(customerA);
        WorkOrder workOrder = new WorkOrder();
        workOrder.setCustomers(new ArrayList<>(List.of(customerB)));

        assertFalse(customerScopeService.canAccessWorkOrderBase(user, workOrder));
    }
}
