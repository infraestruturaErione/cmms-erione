package com.grash.controller;

import com.grash.dto.AssetShowDTO;
import com.grash.dto.workOrder.WorkOrderShowDTO;
import com.grash.mapper.AssetMapper;
import com.grash.mapper.WorkOrderMapper;
import com.grash.model.Asset;
import com.grash.model.Company;
import com.grash.model.Part;
import com.grash.model.PartQuantity;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * P1 (achado do Gepeto, 3a rodada): GET /assets/part/{id} e
 * GET /work-orders/part/{id} devolviam TODOS os Asset/WorkOrder associados
 * a Part, sem nenhum filtro de Customer Scope - um Requester escopado a
 * Cliente A conseguia enumerar Assets/WorkOrders inteiros do Cliente B so
 * por eles compartilharem uma Part. Nao basta sanitizar o DTO - o recurso
 * B inteiro nao pode aparecer na resposta.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PartEndpointCustomerScopeTest {

    // --- AssetController.getByPart ---

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
    private org.springframework.context.MessageSource messageSource;
    @Mock
    private jakarta.persistence.EntityManager em;
    @Mock
    private LicenseService licenseService;
    @Mock
    private RateLimiterService rateLimiterService;
    @Mock
    private RequestPortalService requestPortalService;
    @Mock
    private com.grash.repository.AssetRepository assetRepository;
    @Mock
    private CustomerScopeService customerScopeService;

    // --- WorkOrderController.getByPart (dependencias extras) ---
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private WorkOrderMapper workOrderMapper;
    @Mock
    private PartQuantityService partQuantityService;

    @Mock
    private HttpServletRequest req;

    private AssetController assetController;
    private WorkOrderController workOrderController;
    private Company company;
    private User requesterA;

    @BeforeEach
    void setUp() {
        assetController = new AssetController(assetService, assetMapper, userService, locationService, partService,
                messageSource, em, licenseService, rateLimiterService, requestPortalService, assetRepository,
                customerScopeService);

        company = new Company();
        company.setId(1L);
        requesterA = new User();
        requesterA.setId(152L);
        requesterA.setCompany(company);
        Role requesterRole = new Role();
        requesterRole.setCode(RoleCode.REQUESTER);
        // WorkOrderController.getByPart usa canViewWorkOrderBase (nao
        // isAccessibleBy) como 1o filtro - viewOtherPermissions aqui isola o
        // que este teste quer provar (Customer Scope), que e' o 2o filtro.
        requesterRole.setViewOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        requesterA.setRole(requesterRole);
        when(userService.whoami(req)).thenReturn(requesterA);
        when(customerScopeService.isRequester(requesterA)).thenReturn(true);
    }

    private WorkOrderController buildWorkOrderController() {
        WorkOrderController controller = org.mockito.Mockito.mock(WorkOrderController.class,
                org.mockito.Mockito.CALLS_REAL_METHODS);
        // WorkOrderController tem dependencias demais pra construir via new(...)
        // sem repetir toda a lista - usamos reflection pra injetar so as que
        // getByPart realmente toca, igual @InjectMocks faria.
        setField(controller, "userService", userService);
        setField(controller, "workOrderService", workOrderService);
        setField(controller, "workOrderMapper", workOrderMapper);
        setField(controller, "partService", partService);
        setField(controller, "partQuantityService", partQuantityService);
        setField(controller, "customerScopeService", customerScopeService);
        return controller;
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = findField(target.getClass(), fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    private java.lang.reflect.Field findField(Class<?> type, String name) throws NoSuchFieldException {
        Class<?> current = type;
        while (current != null) {
            try {
                return current.getDeclaredField(name);
            } catch (NoSuchFieldException e) {
                current = current.getSuperclass();
            }
        }
        throw new NoSuchFieldException(name);
    }

    // A) Requester A (allowedCustomers=[Cliente A]) pedindo Assets de uma
    // Part associada a Asset de A e Asset de B -> so o Asset de A pode
    // voltar.
    @Test
    void assetGetByPart_requesterA_neverReturnsAssetOutOfScope() {
        Asset assetA = new Asset();
        assetA.setId(1L);
        Asset assetB = new Asset(); // exclusivo do Cliente B
        assetB.setId(2L);

        Part part = new Part();
        part.setId(900L);
        part.setAssets(new java.util.ArrayList<>(Arrays.asList(assetA, assetB)));
        when(partService.findById(900L)).thenReturn(Optional.of(part));

        // findAllowedAssets so retorna o que esta no escopo do Requester A.
        when(customerScopeService.findAllowedAssets(requesterA, null))
                .thenReturn(Collections.singletonList(assetA));
        when(assetMapper.toShowDto(any(Asset.class), any())).thenAnswer(invocation -> {
            Asset a = invocation.getArgument(0);
            AssetShowDTO dto = new AssetShowDTO();
            dto.setId(a.getId());
            return dto;
        });

        Collection<AssetShowDTO> result = assetController.getByPart(900L, req);

        assertEquals(1, result.size());
        assertTrue(result.stream().anyMatch(dto -> dto.getId().equals(1L)));
        assertTrue(result.stream().noneMatch(dto -> dto.getId().equals(2L)),
                "Asset exclusivo do Cliente B nunca pode aparecer pro Requester A");
    }

    // Controle: Admin (nao-Requester) continua vendo os dois Assets - sem
    // restricao adicional.
    @Test
    void assetGetByPart_admin_seesAllAssets() {
        User admin = new User();
        admin.setId(1L);
        admin.setCompany(company);
        Role adminRole = new Role();
        adminRole.setCode(RoleCode.ADMIN);
        admin.setRole(adminRole);
        when(userService.whoami(req)).thenReturn(admin);
        when(customerScopeService.isRequester(admin)).thenReturn(false);

        Asset assetA = new Asset();
        assetA.setId(1L);
        Asset assetB = new Asset();
        assetB.setId(2L);
        Part part = new Part();
        part.setId(901L);
        part.setAssets(new java.util.ArrayList<>(Arrays.asList(assetA, assetB)));
        when(partService.findById(901L)).thenReturn(Optional.of(part));
        when(assetMapper.toShowDto(any(Asset.class), any())).thenReturn(new AssetShowDTO());

        Collection<AssetShowDTO> result = assetController.getByPart(901L, req);

        assertEquals(2, result.size());
    }

    // B) Requester A pedindo WorkOrders de uma Part consumida por uma WO de
    // A e uma WO de B (via PartQuantity) -> so a WO de A pode voltar.
    @Test
    void workOrderGetByPart_requesterA_neverReturnsWorkOrderOutOfScope() {
        WorkOrderController controller = buildWorkOrderController();

        WorkOrder woA = new WorkOrder() {
            @Override
            public boolean isAccessibleBy(User user) {
                return true;
            }
        };
        woA.setId(10L);
        woA.setCompany(company);
        WorkOrder woB = new WorkOrder() {
            @Override
            public boolean isAccessibleBy(User user) {
                return true;
            }
        };
        woB.setId(20L);
        woB.setCompany(company);

        Part part = new Part();
        part.setId(910L);
        when(partService.findById(910L)).thenReturn(Optional.of(part));

        PartQuantity pqA = new PartQuantity();
        pqA.setWorkOrder(woA);
        PartQuantity pqB = new PartQuantity();
        pqB.setWorkOrder(woB);
        when(partQuantityService.findByPart(910L)).thenReturn(Arrays.asList(pqA, pqB));

        when(customerScopeService.canAccessWorkOrderBase(requesterA, woA)).thenReturn(true);
        when(customerScopeService.canAccessWorkOrderBase(requesterA, woB)).thenReturn(false);
        when(workOrderMapper.toShowDto(any(WorkOrder.class))).thenAnswer(invocation -> {
            WorkOrder wo = invocation.getArgument(0);
            WorkOrderShowDTO dto = new WorkOrderShowDTO();
            dto.setId(wo.getId());
            return dto;
        });

        Collection<WorkOrderShowDTO> result = controller.getByPart(910L, req);

        assertEquals(1, result.size());
        assertTrue(result.stream().anyMatch(dto -> dto.getId().equals(10L)));
        assertTrue(result.stream().noneMatch(dto -> dto.getId().equals(20L)),
                "WorkOrder exclusiva do Cliente B nunca pode aparecer pro Requester A");
    }
}
