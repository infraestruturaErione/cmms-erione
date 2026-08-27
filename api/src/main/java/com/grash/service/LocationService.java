package com.grash.service;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.advancedsearch.SpecificationBuilder;
import com.grash.dto.LocationPatchDTO;
import com.grash.dto.LocationPostDTO;
import com.grash.dto.LocationShowDTO;
import com.grash.dto.cutomField.CustomFieldValuePostDTO;
import com.grash.dto.imports.LocationImportDTO;
import com.grash.dto.license.LicenseEntitlement;
import com.grash.exception.CustomException;
import com.grash.mapper.LocationMapper;
import com.grash.model.*;
import com.grash.model.enums.CustomFieldEntityType;
import com.grash.model.enums.LocationReferenceType;
import com.grash.model.enums.NotificationType;
import com.grash.model.enums.webhook.WebhookEvent;
import com.grash.repository.LocationRepository;
import com.grash.service.CustomFieldValueService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;

import java.util.*;
import java.util.stream.Collectors;

import static com.grash.utils.Consts.usageBasedLicenseLimits;

@Service
@RequiredArgsConstructor
public class LocationService {
    private final LocationRepository locationRepository;
    private final UserService userService;
    private final CompanyService companyService;
    private final CustomerService customerService;
    private final MessageSource messageSource;
    private final VendorService vendorService;
    private final LocationMapper locationMapper;
    private final NotificationService notificationService;
    private final TeamService teamService;
    private final EntityManager em;
    private final FileService fileService;
    private final CustomSequenceService customSequenceService;
    private final LicenseService licenseService;
    private final WebhookDispatchService webhookDispatchService;
    private final CustomFieldValueService customFieldValueService;
    private final CustomerScopeService customerScopeService;

    @Transactional
    public Location create(Location location, Company company) {
        checkUsageBasedLimit(company);
        if (location instanceof LocationPostDTO locationPostDTO) {
            location = locationMapper.fromPostDto(locationPostDTO);
            if (locationPostDTO.getCustomFields() != null && !locationPostDTO.getCustomFields().isEmpty()) {
                setLocationCustomFields(location, locationPostDTO.getCustomFields(), company);
            }
        }
        location.setCustomId(getLocationNumber(company));
        normalizeAndValidateNewReference(location);

        Location savedLocation = locationRepository.saveAndFlush(location);
        em.refresh(savedLocation);
        Map<String, Object> webhookPayload = new HashMap<>();
        webhookPayload.put("locationId", savedLocation.getId());
        Object serializedLocation = locationMapper.toShowDto(savedLocation, this);
        webhookDispatchService.dispatchWebhook(company, WebhookEvent.NEW_LOCATION, webhookPayload,
                "newLocation", serializedLocation, null, null, null, null, null);
        return savedLocation;
    }

