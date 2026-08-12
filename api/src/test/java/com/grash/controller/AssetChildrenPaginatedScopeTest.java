package com.grash.controller;

import com.grash.dto.AssetShowDTO;
import com.grash.mapper.AssetMapper;
import com.grash.model.Asset;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.RoleCode;
import com.grash.repository.AssetRepository;
import com.grash.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Item 4 do pedido de correcao (2a rodada): GET /assets/children/{id}/
 * paginated nao aplicava o mesmo filtro de customer scope nos FILHOS que a
 * versao nao-paginada (getChildrenById) ja aplicava - pai acessivel (A) nao
 * garante que TODO filho tambem esteja no escopo (filho exclusivo de B).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AssetChildrenPaginatedScopeTest {

    @Mock
    private AssetService assetService;
    @Mock
    private AssetMapper assetMapper;
    @Mock
    private UserService userService;
    @Mock
    private LocationService locationService;
    @Mock
    private PartService partService;
    @Mock
    private MessageSource messageSource;
    @Mock
    private EntityManager em;
    @Mock
    private LicenseService licenseService;
    @Mock
    private RateLimiterService rateLimiterService;
    @Mock
    private RequestPortalService requestPortalService;
    @Mock
    private AssetRepository assetRepository;
    @Mock
    private CustomerScopeService customerScopeService;
    @Mock
    private HttpServletRequest req;

    private AssetController controller;
    private Company company;
    private User requesterA;

    @BeforeEach
    void setUp() {
        controller = new AssetController(assetService, assetMapper, userService, locationService, partService,
                messageSource, em, licenseService, rateLimiterService, requestPortalService, assetRepository,
                customerScopeService);
        company = new Company();
        company.setId(1L);
        requesterA = new User();
        requesterA.setId(152L);
        requesterA.setCompany(company);
        requesterA.setRole(Role.builder().code(RoleCode.REQUESTER).build());
        when(userService.whoami(req)).thenReturn(requesterA);
        when(customerScopeService.isRequester(requesterA)).thenReturn(true);
    }

    @Test
    void paginatedChildren_excludesChildOutOfScope_parentA_childB() {
        Asset parentA = new Asset();
        parentA.setId(10L);
        Asset childInScope = new Asset();
        childInScope.setId(11L);
        Asset childOutOfScope = new Asset(); // exclusivo do Cliente B
        childOutOfScope.setId(12L);

        Pageable pageable = PageRequest.of(0, 20);
        when(assetService.findById(10L)).thenReturn(Optional.of(parentA));
        when(assetService.findAssetChildren(eq(10L), any(Sort.class)))
                .thenReturn(Arrays.asList(childInScope, childOutOfScope));
        // findAllowedAssets so retorna o que esta no escopo do Requester A -
        // childOutOfScope nao entra nessa lista.
        when(customerScopeService.findAllowedAssets(requesterA, null))
                .thenReturn(Collections.singletonList(childInScope));
        when(assetMapper.toShowDto(any(Asset.class), any())).thenReturn(new AssetShowDTO());

        Page<AssetShowDTO> result = controller.getChildrenByIdPaginated(10L, pageable, req);

        // Asset.equals() gerado pelo Lombok (@Data) nao inclui o "id"
        // herdado - dois Asset() com so o id diferente comparam iguais, entao
        // a verificacao correta e' pela CONTAGEM final (2 filhos criados, 1
        // permitido pelo scope -> so 1 no resultado), nao por eq(childX) em
        // verify().
        assertEquals(1, result.getTotalElements());
        verify(assetMapper, times(1)).toShowDto(any(Asset.class), any());
    }

    // Mesmo cenario, agora comparando com a versao NAO paginada - ambas
    // precisam concordar (mesmo filtro).
    @Test
    void paginatedAndNonPaginated_agreeOnSameChildFiltering() {
        Asset parentA = new Asset();
        parentA.setId(20L);
        Asset childInScope = new Asset();
        childInScope.setId(21L);
        Asset childOutOfScope = new Asset();
        childOutOfScope.setId(22L);

        when(assetService.findById(20L)).thenReturn(Optional.of(parentA));
        when(assetService.findAssetChildren(eq(20L), any(Sort.class)))
                .thenReturn(Arrays.asList(childInScope, childOutOfScope));
        when(customerScopeService.findAllowedAssets(requesterA, null))
                .thenReturn(Collections.singletonList(childInScope));
        when(assetMapper.toShowDto(any(Asset.class), any())).thenReturn(new AssetShowDTO());

        List<AssetShowDTO> nonPaginated = controller.getChildrenById(20L, PageRequest.of(0, 20), req);
        Page<AssetShowDTO> paginated = controller.getChildrenByIdPaginated(20L, PageRequest.of(0, 20), req);

        assertEquals(nonPaginated.size(), (int) paginated.getTotalElements());
        assertEquals(1, nonPaginated.size());
    }

    // Item 5: Asset compartilhado entre A e B, legitimamente acessivel pelo
    // Requester A - o AssetShowDTO so pode mostrar Customer A.
    @Test
    void getById_sanitizesCustomersInResponse() {
        Asset sharedAsset = new Asset();
        sharedAsset.setId(30L);
        when(assetService.findById(30L)).thenReturn(Optional.of(sharedAsset));

        com.grash.model.Customer customerA = new com.grash.model.Customer();
        customerA.setId(1L);
        com.grash.model.Customer customerB = new com.grash.model.Customer();
        customerB.setId(2L);
        AssetShowDTO rawDto = new AssetShowDTO();
        com.grash.dto.CustomerMiniDTO miniA = new com.grash.dto.CustomerMiniDTO();
        miniA.setId(1L);
        com.grash.dto.CustomerMiniDTO miniB = new com.grash.dto.CustomerMiniDTO();
        miniB.setId(2L);
        rawDto.setCustomers(new java.util.ArrayList<>(Arrays.asList(miniA, miniB)));
        when(assetMapper.toShowDto(sharedAsset, assetService)).thenReturn(rawDto);

        List<com.grash.dto.CustomerMiniDTO> onlyA = Collections.singletonList(miniA);
        // doReturn (nao when/thenReturn) - evita o erro de inferencia
        // generica do compilador com List<CustomerMiniDTO> vs List<Object>
        // nesse metodo generico.
        doReturn(onlyA).when(customerScopeService).filterCustomerMiniDTOs(eq(requesterA), any(), any());

        AssetShowDTO result = controller.getById(30L, req);

        assertEquals(onlyA, result.getCustomers());
        assertTrue(result.getCustomers().stream().noneMatch(c -> c.getId().equals(2L)));
    }

    // Regressao (3a rodada, achado do Gepeto): a versao paginada filtrava os
    // filhos em memoria mas devolvia a COLECAO INTEIRA em toda pagina
    // (PageImpl(list, pageable, list.size()) usa pageable so pro metadado,
    // nao fatia o conteudo) - pageSize/pageNum nao tinham nenhum efeito no
    // resultado. Requester com 7 filhos permitidos e pageSize=5: page 0 tem
    // que trazer 5 itens (41-45), page 1 os 2 restantes (46-47).
    @Test
    void paginatedChildren_respectsPageNumAndPageSize_acrossTwoPages() {
        Asset parentA = new Asset();
        parentA.setId(40L);
        List<Asset> allowedChildren = new java.util.ArrayList<>();
        for (long childId = 41L; childId <= 47L; childId++) {
            Asset child = new Asset();
            child.setId(childId);
            allowedChildren.add(child);
        }

        when(assetService.findById(40L)).thenReturn(Optional.of(parentA));
        when(assetService.findAssetChildren(eq(40L), any(Sort.class))).thenReturn(allowedChildren);
        when(customerScopeService.findAllowedAssets(requesterA, null)).thenReturn(allowedChildren);
        when(assetMapper.toShowDto(any(Asset.class), any())).thenAnswer(invocation -> {
            Asset asset = invocation.getArgument(0);
            AssetShowDTO dto = new AssetShowDTO();
            dto.setId(asset.getId());
            return dto;
        });

        Page<AssetShowDTO> page0 = controller.getChildrenByIdPaginated(40L, PageRequest.of(0, 5), req);
        Page<AssetShowDTO> page1 = controller.getChildrenByIdPaginated(40L, PageRequest.of(1, 5), req);

        assertEquals(7, page0.getTotalElements());
        assertEquals(2, page0.getTotalPages());
        assertEquals(5, page0.getContent().size());
        assertEquals(List.of(41L, 42L, 43L, 44L, 45L),
                page0.getContent().stream().map(AssetShowDTO::getId).collect(java.util.stream.Collectors.toList()));

        assertEquals(2, page1.getContent().size());
        assertEquals(List.of(46L, 47L),
                page1.getContent().stream().map(AssetShowDTO::getId).collect(java.util.stream.Collectors.toList()));
    }
}
