package com.grash.controller;

import com.grash.dto.CustomerMiniDTO;
import com.grash.dto.LocationShowDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.LocationMapper;
import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Location;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.RoleType;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import com.grash.service.CustomerScopeService;
import com.grash.service.LocationOperationalService;
import com.grash.service.LocationService;
import com.grash.service.RateLimiterService;
import com.grash.service.RequestPortalService;
import com.grash.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Item 2 do pedido de correcao: Location 9 compartilhada entre Cliente A
 * (permitido) e Cliente B (proibido) - Requester A pode acessar a Location
 * (esta associado a ela), mas o LocationShowDTO.customers NAO pode revelar
 * o Cliente B. Usa CustomerScopeService REAL (nao mockado) pra validar a
 * integracao ponta a ponta do filtro, so os repositorios sao mockados.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LocationCustomerScopeFilterTest {

    @Mock
    private LocationService locationService;
    @Mock
    private LocationMapper locationMapper;
    @Mock
    private UserService userService;
    @Mock
    private EntityManager em;
    @Mock
    private RateLimiterService rateLimiterService;
    @Mock
    private RequestPortalService requestPortalService;
    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private LocationRepository locationRepository;
    @Mock
    private AssetRepository assetRepository;
    @Mock
    private HttpServletRequest req;
    @Mock
    private LocationOperationalService locationOperationalService;

    private CustomerScopeService customerScopeService;
    private LocationController controller;
    private Company company;
    private Customer customerA;
    private Customer customerB;
    private Location sharedLocation;

    @BeforeEach
    void setUp() {
        customerScopeService = new CustomerScopeService(customerRepository, locationRepository, assetRepository);
        controller = new LocationController(locationService, locationMapper, userService, em, rateLimiterService,
                requestPortalService, customerScopeService, locationOperationalService);

        company = new Company();
        company.setId(1L);
        customerA = new Customer();
        customerA.setId(1L);
        customerA.setCompany(company);
        customerB = new Customer();
        customerB.setId(2L);
        customerB.setCompany(company);

        sharedLocation = new Location();
        sharedLocation.setId(9L);
        sharedLocation.setCompany(company);
        sharedLocation.setCreatedBy(999L);
        sharedLocation.setCustomers(new ArrayList<>(Arrays.asList(customerA, customerB)));
    }

    private User requesterAllowedTo(Customer... allowed) {
        User user = new User();
        user.setId(10L);
        user.setCompany(company);
        user.setRole(Role.builder().code(RoleCode.REQUESTER).roleType(RoleType.ROLE_CLIENT).build());
        user.setAllowedCustomers(new ArrayList<>(Arrays.asList(allowed)));
        return user;
    }

    private CustomerMiniDTO miniOf(Customer customer) {
        CustomerMiniDTO dto = new CustomerMiniDTO();
        dto.setId(customer.getId());
        dto.setName("Cliente " + customer.getId());
        return dto;
    }

    @Test
    void requesterA_sharedLocation_dtoContainsOnlyAllowedCustomer_notB() {
        User requesterA = requesterAllowedTo(customerA);
        when(userService.whoami(req)).thenReturn(requesterA);
        when(locationService.findById(9L)).thenReturn(Optional.of(sharedLocation));
        when(locationRepository.findByIdAndCompany_Id(9L, 1L)).thenReturn(Optional.of(sharedLocation));

        LocationShowDTO rawDto = new LocationShowDTO();
        rawDto.setCustomers(new ArrayList<>(Arrays.asList(miniOf(customerA), miniOf(customerB))));
        when(locationMapper.toShowDto(sharedLocation, locationService)).thenReturn(rawDto);

        LocationShowDTO result = controller.getById(9L, req);

        assertEquals(1, result.getCustomers().size());
        assertEquals(1L, result.getCustomers().get(0).getId());
        assertTrue(result.getCustomers().stream().noneMatch(c -> c.getId().equals(2L)),
                "Cliente B nao pode aparecer no DTO pro Requester A");
    }

    @Test
    void requesterB_exclusiveLocationOfA_isBlocked() {
        Location exclusiveToA = new Location();
        exclusiveToA.setId(11L);
        exclusiveToA.setCompany(company);
        exclusiveToA.setCustomers(new ArrayList<>(Collections.singletonList(customerA)));

        User requesterB = requesterAllowedTo(customerB);
        when(userService.whoami(req)).thenReturn(requesterB);
        when(locationService.findById(11L)).thenReturn(Optional.of(exclusiveToA));
        when(locationRepository.findByIdAndCompany_Id(11L, 1L)).thenReturn(Optional.of(exclusiveToA));

        assertThrows(CustomException.class, () -> controller.getById(11L, req));
    }

    @Test
    void admin_sharedLocation_seesFullCustomerList() {
        User admin = new User();
        admin.setId(99L);
        admin.setCompany(company);
        admin.setRole(Role.builder().code(RoleCode.ADMIN).roleType(RoleType.ROLE_CLIENT).build());
        // Admin ainda depende de PermissionEntity.LOCATIONS.viewPermissions -
        // atribui pra simular um Admin real (Helper.getDefaultRoles()).
        admin.getRole().setViewPermissions(new java.util.HashSet<>(java.util.Collections.singletonList(
                com.grash.model.enums.PermissionEntity.LOCATIONS)));
        admin.getRole().setViewOtherPermissions(new java.util.HashSet<>(java.util.Collections.singletonList(
                com.grash.model.enums.PermissionEntity.LOCATIONS)));

        when(userService.whoami(req)).thenReturn(admin);
        when(locationService.findById(9L)).thenReturn(Optional.of(sharedLocation));

        LocationShowDTO rawDto = new LocationShowDTO();
        rawDto.setCustomers(new ArrayList<>(Arrays.asList(miniOf(customerA), miniOf(customerB))));
        when(locationMapper.toShowDto(sharedLocation, locationService)).thenReturn(rawDto);

        LocationShowDTO result = controller.getById(9L, req);

        assertEquals(2, result.getCustomers().size());
    }
}