    @Transactional
    public Location update(Long id, LocationPatchDTO location, Company company) {
        if (locationRepository.existsById(id)) {
            Location savedLocation = locationRepository.findById(id).get();
            if (location.getCustomFields() != null && !location.getCustomFields().isEmpty()) {
                setLocationCustomFields(savedLocation, location.getCustomFields(), company);
            }
            Location mergedLocation = locationMapper.updateLocation(savedLocation, location);
            applyReferencePatch(mergedLocation, location);
            Location patchedLocation = locationRepository.saveAndFlush(mergedLocation);
            em.refresh(patchedLocation);
            return patchedLocation;
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    private void checkUsageBasedLimit(Company company) {
        Integer threshold = usageBasedLicenseLimits.get(LicenseEntitlement.UNLIMITED_LOCATIONS);
        if (!licenseService.hasEntitlement(LicenseEntitlement.UNLIMITED_LOCATIONS)
                && locationRepository.hasMoreThan(company.getId(), threshold.longValue() - 1
        ))
            throw new CustomException("You need a license to add a new location. Free Limit reached: " + threshold,
                    HttpStatus.FORBIDDEN);

    }

    public Collection<Location> getAll() {
        return locationRepository.findAll();
    }

    public void delete(Long id) {
        locationRepository.deleteById(id);
    }

    public Optional<Location> findById(Long id) {
        return locationRepository.findById(id);
    }

    public Collection<Location> findByCompany(Long id) {
        return locationRepository.findByCompany_Id(id);
    }

    public List<Location> findByCompanyForExport(Long companyId) {
        return locationRepository.findByCompanyForExport(companyId);
    }

    public List<Location> findByCompany(Long id, Sort sort) {
        return locationRepository.findByCompany_Id(id, sort);
    }


    public void notify(Location location, Locale locale) {
        String title = messageSource.getMessage("new_assignment", null, locale);
        String message = messageSource.getMessage("notification_location_assigned", new Object[]{location.getName()},
                locale);
        notificationService.createMultiple(location.getUsers().stream().map(user -> new Notification(message, user,
                NotificationType.LOCATION, location.getId())).collect(Collectors.toList()), true, title);
    }

    public void patchNotify(Location oldLocation, Location newLocation, Locale locale) {
        String title = messageSource.getMessage("new_assignment", null, locale);
        String message = messageSource.getMessage("notification_location_assigned",
                new Object[]{newLocation.getName()}, locale);
        notificationService.createMultiple(oldLocation.getNewUsersToNotify(newLocation.getUsers()).stream().map(user ->
                new Notification(message, user, NotificationType.LOCATION, newLocation.getId())).collect(Collectors.toList()), true, title);
    }

    public List<Location> findLocationChildren(Long id, Sort sort) {
        return locationRepository.findByParentLocation_Id(id, sort);
    }

    // Nivel raiz da hierarquia paginado de verdade (ver comentario em
    // LocationRepository.findByCompany_IdAndParentLocationIsNull) - so pro
    // caso id=0 em LocationController.getChildrenById.
    public Page<Location> findRootByCompany(Long companyId, Pageable pageable) {
        return locationRepository.findByCompany_IdAndParentLocationIsNull(companyId, pageable);
    }

    private String getLocationNumber(Company company) {
        Long nextSequence = customSequenceService.getNextLocationSequence(company);
        return "L" + String.format("%06d", nextSequence);
    }

    private void setLocationCustomFields(Location location, List<CustomFieldValuePostDTO> customFieldValuePostDTOS,
                                         Company company) {
        customFieldValueService.setCustomFields(
                location,
                location.getCustomFieldValues(),
                customFieldValuePostDTOS,
                company,
                CustomFieldEntityType.LOCATION,
                cfv -> cfv.setLocation(location)
        );
    }

    public void save(Location location) {
        locationRepository.save(location);
    }

    public List<Location> saveAll(List<Location> locations) {
        return locationRepository.saveAll(locations);
    }

    public boolean isLocationInCompany(Location location, long companyId, boolean optional) {
        if (optional) {
            Optional<Location> optionalLocation = location == null ? Optional.empty() : findById(location.getId());
            return location == null || (optionalLocation.isPresent() && optionalLocation.get().getCompany().getId().equals(companyId));
        } else {
            Optional<Location> optionalLocation = findById(location.getId());
            return optionalLocation.isPresent() && optionalLocation.get().getCompany().getId().equals(companyId);
        }
    }

    public List<Location> findByNameIgnoreCaseAndCompany(String locationName, Long companyId) {
        return locationRepository.findByNameIgnoreCaseAndCompany_Id(locationName, companyId);
    }

    public void setLocationFieldsFromImportDto(Location location, LocationImportDTO dto, Company company,
                                               Map<String, Location> locationsByName) {
        checkUsageBasedLimit(company);
        Long companyId = company.getId();
        location.setCompany(company);
        location.setName(dto.getName());
        location.setAddress(dto.getAddress());
        location.setLongitude(dto.getLongitude());
        location.setLatitude(dto.getLatitude());
        // Check parent location in batch first, then in database
        if (dto.getParentLocationName() != null && !dto.getParentLocationName().isEmpty()) {
            Location parentLocation = locationsByName != null ? locationsByName.get(dto.getParentLocationName()) : null;
            if (parentLocation == null) {
                parentLocation = findByNameIgnoreCaseAndCompany(dto.getParentLocationName(), companyId)
                        .stream().findFirst().orElse(null);
            }
            location.setParentLocation(parentLocation);
        }
        List<User> workers = new ArrayList<>();
        dto.getWorkersEmails().forEach(email -> {
            Optional<User> optionalUser1 = userService.findByEmailAndCompany(email, companyId);
            optionalUser1.ifPresent(workers::add);
        });
        location.setWorkers(workers);
        List<Team> teams = new ArrayList<>();
        dto.getTeamsNames().forEach(teamName -> {
            Optional<Team> optionalTeam = teamService.findByNameIgnoreCaseAndCompany(teamName, companyId);
            optionalTeam.ifPresent(teams::add);
        });
        location.setTeams(teams);
        location.setCustomId(getLocationNumber(company));
        List<Customer> customers = new ArrayList<>();
        dto.getCustomersNames().forEach(name -> {
            Optional<Customer> optionalCustomer = customerService.findByNameIgnoreCaseAndCompany(name, companyId);
            optionalCustomer.ifPresent(customers::add);
        });
        location.setCustomers(customers);
        List<Vendor> vendors = new ArrayList<>();
        dto.getVendorsNames().forEach(name -> {
            Optional<Vendor> optionalVendor = vendorService.findByNameIgnoreCaseAndCompany(name, companyId);
            optionalVendor.ifPresent(vendors::add);
        });
        location.setVendors(vendors);
//        locationRepository.save(location);
    }

    public Optional<Location> findByIdAndCompany(Long id, Long companyId) {
        return locationRepository.findByIdAndCompany_Id(id, companyId);
    }

    public List<Location> findByIdsAndCompany(List<Long> ids, Long companyId) {
        return locationRepository.findByIdInAndCompany_Id(ids, companyId);
    }

    // Caminho UNICO de busca de Location, agora usado pelos 3 tipos de
    // usuario (Requester, ROLE_CLIENT comum, super) - ver LocationController.
    // Antes disso, ROLE_CLIENT comum passava por findByCompanySearch (removido),
    // que carregava TODAS as Locations da company em memoria Java e paginava
    // com subList - o "N+1 de rede" que a reforma de Locations veio corrigir.
    // Toda paginacao/ordenacao/filtragem agora acontece no banco.
    public Page<LocationShowDTO> findBySearchCriteria(SearchCriteria searchCriteria, User user) {
        SpecificationBuilder<Location> builder = new SpecificationBuilder<>();
        searchCriteria.getFilterFields().forEach(builder::with);

        org.springframework.data.jpa.domain.Specification<Location> textSearchSpec =
                textSearchSpecification(searchCriteria.getSearch());
        if (textSearchSpec != null) {
            builder.with(textSearchSpec);
        }

        // Customer Scope como Specification dedicada, ANDada no nivel raiz
        // por fora da arvore de FilterField/alternatives controlada pelo
        // request - nunca representada como mais um FilterField (ver
        // CustomerScopeService.customerScopeSpecification).
        org.springframework.data.jpa.domain.Specification<Location> scopeSpec =
                customerScopeService.customerScopeSpecification(user, "customers");
        if (scopeSpec != null) {
            builder.with(scopeSpec);
        }
        Pageable page = PageRequest.of(searchCriteria.getPageNum(), searchCriteria.getPageSize(),
                searchCriteria.getDirection(), searchCriteria.getSortField());
        Page<Location> locations = locationRepository.findAll(builder.build(), page);

        // Batch de hasChildren pra pagina inteira - 1 query, nao 1 por linha
        // (ver LocationMapper.toFlatShowDto / LocationRepository.findParentIdsWithChildren).
        List<Long> pageIds = locations.getContent().stream().map(Location::getId).collect(Collectors.toList());
        Set<Long> idsWithChildren = pageIds.isEmpty()
                ? Collections.emptySet()
                : new HashSet<>(locationRepository.findParentIdsWithChildren(pageIds));

        return locations.map(location -> {
            LocationShowDTO dto = locationMapper.toFlatShowDto(location);
            dto.setHasChildren(idsWithChildren.contains(location.getId()));
            return dto;
        });
    }

    // Busca textual livre atravessando 4 campos: 3 diretos em Location (LIKE
    // simples) + 1 via relacao ManyToMany Location.customers (nome do
    // Customer vinculado). O ultimo usa EXISTS (subquery correlacionada),
    // NAO Root.join - um join de raiz sobre uma relacao many-valued
    // multiplicaria a linha da Location quando ela tem 2+ Customers cujo
    // nome bate com a busca (nao e' o caso comum aqui, mas o cenario real do
    // DEV2 - uma Location com 2 Customers - EXISTE, ver testes), o que
    // inflaria totalElements e exigiria DISTINCT (que quebra sort por coluna
    // de outro join no Postgres sob Hibernate 6 - mesmo motivo documentado
    // em CustomerScopeService.customerScopeSpecification). EXISTS nunca
    // multiplica linha do root, entao nunca precisa de DISTINCT aqui.
    // Visibilidade de pacote (nao private) de proposito: permite teste de
    // integracao direto contra H2 real (SpecificationBuilder + repository),
    // sem precisar montar toda a cadeia de dependencias de LocationService
    // so pra exercitar esta logica pura de Specification.
    static org.springframework.data.jpa.domain.Specification<Location> textSearchSpecification(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String trimmed = search.trim();

        org.springframework.data.jpa.domain.Specification<Location> prefixSpec =
                referencePrefixSearchSpecification(trimmed);
        if (prefixSpec != null) {
            return prefixSpec;
        }

        String likePattern = "%" + trimmed.toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> {
            jakarta.persistence.criteria.Predicate nameMatch =
                    cb.like(cb.lower(root.get("name")), likePattern);
            jakarta.persistence.criteria.Predicate addressMatch =
                    cb.like(cb.lower(root.get("address")), likePattern);
            jakarta.persistence.criteria.Predicate customIdMatch =
                    cb.like(cb.lower(root.get("customId")), likePattern);
            // Sem prefixo reconhecido - "15540" sozinho ainda encontra a
            // Location pelo codigo puro, seja ela ID ou PC.
            jakarta.persistence.criteria.Predicate referenceCodeMatch =
                    cb.like(cb.lower(root.get("referenceCode")), likePattern);

            jakarta.persistence.criteria.Subquery<Long> customerSubquery = query.subquery(Long.class);
            jakarta.persistence.criteria.Root<Location> correlatedRoot = customerSubquery.correlate(root);
            jakarta.persistence.criteria.Join<Object, Object> customerJoin =
                    correlatedRoot.join("customers", jakarta.persistence.criteria.JoinType.INNER);
            customerSubquery.select(customerJoin.get("id"));
            customerSubquery.where(cb.like(cb.lower(customerJoin.get("name")), likePattern));
            jakarta.persistence.criteria.Predicate customerNameMatch = cb.exists(customerSubquery);

            return cb.or(nameMatch, addressMatch, customIdMatch, referenceCodeMatch, customerNameMatch);
        };
    }

    public static List<LocationImportDTO> orderLocations(List<LocationImportDTO> locations) {
        Map<String, List<LocationImportDTO>> locationMap = new HashMap<>();
        List<LocationImportDTO> identifiedTopLevelLocations = new ArrayList<>();

        Set<String> allLocationNames = new HashSet<>();
        for (LocationImportDTO location : locations) {
            if (location.getName() != null) { // Guard against locations with null names if possible
                allLocationNames.add(location.getName());
            }
        }

        // Group locations by parent name and identify top-level locations
        // Using a HashSet here to ensure we only consider each unique location object once
        // for building the map and topLevelLocations, in case the input list has duplicate object references.
        Set<LocationImportDTO> distinctInputLocations = new HashSet<>(locations);

        for (LocationImportDTO location : distinctInputLocations) { // Iterate over unique location objects
            String parentName = location.getParentLocationName();
            locationMap.computeIfAbsent(parentName, k -> new ArrayList<>()).add(location);

            // An location is top-level if it has no parent,
            // or its declared parent doesn't exist in the provided list of locations.
            if (parentName == null || !allLocationNames.contains(parentName)) {
                identifiedTopLevelLocations.add(location);
            }
        }

        List<LocationImportDTO> orderedLocations = new ArrayList<>();
        Set<LocationImportDTO> visited = new HashSet<>(); // Keep track of visited locations

        // Process identified top-level locations.
        // The `visited` set will ensure each location is added only once,
        // even if it appears multiple times in `identifiedTopLevelLocations`
        // (e.g., multiple distinct orphan objects point to the same non-existent parent)
        // or if children of different top-level locations overlap due to same names.
        orderLocationsRecursive(locationMap, identifiedTopLevelLocations, orderedLocations, visited);

        return orderedLocations;
    }

    private static void orderLocationsRecursive(Map<String, List<LocationImportDTO>> locationMap,
                                                List<LocationImportDTO> currentLevelLocations,
                                                List<LocationImportDTO> orderedLocations,
                                                Set<LocationImportDTO> visited) {
        if (currentLevelLocations == null) {
            return;
        }
        for (LocationImportDTO location : currentLevelLocations) {
            // Only process and add the location if it hasn't been visited yet
            if (visited.add(location)) { // .add() returns true if the element was new to the set
                orderedLocations.add(location);
                List<LocationImportDTO> children = locationMap.get(location.getName());
                if (children != null) {
                    orderLocationsRecursive(locationMap, children, orderedLocations, visited);
                }
            }
        }
    }

    public boolean hasChildren(Long locationId) {
        return locationRepository.countByParentLocation_Id(locationId) > 0;
    }

    // Referencia Operacional (ID/PC) - CREATE: um Location novo nao tem
    // estado anterior pra preservar, entao a regra e' so' a invariante final
    // (ambos preenchidos ou ambos ausentes) aplicada direto nos campos que
    // vieram do LocationPostDTO (ja mapeados incondicionalmente por
    // LocationMapper.fromPostDto - sem @Mapping(ignore) la, propositalmente,
    // ja que create nao tem ambiguidade omitido-vs-limpeza).
    private void normalizeAndValidateNewReference(Location location) {
        String code = normalizeReferenceCode(location.getReferenceCode());
        location.setReferenceCode(code);
        if (!isValidReferenceState(location.getReferenceType(), code)) {
            throw new CustomException(REFERENCE_INVALID_STATE_MESSAGE, HttpStatus.BAD_REQUEST);
        }
    }

    // Referencia Operacional (ID/PC) - PATCH: referenceType/referenceCode sao
    // ignorados pelo mapeamento automatico do MapStruct
    // (@Mapping(target=..., ignore=true) em LocationMapper.updateLocation) e
    // aplicados aqui manualmente, porque a semantica de "campo omitido"
    // precisa ser DIFERENTE da dos demais campos escalares (que o MapStruct
    // sobrescreve incondicionalmente, inclusive com null - ver name/address
    // em LocationMapperImpl gerado). Um consumidor antigo que faz PATCH sem
    // conhecer estes 2 campos manda ambos ausentes no JSON, que chegam como
    // null no DTO - isso NUNCA pode apagar uma referencia ja existente.
    //
    // JSON nao distingue "chave ausente" de "chave enviada como null" (os
    // dois viram null no DTO apos o Jackson) - a unica forma de expressar
    // "limpar" sem introduzir JsonNullable/infraestrutura nova e' usar uma
    // string vazia em referenceCode (que so' chega assim se for enviada de
    // proposito) combinada com referenceType null:
    //
    //   referenceType=null, referenceCode=null  => nao informado, preserva
    //   referenceType=null, referenceCode=""    => limpar os dois
    //   referenceType=X,    referenceCode="abc" => define/altera para X/abc
    //   qualquer outra combinacao parcial        => invalido (400)
    private void applyReferencePatch(Location entity, LocationPatchDTO dto) {
        LocationReferenceType type = dto.getReferenceType();
        boolean typeOmitted = type == null;
        boolean codeOmitted = dto.getReferenceCode() == null;

        if (typeOmitted && codeOmitted) {
            return; // nao informado - preserva a referencia existente do entity
        }

        String code = normalizeReferenceCode(dto.getReferenceCode());
        boolean explicitClear = typeOmitted && !codeOmitted && code == null;
        if (explicitClear) {
            entity.setReferenceType(null);
            entity.setReferenceCode(null);
            return;
        }

        if (!isValidReferenceState(type, code)) {
            throw new CustomException(REFERENCE_INVALID_STATE_MESSAGE, HttpStatus.BAD_REQUEST);
        }
        entity.setReferenceType(type);
        entity.setReferenceCode(code);
    }

    private static final String REFERENCE_INVALID_STATE_MESSAGE =
            "referenceType and referenceCode must be both provided or both empty";

    // Trim + string vazia/so' espacos vira null - regra pura, reutilizada
    // tanto pelo caminho de create (normalizeAndValidateNewReference) quanto
    // pelo de patch (applyReferencePatch).
    private static String normalizeReferenceCode(String code) {
        if (code == null) return null;
        String trimmed = code.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    // Invariante final da Referencia Operacional - regra pura reutilizada
    // pelos dois fluxos (create/patch), cada um chegando ao (type, code) já
    // normalizado por um caminho de decisao diferente.
    private static boolean isValidReferenceState(LocationReferenceType type, String normalizedCode) {
        return (type != null) == (normalizedCode != null);
    }

    // Busca textual livre - reconhece um prefixo explicito "ID " ou "PC "
    // (case-insensitive) no INICIO do termo digitado e, quando presente,
    // transforma a busca numa condicao estruturada (referenceType = X AND
    // referenceCode LIKE resto) em vez de tentar casar o termo inteiro contra
    // qualquer coluna. Isso evita depender de CONCAT entre enum e string no
    // banco (pedido explicito) - a normalizacao acontece aqui, em Java, antes
    // de montar a Specification. Sem prefixo reconhecido, o termo cai no
    // fallback de busca livre (ver textSearchSpecification), que ja inclui
    // referenceCode entre os campos comparados via LIKE simples - cobre o
    // caso "15540" sem prefixo.
    private static org.springframework.data.jpa.domain.Specification<Location> referencePrefixSearchSpecification(
            String trimmedSearch) {
        for (LocationReferenceType type : LocationReferenceType.values()) {
            String prefix = type.name() + " ";
            if (trimmedSearch.regionMatches(true, 0, prefix, 0, prefix.length())) {
                String remainder = trimmedSearch.substring(prefix.length()).trim();
                if (remainder.isEmpty()) {
                    // "ID " ou "PC " sozinho, sem codigo depois - nao vira
                    // busca estruturada, cai no fallback de busca livre com o
                    // termo original (nao filtra por engano tudo do tipo).
                    return null;
                }
                String codeLikePattern = "%" + remainder.toLowerCase(Locale.ROOT) + "%";
                return (root, query, cb) -> cb.and(
                        cb.equal(root.get("referenceType"), type),
                        cb.like(cb.lower(root.get("referenceCode")), codeLikePattern)
                );
            }
        }
        return null;
    }
}

