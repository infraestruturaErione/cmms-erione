package com.grash.controller;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.LocationMiniDTO;
import com.grash.dto.LocationOperationalSummaryDTO;
import com.grash.dto.LocationPatchDTO;
import com.grash.dto.LocationPostDTO;
import com.grash.dto.LocationShowDTO;
import com.grash.dto.SuccessResponse;
import com.grash.exception.CustomException;
import com.grash.mapper.LocationMapper;
import com.grash.model.Location;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.service.LocationOperationalService;
import com.grash.service.LocationService;
import com.grash.service.CustomerScopeService;
import com.grash.service.RateLimiterService;
import com.grash.service.RequestPortalService;
import com.grash.service.UserService;
import com.grash.utils.Helper;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/locations")
@Tag(name = "Locations", description = "Operations on locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;
    private final LocationMapper locationMapper;
    private final UserService userService;
    private final EntityManager em;
    private final RateLimiterService rateLimiterService;
    private final RequestPortalService requestPortalService;
    private final CustomerScopeService customerScopeService;
    private final LocationOperationalService locationOperationalService;

    // Location pode ser legitimamente compartilhada entre Clientes A e B; um
    // Requester escopado so ao A pode acessar a Location (assertCanAccessLocation
    // ja garante isso), mas a REPRESENTACAO nao pode revelar o Cliente B pra
    // ele. So filtra o campo customers do DTO - nunca o relacionamento real no
    // banco. Admin/usuario com escopo amplo continua vendo a lista completa
    // (filterCustomerMiniDTOs e' no-op quando !isRequester).
    private LocationShowDTO toScopedShowDto(Location location, User user) {
        LocationShowDTO dto = locationMapper.toShowDto(location, locationService);
        dto.setCustomers(customerScopeService.filterCustomerMiniDTOs(user, dto.getCustomers(),
                com.grash.dto.CustomerMiniDTO::getId));
        return dto;
    }

    @GetMapping("")
    @PreAuthorize("permitAll()")
    public List<LocationShowDTO> getAll(HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (customerScopeService.isRequester(user)) {
                return customerScopeService.findAllowedLocations(user).stream()
                        .map(location -> toScopedShowDto(location, user)).collect(Collectors.toList());
            }
            if (user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS)) {
                return locationService.findByCompany(user.getCompany().getId()).stream().filter(location -> {
                    boolean canViewOthers =
                            user.getRole().getViewOtherPermissions().contains(PermissionEntity.LOCATIONS);
                    return canViewOthers || location.getCreatedBy().equals(user.getId());
                }).map(location -> toScopedShowDto(location, user)).collect(Collectors.toList());
            } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
        } else
            return locationService.getAll().stream().map(location -> toScopedShowDto(location, user))
                    .collect(Collectors.toList());
    }

    @PostMapping("/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Page<LocationShowDTO>> search(@Parameter(description = "Search criteria for filtering " +
                                                                    "locations") @RequestBody SearchCriteria searchCriteria,
                                                        HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (!customerScopeService.isRequester(user)
                    && !user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS)) {
                throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
            }
            searchCriteria.filterCompany(user);
            if (!customerScopeService.isRequester(user)
                    && !user.getRole().getViewOtherPermissions().contains(PermissionEntity.LOCATIONS)) {
                // Mesma restricao de antes (so ve o que criou) - agora
                // expressa como FilterField DB-side em vez de Stream.filter
                // em memoria (era o caminho quebrado findByCompanySearch).
                searchCriteria.filterCreatedBy(user);
            }
            // Customer Scope da QUERY e' aplicado dentro de
            // locationService.findBySearchCriteria (Specification dedicada,
            // ANDada por fora da arvore de FilterField do request - ver
            // CustomerScopeService.customerScopeSpecification). Cobre tanto
            // Requester quanto LIMITED_ADMIN - antes desta unificacao,
            // LIMITED_ADMIN caia no ramo findByCompanySearch, que nao
            // aplicava NENHUM scope de customer.
            Page<LocationShowDTO> rawPage = locationService.findBySearchCriteria(searchCriteria, user);
            if (customerScopeService.hasRestrictedCustomerScope(user)) {
                // Uma Location compartilhada A+B continua aparecendo pra
                // quem tem A, mas o campo customers do DTO so pode mostrar A
                // - nunca revelar a existencia do Customer B fora do escopo.
                rawPage = rawPage.map(dto -> {
                    dto.setCustomers(customerScopeService.filterCustomerMiniDTOs(user, dto.getCustomers(),
                            com.grash.dto.CustomerMiniDTO::getId));
                    return dto;
                });
            }
            return ResponseEntity.ok(rawPage);
        }
        return ResponseEntity.ok(locationService.findBySearchCriteria(searchCriteria, user));
    }

    @GetMapping("/{id}/summary")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<LocationOperationalSummaryDTO> getOperationalSummary(
            @Parameter(description = "Location ID") @PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        ensureLocationInCompanyAndReadable(id, user);
        return ResponseEntity.ok(locationOperationalService.getSummary(user, id));
    }

    // Mesma regra de acesso ja usada em getById (leitura) - extraida aqui
    // pra ser reaproveitada pelo novo endpoint de summary sem duplicar a
    // logica de novo.
    private Location ensureLocationInCompanyAndReadable(Long id, User user) {
        Optional<Location> optionalLocation = locationService.findById(id);
        if (optionalLocation.isEmpty()) {
            throw new CustomException("Not found", HttpStatus.NOT_FOUND);
        }
        Location savedLocation = optionalLocation.get();
        if (customerScopeService.isRequester(user)) {
            customerScopeService.assertCanAccessLocation(user, savedLocation.getId());
            return savedLocation;
        }
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS)) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (!savedLocation.getCompany().getId().equals(user.getCompany().getId())) {
                throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
            }
            boolean canViewOthers = user.getRole().getViewOtherPermissions().contains(PermissionEntity.LOCATIONS);
            if (!canViewOthers && !savedLocation.getCreatedBy().equals(user.getId())) {
                throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
            }
        }
        return savedLocation;
    }

    @GetMapping("/children/{id}")
    @PreAuthorize("permitAll()")

    public Collection<LocationShowDTO> getChildrenById(@Parameter(description = "Location ID") @PathVariable("id") Long id,
                                                       Pageable pageable,
                                                       HttpServletRequest req) {
        //only sort is used
        User user = userService.whoami(req);
        if (id.equals(0L) && user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (customerScopeService.isRequester(user)) {
                return customerScopeService.findAllowedLocations(user).stream().filter(location -> location.getParentLocation() == null).map(location -> toScopedShowDto(location, user)).collect(Collectors.toList());
            }
            return locationService.findByCompany(user.getCompany().getId(), pageable.getSort()).stream().filter(location -> location.getParentLocation() == null).map(location -> toScopedShowDto(location, user)).collect(Collectors.toList());
        }
        Optional<Location> optionalLocation = locationService.findById(id);
        if (optionalLocation.isPresent()) {
            Location savedLocation = optionalLocation.get();
            if (customerScopeService.isRequester(user)) {
                customerScopeService.assertCanAccessLocation(user, savedLocation.getId());
                return locationService.findLocationChildren(id, pageable.getSort()).stream()
                        .filter(location -> customerScopeService.findAllowedLocations(user).stream().anyMatch(allowed -> allowed.getId().equals(location.getId())))
                        .map(location -> toScopedShowDto(location, user)).collect(Collectors.toList());
            }
            if (user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS)) {
                return locationService.findLocationChildren(id, pageable.getSort()).stream().map(location -> toScopedShowDto(location, user)).collect(Collectors.toList());
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);

        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/mini")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public Collection<LocationMiniDTO> getMini(@RequestParam(required = false) @Parameter(description = "Filter " +
            "locations by customer ID") Long customerId,
                                               @RequestParam(required = false, defaultValue = "false") @Parameter(description =
                                                       "When true, an absent customerId returns an empty list instead of every location. " +
                                                               "Used by the Customer -> Location -> Asset flow, where no filter must mean no result.") boolean requireCustomer,
                                               HttpServletRequest req) {
        if (requireCustomer && customerId == null) {
            return Collections.emptyList();
        }
        User user = userService.whoami(req);
        return customerScopeService.findAllowedLocations(user, customerId).stream().map(locationMapper::toMiniDto).collect(Collectors.toList());
    }

    @GetMapping("/public/mini/{portalUUID}")
    public Collection<LocationMiniDTO> getMiniPublic(@Parameter(description = "Portal UUID") @PathVariable String portalUUID, HttpServletRequest req) {
        String clientIp = Helper.extractClientIp(req);
        if (!rateLimiterService.resolvePublicMiniBucket(clientIp).tryConsume(1)) {
            throw new CustomException("Rate limit exceeded. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }
        return locationService.findByCompany(requestPortalService.findByUuidByUser(portalUUID).get().getCompany().getId()).stream().map(locationMapper::toMiniDto).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public LocationShowDTO getById(@Parameter(description = "Location ID") @PathVariable("id") Long id,
                                   HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Location> optionalLocation = locationService.findById(id);
        if (optionalLocation.isPresent()) {
            Location savedLocation = optionalLocation.get();
            if (customerScopeService.isRequester(user)) {
                customerScopeService.assertCanAccessLocation(user, savedLocation.getId());
                return toScopedShowDto(savedLocation, user);
            }
            if (user.getRole().getViewPermissions().contains(PermissionEntity.LOCATIONS) &&
                    (user.getRole().getViewOtherPermissions().contains(PermissionEntity.LOCATIONS) || savedLocation.getCreatedBy().equals(user.getId()))) {
                return toScopedShowDto(savedLocation, user);
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @PostMapping("")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    LocationShowDTO create(@Parameter(description = "Location data to create") @Valid @RequestBody LocationPostDTO locationReq,
                           HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getCreatePermissions().contains(PermissionEntity.LOCATIONS)) {
            Location savedLocation = locationService.create(locationReq, user.getCompany());
            locationService.notify(savedLocation, Helper.getLocale(user));
            return toScopedShowDto(savedLocation, user);
        } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public LocationShowDTO patch(@Parameter(description = "Location fields to update") @Valid @RequestBody LocationPatchDTO location,
                                 @Parameter(description = "Location ID") @PathVariable("id") Long id,
                                 HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Location> optionalLocation = locationService.findById(id);
        if (optionalLocation.isPresent()) {
            Location savedLocation = optionalLocation.get();
            em.detach(savedLocation);
            if (user.getRole().getEditOtherPermissions().contains(PermissionEntity.LOCATIONS) || savedLocation.getCreatedBy().equals(user.getId())) {
                if (location.getParentLocation() != null && location.getParentLocation().getId().equals(id))
                    throw new CustomException("Parent location cannot be the same id", HttpStatus.NOT_ACCEPTABLE);

                Location patchedLocation = locationService.update(id, location, user.getCompany());
                locationService.patchNotify(savedLocation, patchedLocation, Helper.getLocale(user));
                return toScopedShowDto(patchedLocation, user);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Location not found", HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public ResponseEntity delete(@Parameter(description = "Location ID") @PathVariable("id") Long id,
                                 HttpServletRequest req) {
        User user = userService.whoami(req);

        Optional<Location> optionalLocation = locationService.findById(id);
        if (optionalLocation.isPresent()) {
            Location savedLocation = optionalLocation.get();
            if (user.getId().equals(savedLocation.getCreatedBy()) ||
                    user.getRole().getDeleteOtherPermissions().contains(PermissionEntity.LOCATIONS)) {
                locationService.delete(id);
                return new ResponseEntity(new SuccessResponse(true, "Deleted successfully"),
                        HttpStatus.OK);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Location not found", HttpStatus.NOT_FOUND);
    }

}



