package com.grash.service;

import com.grash.dto.CustomerMiniDTO;
import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Request;
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
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regressao do gap de auditoria: Requester escopado ao Cliente A nao pode
 * ver/inferir dados do Cliente B dentro da mesma Company, nem via
 * ownership de Request (item 9 do pedido de correcao).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CustomerScopeServiceTest {

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
        customerA.setId(1L);
        customerA.setCompany(company);
        customerB = new Customer();
        customerB.setId(2L);
        customerB.setCompany(company);
    }

    private User requesterAllowedTo(Long userId, Customer... allowed) {
        User user = new User();
        user.setId(userId);
        user.setCompany(company);
        user.setRole(Role.builder().code(RoleCode.REQUESTER).build());
        user.setAllowedCustomers(new ArrayList<>(Arrays.asList(allowed)));
        return user;
    }

    private User admin(Long userId) {
        User user = new User();
        user.setId(userId);
        user.setCompany(company);
        user.setRole(Role.builder().code(RoleCode.ADMIN).build());
        return user;
    }

    // Requester A pedindo WorkOrder do Cliente A -> permitido.
    @Test
    void requester_canAccessWorkOrder_ofAllowedCustomer() {
        User requesterA = requesterAllowedTo(10L, customerA);
        WorkOrder workOrder = new WorkOrder();
        workOrder.setCustomers(new ArrayList<>(Collections.singletonList(customerA)));

        assertTrue(customerScopeService.canAccessWorkOrderBase(requesterA, workOrder));
    }

    // Requester A pedindo WorkOrder do Cliente B -> bloqueado (o vazamento
    // principal da auditoria).
    @Test
    void requester_cannotAccessWorkOrder_ofDisallowedCustomer() {
        User requesterA = requesterAllowedTo(10L, customerA);
        WorkOrder workOrder = new WorkOrder();
        workOrder.setCustomers(new ArrayList<>(Collections.singletonList(customerB)));

        assertFalse(customerScopeService.canAccessWorkOrderBase(requesterA, workOrder));
    }

    // Ownership so cobre a JANELA sem customer atribuido ainda (Request
    // recem-criada pelo portal, nao triada).
    @Test
    void requester_canAccessOwnRequest_beforeAnyCustomerAssigned() {
        User requesterA = requesterAllowedTo(10L, customerA);
        Request request = new Request();
        request.setCreatedBy(10L);
        request.setCustomers(new ArrayList<>());

        assertTrue(customerScopeService.canAccessWorkOrderBase(requesterA, request));
    }

    // Cenario central do item 9: Admin reassocia a Request do Requester pro
    // Cliente B DEPOIS de criada - ownership NAO pode mais atravessar o
    // customer scope.
    @Test
    void requester_ownershipDoesNotOverride_onceCustomerReassignedOutOfScope() {
        User requesterA = requesterAllowedTo(10L, customerA);
        Request request = new Request();
        request.setCreatedBy(10L);
        request.setCustomers(new ArrayList<>(Collections.singletonList(customerB)));

        assertFalse(customerScopeService.canAccessWorkOrderBase(requesterA, request));
    }

    // Controle positivo: se reassociada a um customer DENTRO do escopo,
    // continua acessivel (nao e' so a criacao que da acesso, o customer
    // certo tambem da).
    @Test
    void requester_canAccessOwnRequest_reassignedToAllowedCustomer() {
        User requesterA = requesterAllowedTo(10L, customerA);
        Request request = new Request();
        request.setCreatedBy(10L);
        request.setCustomers(new ArrayList<>(Collections.singletonList(customerA)));

        assertTrue(customerScopeService.canAccessWorkOrderBase(requesterA, request));
    }

    // Admin nunca e' filtrado por customer scope.
    @Test
    void admin_alwaysCanAccessWorkOrder_regardlessOfCustomer() {
        User adminUser = admin(99L);
        WorkOrder workOrder = new WorkOrder();
        workOrder.setCustomers(new ArrayList<>(Collections.singletonList(customerB)));

        assertTrue(customerScopeService.canAccessWorkOrderBase(adminUser, workOrder));
    }

    // Location A+B: Requester A ve a Location (compartilhada) mas o DTO de
    // customers deve conter SOMENTE A - nunca revelar B.
    @Test
    void filterCustomerMiniDTOs_requester_seesOnlyAllowedCustomer_ofSharedLocation() {
        User requesterA = requesterAllowedTo(10L, customerA);
        CustomerMiniDTO miniA = new CustomerMiniDTO();
        miniA.setId(1L);
        miniA.setName("Cliente A");
        CustomerMiniDTO miniB = new CustomerMiniDTO();
        miniB.setId(2L);
        miniB.setName("Cliente B");
        List<CustomerMiniDTO> shared = Arrays.asList(miniA, miniB);

        List<CustomerMiniDTO> filtered =
                customerScopeService.filterCustomerMiniDTOs(requesterA, shared, CustomerMiniDTO::getId);

        assertEquals(1, filtered.size());
        assertEquals(1L, filtered.get(0).getId());
        assertTrue(filtered.stream().noneMatch(dto -> dto.getId().equals(2L)),
                "Cliente B nao pode aparecer pro Requester A");
    }

    // Admin/escopo amplo continua vendo a lista completa de customers.
    @Test
    void filterCustomerMiniDTOs_admin_seesFullList_ofSharedLocation() {
        User adminUser = admin(99L);
        CustomerMiniDTO miniA = new CustomerMiniDTO();
        miniA.setId(1L);
        CustomerMiniDTO miniB = new CustomerMiniDTO();
        miniB.setId(2L);
        List<CustomerMiniDTO> shared = Arrays.asList(miniA, miniB);

        List<CustomerMiniDTO> filtered =
                customerScopeService.filterCustomerMiniDTOs(adminUser, shared, CustomerMiniDTO::getId);

        assertEquals(2, filtered.size());
    }

    // As antigas manyToManyScopeFilter_* (FilterField "inm" + interseccao
    // manual de alternatives) foram REMOVIDAS junto com o metodo que
    // testavam (addCustomerManyToManyScopeFilter, deletado). A correcao
    // estrutural substituiu esse mecanismo por uma Specification dedicada
    // (customerScopeService.customerScopeSpecification) combinada via AND
    // fora da arvore de FilterField - ver testes de execucao real de
    // Specification/predicate em CustomerScopeSpecificationIntegrationTest,
    // que cobrem os mesmos cenarios de bypass (e mais) contra um banco H2
    // real, nao apenas verificando mutacao de FilterField.
}
