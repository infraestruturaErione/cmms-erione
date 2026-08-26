package com.grash.controller;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.LocationOperationalSummaryDTO;
import com.grash.dto.LocationShowDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.LocationMapper;
import com.grash.model.Company;
import com.grash.model.Location;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Reforma de Locations/Customer, Etapa 1: /locations/search agora e' um
 * UNICO caminho (findBySearchCriteria, DB-side) pros 3 tipos de usuario -
 * antes, ROLE_CLIENT comum caia no findByCompanySearch quebrado (removido).
 * Cobre exatamente a autorizacao que precisa sobreviver a unificacao:
 * viewPermissions/viewOtherPermissions/createdBy, e o novo endpoint de
 * summary reaproveitando a mesma regra de getById.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LocationSearchAndSummaryAuthorizationTest {

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
    private LocationOperationalService locationOperationalService;
    @Mock
    private HttpServletRequest req;

    private CustomerScopeService customerScopeService;
    private LocationController controller;
    private Company company;

    @BeforeEach
    void setUp() {
        customerScopeService = new CustomerScopeService(customerRepository, locationRepository, assetRepository);
        controller = new LocationController(locationService, locationMapper, userService, em, rateLimiterService,
                requestPortalService, customerScopeService, locationOperationalService);

        company = new Company();
        company.setId(1L);
    }

    private User regularUser(boolean canView, boolean canViewOther) {
        Role role = new Role();
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setCode(RoleCode.TECHNICIAN);
        Set<PermissionEntity> view = canView ? new HashSet<>(List.of(PermissionEntity.LOCATIONS)) : new HashSet<>();
        role.setViewPermissions(view);
        role.setViewOtherPermissions(canViewOther ? new HashSet<>(List.of(PermissionEntity.LOCATIONS)) :
                new HashSet<>());
        User user = new User();
        user.setId(5L);
        user.setCompany(company);
        user.setRole(role);
        return user;
    }

    private Page<LocationShowDTO> emptyPage() {
        return new PageImpl<>(List.of(), Pageable.ofSize(10), 0);
    }

    // Sem PermissionEntity.LOCATIONS.viewPermissions - continua bloqueado,
    // exatamente como antes da unificacao (agora expresso no inicio do
    // metodo, nao mais dentro do ramo separado findByCompanySearch).
    @Test
    void regularUser_withoutViewPermission_isForbidden() {
        User user = regularUser(false, false);
        when(userService.whoami(req)).thenReturn(user);

        assertThrows(CustomException.class, () -> controller.search(new SearchCriteria(), req));
    }

    // Com view mas SEM viewOther - precisa aplicar filterCreatedBy (era o
    // Stream.filter em memoria do findByCompanySearch quebrado; agora e'
    // FilterField DB-side).
    @Test
    void regularUser_withoutViewOther_appliesCreatedByFilterField() {
        User user = regularUser(true, false);
        when(userService.whoami(req)).thenReturn(user);
        when(locationService.findBySearchCriteria(any(), any())).thenReturn(emptyPage());

        controller.search(new SearchCriteria(), req);

        ArgumentCaptor<SearchCriteria> captor = ArgumentCaptor.forClass(SearchCriteria.class);
        org.mockito.Mockito.verify(locationService).findBySearchCriteria(captor.capture(), any());
        boolean hasCreatedByFilter = captor.getValue().getFilterFields().stream()
                .anyMatch(f -> "createdBy".equals(f.getField()) && user.getId().equals(f.getValue()));
        boolean hasCompanyFilter = captor.getValue().getFilterFields().stream()
                .anyMatch(f -> "company".equals(f.getField()));
        assertEquals(true, hasCreatedByFilter);
        assertEquals(true, hasCompanyFilter);
    }

    // Com viewOther - NAO aplica createdBy (ve tudo da company).
    @Test
    void regularUser_withViewOther_doesNotApplyCreatedByFilter() {
        User user = regularUser(true, true);
        when(userService.whoami(req)).thenReturn(user);
        when(locationService.findBySearchCriteria(any(), any())).thenReturn(emptyPage());

        controller.search(new SearchCriteria(), req);

        ArgumentCaptor<SearchCriteria> captor = ArgumentCaptor.forClass(SearchCriteria.class);
        org.mockito.Mockito.verify(locationService).findBySearchCriteria(captor.capture(), any());
        boolean hasCreatedByFilter = captor.getValue().getFilterFields().stream()
                .anyMatch(f -> "createdBy".equals(f.getField()));
        assertEquals(false, hasCreatedByFilter);
    }

    // ------------------------ Summary endpoint ------------------------

    @Test
    void summary_locationNotFound_throwsNotFound() {
        User user = regularUser(true, true);
        when(userService.whoami(req)).thenReturn(user);
        when(locationService.findById(99L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class, () -> controller.getOperationalSummary(99L, req));
        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
    }

    @Test
    void summary_withoutViewPermission_isForbidden() {
        User user = regularUser(false, false);
        when(userService.whoami(req)).thenReturn(user);
        Location location = new Location();
        location.setId(7L);
        location.setCompany(company);
        when(locationService.findById(7L)).thenReturn(Optional.of(location));

        CustomException ex = assertThrows(CustomException.class, () -> controller.getOperationalSummary(7L, req));
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    // View mas sem viewOther, e a Location foi criada por OUTRO usuario -
    // mesma regra de getById, agora tambem cobrindo o summary novo.
    @Test
    void summary_withoutViewOther_andNotOwnLocation_isForbidden() {
        User user = regularUser(true, false);
        when(userService.whoami(req)).thenReturn(user);
        Location location = new Location();
        location.setId(7L);
        location.setCompany(company);
        location.setCreatedBy(999L);
        when(locationService.findById(7L)).thenReturn(Optional.of(location));

        CustomException ex = assertThrows(CustomException.class, () -> controller.getOperationalSummary(7L, req));
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void summary_authorized_returnsDto() {
        User user = regularUser(true, true);
        when(userService.whoami(req)).thenReturn(user);
        Location location = new Location();
        location.setId(7L);
        location.setCompany(company);
        location.setCreatedBy(999L);
        when(locationService.findById(7L)).thenReturn(Optional.of(location));
        LocationOperationalSummaryDTO dto = LocationOperationalSummaryDTO.builder().totalAssets(24).build();
        when(locationOperationalService.getSummary(user, 7L)).thenReturn(dto);

        ResponseEntity<LocationOperationalSummaryDTO> response = controller.getOperationalSummary(7L, req);

        assertEquals(24, response.getBody().getTotalAssets());
    }
}
