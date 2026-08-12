package com.grash.controller;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.AssetMiniDTO;
import com.grash.dto.AssetPatchDTO;
import com.grash.dto.AssetPostDTO;
import com.grash.dto.AssetShowDTO;
import com.grash.dto.CustomerMiniDTO;
import com.grash.dto.SuccessResponse;
import com.grash.dto.license.LicenseEntitlement;
import com.grash.exception.CustomException;
import com.grash.mapper.AssetMapper;
import com.grash.model.Asset;
import com.grash.model.Location;
import com.grash.model.User;
import com.grash.model.Part;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.repository.AssetRepository;
import com.grash.security.CurrentUser;
import com.grash.service.*;
import com.grash.utils.Helper;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/assets")
@Tag(name = "Assets", description = "Operations on assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetService assetService;
    private final AssetMapper assetMapper;
    private final UserService userService;
    private final LocationService locationService;
    private final PartService partService;
    private final MessageSource messageSource;
    private final EntityManager em;
    private final LicenseService licenseService;
    private final RateLimiterService rateLimiterService;
    private final RequestPortalService requestPortalService;
    private final AssetRepository assetRepository;
    private final CustomerScopeService customerScopeService;

    // Asset pode ser legitimamente compartilhado entre Clientes A e B; um
    // Requester escopado so a A pode acessar (assertCanAccessAsset/
    // findAllowedAssets ja garantem isso), mas a REPRESENTACAO nao pode
    // revelar o Cliente B. So filtra o campo customers do DTO - nunca o
    // relacionamento real no banco. No-op pra Admin/escopo amplo.
    private AssetShowDTO toScopedShowDto(AssetShowDTO dto, User user) {
        dto.setCustomers(customerScopeService.filterCustomerMiniDTOs(user, dto.getCustomers(),
                CustomerMiniDTO::getId));
        return dto;
    }

    // Pagina de verdade sobre uma List ja filtrada em memoria (Customer
    // Scope nao da pra empurrar pro banco nesses 2 pontos sem reescrever a
    // query) - fatia por pageNum/pageSize de fato, em vez de devolver a
    // colecao inteira em toda pagina (PageImpl(list, pageable, list.size())
    // usa pageable so pro metadado do Page, nao filtra o conteudo).
    // findAllowedAssets nao aceita Sort (retorna do repositorio sem ordenar)
    // - constroi um Comparator generico a partir do Pageable.getSort() via
    // BeanWrapperImpl (acesso a propriedade por nome, igual o Spring usa
    // internamente pra binding), pra ordenar em memoria antes de paginar.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private <T> java.util.Comparator<T> comparatorFor(org.springframework.data.domain.Sort sort) {
        java.util.Comparator<T> comparator = null;
        for (org.springframework.data.domain.Sort.Order order : sort) {
            java.util.Comparator<T> orderComparator = (a, b) -> {
                Object va = new org.springframework.beans.BeanWrapperImpl(a).getPropertyValue(order.getProperty());
                Object vb = new org.springframework.beans.BeanWrapperImpl(b).getPropertyValue(order.getProperty());
                if (va == null && vb == null) return 0;
                if (va == null) return order.isAscending() ? -1 : 1;
                if (vb == null) return order.isAscending() ? 1 : -1;
                int result = ((Comparable) va).compareTo(vb);
                return order.isAscending() ? result : -result;
            };
            comparator = comparator == null ? orderComparator : comparator.thenComparing(orderComparator);
        }
        return comparator;
    }

    private <T> Page<T> pageOf(List<T> content, Pageable pageable) {
        int start = (int) pageable.getOffset();
        if (start >= content.size()) {
            return new org.springframework.data.domain.PageImpl<>(java.util.Collections.emptyList(), pageable,
                    content.size());
        }
        int end = Math.min(start + pageable.getPageSize(), content.size());
        return new org.springframework.data.domain.PageImpl<>(content.subList(start, end), pageable, content.size());
    }

    @PostMapping("/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Page<AssetShowDTO>> search(@Parameter(description = "Search criteria for filtering assets") @RequestBody SearchCriteria searchCriteria,
                                                     HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (customerScopeService.isRequester(user)) {
                searchCriteria.filterCompany(user);
                // Customer Scope da QUERY agora e' aplicado dentro de
                // assetService.findBySearchCriteria (Specification dedicada -
                // ver CustomerScopeService.customerScopeSpecification).
            } else if (user.getRole().getViewPermissions().contains(PermissionEntity.ASSETS)) {
                searchCriteria.filterCompany(user);
                boolean canViewOthers = user.getRole().getViewOtherPermissions().contains(PermissionEntity.ASSETS);
                if (!canViewOthers) {
                    searchCriteria.filterCreatedBy(user);
                }
            } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
        }
        Page<AssetShowDTO> rawPage = assetService.findBySearchCriteria(searchCriteria, user);
        return ResponseEntity.ok(rawPage.map(dto -> toScopedShowDto(dto, user)));
    }

    @GetMapping("/nfc")
    @PreAuthorize("permitAll()")
    public AssetMiniDTO getByNfcId(@RequestParam @Parameter(description = "NFC identifier of the asset") String nfcId,
                                   @Parameter(hidden = true) @CurrentUser User user) {
        if (!licenseService.hasEntitlement(LicenseEntitlement.NFC_BARCODE))
            throw new CustomException("You need a license to scan an asset", HttpStatus.FORBIDDEN);
        Optional<Asset> optionalAsset = assetService.findByNfcIdAndCompany(nfcId, user.getCompany().getId());
        if (!optionalAsset.isPresent()) throw new CustomException("Not found", HttpStatus.NOT_FOUND);
        Asset savedAsset = optionalAsset.get();
        if (customerScopeService.isRequester(user)) {
            customerScopeService.assertCanAccessAsset(user, savedAsset.getId());
        }
        return assetMapper.toMiniDto(savedAsset);
    }

    @GetMapping("/barcode")
    @PreAuthorize("permitAll()")
    public AssetMiniDTO getByBarcode(@RequestParam @Parameter(description = "Barcode of the asset") String data,
                                     @Parameter(hidden = true) @CurrentUser User user) {
        if (!licenseService.hasEntitlement(LicenseEntitlement.NFC_BARCODE))
            throw new CustomException("You need a license to scan an asset", HttpStatus.FORBIDDEN);
        Optional<Asset> optionalAsset = assetService.findByBarcodeAndCompany(data, user.getCompany().getId());
        if (!optionalAsset.isPresent()) throw new CustomException("Not found", HttpStatus.NOT_FOUND);
        Asset savedAsset = optionalAsset.get();
        if (customerScopeService.isRequester(user)) {
            customerScopeService.assertCanAccessAsset(user, savedAsset.getId());
        }
        return assetMapper.toMiniDto(savedAsset);
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")
    public AssetShowDTO getById(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Asset> optionalAsset = assetService.findById(id);
        return getAsset(optionalAsset, user);
    }

    private AssetShowDTO getAsset(Optional<Asset> optionalAsset, User user) {
        if (optionalAsset.isPresent()) {
            Asset savedAsset = optionalAsset.get();
            if (customerScopeService.isRequester(user)) {
                customerScopeService.assertCanAccessAsset(user, savedAsset.getId());
                return toScopedShowDto(assetMapper.toShowDto(savedAsset, assetService), user);
            }
            if (user.getRole().getViewPermissions().contains(PermissionEntity.ASSETS) &&
                    (user.getRole().getViewOtherPermissions().contains(PermissionEntity.ASSETS) || savedAsset.getCreatedBy().equals(user.getId()))) {
                return toScopedShowDto(assetMapper.toShowDto(savedAsset, assetService), user);
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/location/{id}")
    @PreAuthorize("permitAll()")
    public Collection<AssetShowDTO> getByLocation(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Location> optionalLocation = locationService.findById(id);
        if (optionalLocation.isPresent()) {
            if (customerScopeService.isRequester(user)) {
                customerScopeService.assertCanAccessLocation(user, id);
            }
            return customerScopeService.findAllowedAssets(user, id).stream().map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user)).collect(Collectors.toList());
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }


    @GetMapping("/part/{id}")
    @PreAuthorize("permitAll()")
    public Collection<AssetShowDTO> getByPart(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Part> optionalPart = partService.findById(id);
        if (optionalPart.isPresent()) {
            Collection<Asset> assets = optionalPart.get().getAssets();
            if (customerScopeService.isRequester(user)) {
                java.util.Set<Long> allowedAssetIds = customerScopeService.findAllowedAssets(user, null).stream()
                        .map(Asset::getId).collect(Collectors.toSet());
                assets = assets.stream().filter(asset -> allowedAssetIds.contains(asset.getId())).collect(Collectors.toList());
            }
            return assets.stream().map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user)).collect(Collectors.toList());
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/children/{id}")
    @PreAuthorize("permitAll()")
    public List<AssetShowDTO> getChildrenById(@PathVariable("id") Long id,
                                              Pageable pageable,
                                              HttpServletRequest req) {
        User user = userService.whoami(req);
        if (id.equals(0L) && user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (customerScopeService.isRequester(user)) {
                return customerScopeService.findAllowedAssets(user, null).stream().filter(asset -> asset.getParentAsset() == null).map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user)).collect(Collectors.toList());
            }
            return assetService.findByCompanyAndParentAssetNull(user.getCompany().getId(), pageable).stream().map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user)).collect(Collectors.toList());
        }
        Optional<Asset> optionalAsset = assetService.findById(id);
        if (optionalAsset.isPresent()) {
            Asset savedAsset = optionalAsset.get();
            if (customerScopeService.isRequester(user)) {
                customerScopeService.assertCanAccessAsset(user, savedAsset.getId());
                return assetService.findAssetChildren(id, pageable.getSort()).stream()
                        .filter(asset -> customerScopeService.findAllowedAssets(user, null).stream().anyMatch(allowed -> allowed.getId().equals(asset.getId())))
                        .map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user)).collect(Collectors.toList());
            }
            if (user.getRole().getViewPermissions().contains(PermissionEntity.ASSETS)) {
                return assetService.findAssetChildren(id, pageable.getSort()).stream()
                        .map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user))
                        .collect(Collectors.toList());
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);

        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/children/{id}/paginated")
    @PreAuthorize("permitAll()")
    public Page<AssetShowDTO> getChildrenByIdPaginated(@PathVariable("id") Long id,
                                                       Pageable pageable,
                                                       HttpServletRequest req) {
        User user = userService.whoami(req);
        if (id.equals(0L) && user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (customerScopeService.isRequester(user)) {
                List<Asset> allowedAssets = customerScopeService.findAllowedAssets(user, null).stream()
                        .filter(asset -> asset.getParentAsset() == null).collect(Collectors.toList());
                if (pageable.getSort().isSorted()) {
                    allowedAssets.sort(comparatorFor(pageable.getSort()));
                }
                return pageOf(allowedAssets, pageable).map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user));
            }
            Page<Asset> assetsPage = assetRepository.findByCompany_IdAndParentAssetIsNull(user.getCompany().getId(),
                    pageable);
            return assetsPage.map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user));
        }
        Optional<Asset> optionalAsset = assetService.findById(id);
        if (optionalAsset.isPresent()) {
            Asset savedAsset = optionalAsset.get();
            if (customerScopeService.isRequester(user)) {
                customerScopeService.assertCanAccessAsset(user, savedAsset.getId());
                // Mesmo filtro de filhos ja aplicado na versao NAO paginada
                // (getChildrenById) - o pai acessivel nao garante que TODO
                // filho tambem esteja no escopo (pai A, filho exclusivo de
                // B). Sem isso, essa versao paginada vazava filhos fora do
                // escopo que a nao-paginada ja bloqueava.
                List<Asset> allowedChildren = assetService.findAssetChildren(id, pageable.getSort()).stream()
                        .filter(asset -> customerScopeService.findAllowedAssets(user, null).stream()
                                .anyMatch(allowed -> allowed.getId().equals(asset.getId())))
                        .collect(Collectors.toList());
                // pageOf: pagina de verdade (fatia pageNum/pageSize sobre a
                // lista ja filtrada por escopo, ja ordenada por
                // findAssetChildren(id, sort)) - a versao anterior colocava a
                // colecao INTEIRA em toda pagina (PageImpl(list, pageable,
                // list.size()) ignora pageable pra montar o conteudo, so usa
                // pra metadado), entao pageSize/pageNum nao tinham efeito
                // nenhum no resultado.
                return pageOf(allowedChildren, pageable).map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user));
            }
            if (user.getRole().getViewPermissions().contains(PermissionEntity.ASSETS)) {
                Page<Asset> assetsPage = assetService.findAssetChildren(id, pageable);
                return assetsPage.map(asset -> toScopedShowDto(assetMapper.toShowDto(asset, assetService), user));
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);

        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @PostMapping("")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public AssetShowDTO create(@Parameter(description = "Asset data to create") @Valid @RequestBody AssetPostDTO assetReq,
                               HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getCreatePermissions().contains(PermissionEntity.ASSETS)) {
            if (assetReq.getBarCode() != null) {
                Optional<Asset> optionalAssetWithSameBarCode =
                        assetService.findByBarcodeAndCompany(assetReq.getBarCode(), user.getCompany().getId());
                if (optionalAssetWithSameBarCode.isPresent()) {
                    throw new CustomException("Asset with same barCode exists", HttpStatus.NOT_ACCEPTABLE);
                }
            }
            if (assetReq.getNfcId() != null) {
                Optional<Asset> optionalAssetWithSameNfcId = assetService.findByNfcIdAndCompany(assetReq.getNfcId(),
                        user.getCompany().getId());
                if (optionalAssetWithSameNfcId.isPresent()) {
                    throw new CustomException("Asset with same nfc code exists", HttpStatus.NOT_ACCEPTABLE);
                }
            }
            Asset createdAsset = assetService.create(assetReq, user);
            String message = messageSource.getMessage("notification_asset_assigned",
                    new Object[]{createdAsset.getName()}, Helper.getLocale(user));
            assetService.notify(createdAsset, messageSource.getMessage("new_assignment", null,
                    Helper.getLocale(user)), message);
            return assetMapper.toShowDto(createdAsset, assetService);
        } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public AssetShowDTO patch(@Parameter(description = "Asset fields to update") @Valid @RequestBody AssetPatchDTO asset,
                              @PathVariable("id") Long id,
                              HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Asset> optionalAsset = assetService.findById(id);

        if (optionalAsset.isPresent()) {
            Asset savedAsset = optionalAsset.get();
            em.detach(savedAsset);
            if (user.getRole().getEditOtherPermissions().contains(PermissionEntity.ASSETS) || savedAsset.getCreatedBy().equals(user.getId())
            ) {
                if (!asset.getStatus().isReallyDown() && savedAsset.getStatus().isReallyDown()) {
                    assetService.stopDownTime(savedAsset.getId(), Helper.getLocale(user));
                } else if (asset.getStatus().isReallyDown() && !savedAsset.getStatus().isReallyDown()) {
                    assetService.triggerDownTime(savedAsset.getId(), Helper.getLocale(user), asset.getStatus());
                }
                if (asset.getBarCode() != null) {
                    Optional<Asset> optionalAssetWithSameBarCode =
                            assetService.findByBarcodeAndCompany(asset.getBarCode(), user.getCompany().getId());
                    if (optionalAssetWithSameBarCode.isPresent() && !optionalAssetWithSameBarCode.get().getId().equals(id)) {
                        throw new CustomException("Asset with same barcode exists", HttpStatus.NOT_ACCEPTABLE);
                    }
                }
                if (asset.getNfcId() != null) {
                    Optional<Asset> optionalAssetWithSameNfcId = assetService.findByNfcIdAndCompany(asset.getNfcId(),
                            user.getCompany().getId());
                    if (optionalAssetWithSameNfcId.isPresent() && !optionalAssetWithSameNfcId.get().getId().equals(id)) {
                        throw new CustomException("Asset with same nfc code exists", HttpStatus.NOT_ACCEPTABLE);
                    }
                }
                if (asset.getParentAsset() != null && asset.getParentAsset().getId().equals(id))
                    throw new CustomException("Parent asset cannot be the same id", HttpStatus.NOT_ACCEPTABLE);
                Asset patchedAsset = assetService.update(id, asset, user.getCompany());
                assetService.patchNotify(savedAsset, patchedAsset, Helper.getLocale(user));
                return assetMapper.toShowDto(patchedAsset, assetService);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Asset not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/mini")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public Collection<AssetMiniDTO> getMini(@RequestParam(required = false) @Parameter(description = "Filter assets " +
            "by location ID. If not provided, returns all assets") Long locationId,
                                            @RequestParam(required = false) @Parameter(description = "Filter assets " +
                                                    "by customer ID") Long customerId,
                                            @RequestParam(required = false, defaultValue = "false") @Parameter(description =
                                                    "When true, an absent customerId returns an empty list instead of every asset. " +
                                                            "Used by the Customer -> Location -> Asset flow, where no filter must mean no result.") boolean requireCustomer,
                                            HttpServletRequest req) {
        if (requireCustomer && customerId == null) {
            return Collections.emptyList();
        }
        User user = userService.whoami(req);
        List<Asset> assets = new ArrayList<>();
        if (locationId == null) {
            assets = customerScopeService.findAllowedAssets(user, null, customerId);
        } else {
            if (customerScopeService.isRequester(user)) {
                customerScopeService.assertCanAccessLocation(user, locationId);
            }
            assets = customerScopeService.findAllowedAssets(user, locationId, customerId);
        }
        return assets.stream().map(assetMapper::toMiniDto).collect(Collectors.toList());
    }

    @GetMapping("/public/mini/{portalUUID}")
    public Collection<AssetMiniDTO> getMiniPublic(@PathVariable String portalUUID,
                                                  @RequestParam(required = false) @Parameter(description = "Filter " +
                                                          "assets by location ID. If not provided, returns all assets" +
                                                          " for the portal") Long locationId,
                                                  HttpServletRequest req) {
        String clientIp = Helper.extractClientIp(req);
        if (!rateLimiterService.resolvePublicMiniBucket(clientIp).tryConsume(1)) {
            throw new CustomException("Rate limit exceeded. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }
        List<Asset> assets = new ArrayList<>();
        Long companyId = requestPortalService.findByUuidByUser(portalUUID).get().getCompany().getId();
        if (locationId == null) {
            assets = assetService.findByCompany(companyId);
        } else {
            assets = assetService.findByLocation(locationId);
        }
        return assets.stream().map(assetMapper::toMiniDto).collect(Collectors.toList());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<SuccessResponse> delete(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);

        Optional<Asset> optionalAsset = assetService.findById(id);
        if (optionalAsset.isPresent()) {
            Asset savedAsset = optionalAsset.get();
            if (user.getId().equals(savedAsset.getCreatedBy()) ||
                    user.getRole().getDeleteOtherPermissions().contains(PermissionEntity.ASSETS)) {
                assetService.delete(id);
                return new ResponseEntity<>(new SuccessResponse(true, "Deleted successfully"),
                        HttpStatus.OK);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Asset not found", HttpStatus.NOT_FOUND);
    }

}



