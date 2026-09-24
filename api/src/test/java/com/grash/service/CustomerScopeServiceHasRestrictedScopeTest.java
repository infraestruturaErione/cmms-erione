package com.grash.service;

import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.RoleCode;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mockito;

import java.util.AbstractList;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * hasRestrictedCustomerScope decide a partir do ROLE antes de olhar a colecao
 * allowedCustomers (LAZY, em um User compartilhado pelo cache "users"). Perfis
 * sem escopo por cliente nao podem depender - nem tocar - nessa colecao.
 */
class CustomerScopeServiceHasRestrictedScopeTest {

    private CustomerScopeService customerScopeService;
    private Customer customerA;
    private Customer customerB;

    @BeforeEach
    void setUp() {
        customerScopeService = new CustomerScopeService(Mockito.mock(CustomerRepository.class),
                Mockito.mock(LocationRepository.class), Mockito.mock(AssetRepository.class));
        Company company = new Company();
        company.setId(1L);
        customerA = customer(10L, company);
        customerB = customer(20L, company);
    }

    private static Customer customer(Long id, Company company) {
        Customer customer = new Customer();
        customer.setId(id);
        customer.setCompany(company);
        return customer;
    }

    private static User userWith(RoleCode code, List<Customer> allowedCustomers) {
        User user = new User();
        user.setId(1L);
        user.setRole(Role.builder().code(code).build());
        user.setAllowedCustomers(allowedCustomers);
        return user;
    }

    /**
     * Lista que FALHA se qualquer coisa a ler (isEmpty/size/iterator/stream...):
     * substitui a PersistentBag lazy - tocar nela e' exatamente o que nao pode
     * acontecer para perfis sem escopo por cliente.
     */
    private static List<Customer> poisonedCollection() {
        return new AbstractList<>() {
            @Override
            public Customer get(int index) {
                throw new AssertionError("allowedCustomers foi lida (get)");
            }

            @Override
            public int size() {
                throw new AssertionError("allowedCustomers foi lida (size)");
            }
        };
    }

    // --- roles SEM escopo por cliente: false, sem tocar na colecao ---

    @ParameterizedTest
    @EnumSource(value = RoleCode.class, names = {"REQUESTER", "LIMITED_ADMIN"}, mode = EnumSource.Mode.EXCLUDE)
    void rolesWithoutCustomerScopeAreNeverRestrictedAndNeverTouchTheCollection(RoleCode code) {
        User user = userWith(code, poisonedCollection());

        assertFalse(customerScopeService.hasRestrictedCustomerScope(user));
    }

    @ParameterizedTest
    @EnumSource(value = RoleCode.class, names = {"REQUESTER", "LIMITED_ADMIN"}, mode = EnumSource.Mode.EXCLUDE)
    void everyScopeHelperStaysOffTheCollectionForRolesWithoutCustomerScope(RoleCode code) {
        User user = userWith(code, poisonedCollection());

        assertTrue(customerScopeService.canAccessCustomer(user, customerA.getId()));
        assertTrue(customerScopeService.canAccessCustomer(user, customerB.getId()));
        assertTrue(customerScopeService.getAllowedCustomerIds(user).isEmpty());
        List<Customer> all = Arrays.asList(customerA, customerB);
        assertEquals(all, new ArrayList<>(customerScopeService.filterCustomers(user, all)));
    }

    @Test
    void nullUserAndUserWithoutRoleAreNotRestricted() {
        assertFalse(customerScopeService.hasRestrictedCustomerScope(null));

        User noRole = new User();
        noRole.setAllowedCustomers(poisonedCollection());
        assertFalse(customerScopeService.hasRestrictedCustomerScope(noRole));
    }

    // --- REQUESTER / LIMITED_ADMIN: semantica preservada ---

    @ParameterizedTest
    @EnumSource(value = RoleCode.class, names = {"REQUESTER", "LIMITED_ADMIN"})
    void scopedRoleWithEmptyCollectionIsNotRestricted(RoleCode code) {
        assertFalse(customerScopeService.hasRestrictedCustomerScope(userWith(code, new ArrayList<>())));
    }

    @ParameterizedTest
    @EnumSource(value = RoleCode.class, names = {"REQUESTER", "LIMITED_ADMIN"})
    void scopedRoleWithNullCollectionIsNotRestricted(RoleCode code) {
        assertFalse(customerScopeService.hasRestrictedCustomerScope(userWith(code, null)));
    }

    @ParameterizedTest
    @EnumSource(value = RoleCode.class, names = {"REQUESTER", "LIMITED_ADMIN"})
    void scopedRoleWithAllowedCustomerIsRestricted(RoleCode code) {
        User user = userWith(code, new ArrayList<>(Collections.singletonList(customerA)));

        assertTrue(customerScopeService.hasRestrictedCustomerScope(user));
    }

    // Requisito critico: a reordenacao NAO pode abrir o escopo do REQUESTER.
    @ParameterizedTest
    @EnumSource(value = RoleCode.class, names = {"REQUESTER", "LIMITED_ADMIN"})
    void scopedUserStillSeesOnlyTheirOwnCustomers(RoleCode code) {
        User user = userWith(code, new ArrayList<>(Collections.singletonList(customerA)));

        assertEquals(Collections.singletonList(customerA.getId()), customerScopeService.getAllowedCustomerIds(user));
        assertTrue(customerScopeService.canAccessCustomer(user, customerA.getId()));
        assertFalse(customerScopeService.canAccessCustomer(user, customerB.getId()));
        assertEquals(Collections.singletonList(customerA),
                new ArrayList<>(customerScopeService.filterCustomers(user, Arrays.asList(customerA, customerB))));
    }
}
