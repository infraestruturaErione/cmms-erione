package com.grash.controller;

import com.grash.dto.UserMiniDTO;
import com.grash.dto.UserResponseDTO;
import com.grash.mapper.UserMapper;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import com.grash.service.CompanyService;
import com.grash.service.CustomerScopeService;
import com.grash.service.IntercomService;
import com.grash.service.RoleService;
import com.grash.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Item 7 do pedido de correcao: /users/mini e /users/{id} nao devolviam
 * DTO minimo pra Requester (telefone/email/role/allowedCustomers de
 * qualquer colega). Aqui garante que Requester recebe versao saneada e
 * Admin/self continuam recebendo o DTO completo.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserAuthorizationTest {

    @Mock
    private UserService userService;
    @Mock
    private RoleService roleService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private IntercomService intercomService;
    @Mock
    private CompanyService companyService;
    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private LocationRepository locationRepository;
    @Mock
    private AssetRepository assetRepository;

    private CustomerScopeService customerScopeService;
    private UserController controller;
    private Company company;

    @BeforeEach
    void setUp() {
        customerScopeService = new CustomerScopeService(customerRepository, locationRepository, assetRepository);
        controller = new UserController(userService, roleService, userMapper, intercomService, companyService,
                customerScopeService);
        company = new Company();
        company.setId(1L);
    }

    private User requester(Long id) {
        User user = new User();
        user.setId(id);
        user.setCompany(company);
        // Role.builder() nao aplica os inicializadores de campo (sem
        // @Builder.Default) - sets nao setados ficam null, nao vazios.
        user.setRole(Role.builder().code(RoleCode.REQUESTER)
                .viewPermissions(new HashSet<>())
                .viewOtherPermissions(new HashSet<>())
                .build());
        return user;
    }

    private User adminWithPeopleAndTeams(Long id) {
        User user = new User();
        user.setId(id);
        user.setCompany(company);
        user.setRole(Role.builder().code(RoleCode.ADMIN)
                .viewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.PEOPLE_AND_TEAMS)))
                .build());
        return user;
    }

    private UserMiniDTO miniWithPhone(Long id, String phone) {
        UserMiniDTO dto = new UserMiniDTO();
        dto.setId(id);
        dto.setFirstName("Tecnico");
        dto.setPhone(phone);
        return dto;
    }

    // /users/mini: Requester nao recebe telefone de ninguem.
    @Test
    void mini_requester_neverSeesPhone() {
        User viewer = requester(10L);
        User worker = new User();
        worker.setId(20L);
        worker.setEnabled(true);
        when(userService.findWorkersByCompany(1L)).thenReturn(Collections.singletonList(worker));
        when(userMapper.toMiniDto(worker)).thenReturn(miniWithPhone(20L, "11999999999"));

        Collection<UserMiniDTO> result = controller.getMini(viewer, null);

        assertEquals(1, result.size());
        assertNull(result.iterator().next().getPhone());
    }

    // /users/mini: Requester pedindo withRequesters=true NAO deve listar
    // outros Requesters (enumeraria contatos de outros clientes) - cai no
    // ramo de workers mesmo assim.
    @Test
    void mini_requester_withRequestersFlag_isIgnored() {
        User viewer = requester(10L);
        when(userService.findWorkersByCompany(1L)).thenReturn(Collections.emptyList());

        controller.getMini(viewer, true);

        org.mockito.Mockito.verify(userService, org.mockito.Mockito.never()).findByCompany(any());
        org.mockito.Mockito.verify(userService).findWorkersByCompany(1L);
    }

    // /users/mini: Admin com withRequesters=true continua funcionando
    // normalmente (nao filtrado por customer scope) e com telefone intacto.
    @Test
    void mini_admin_withRequestersFlag_stillWorks_phoneIntact() {
        User admin = adminWithPeopleAndTeams(99L);
        User anyUser = new User();
        anyUser.setId(21L);
        anyUser.setEnabled(true);
        when(userService.findByCompany(1L)).thenReturn(Collections.singletonList(anyUser));
        when(userMapper.toMiniDto(anyUser)).thenReturn(miniWithPhone(21L, "11988888888"));

        Collection<UserMiniDTO> result = controller.getMini(admin, true);

        assertEquals(1, result.size());
        assertEquals("11988888888", result.iterator().next().getPhone());
    }

    // /users/{id}: Requester pedindo o perfil de OUTRO usuario recebe DTO
    // saneado - sem email/role/allowedCustomers/telefone.
    @Test
    void getById_requester_viewingSomeoneElse_getsSanitizedDto() {
        User viewer = requester(10L);
        User other = new User();
        other.setId(20L);
        other.setCompany(company);
        when(userService.findByIdAndCompany(20L, 1L)).thenReturn(java.util.Optional.of(other));

        UserResponseDTO full = new UserResponseDTO();
        full.setId(20);
        full.setEmail("tecnico@empresa.com");
        full.setRole(Role.builder().code(RoleCode.TECHNICIAN).build());
        full.setPhone("11977777777");
        full.setAllowedCustomers(new java.util.ArrayList<>());
        when(userMapper.toResponseDto(other)).thenReturn(full);

        UserResponseDTO result = controller.getById(20L, viewer);

        assertNull(result.getEmail());
        assertNull(result.getRole());
        assertNull(result.getPhone());
    }

    // /users/{id}: ver o proprio perfil sempre traz o DTO completo, mesmo
    // sendo Requester.
    @Test
    void getById_requester_viewingSelf_getsFullDto() {
        User viewer = requester(10L);
        when(userService.findByIdAndCompany(10L, 1L)).thenReturn(java.util.Optional.of(viewer));

        UserResponseDTO full = new UserResponseDTO();
        full.setId(10);
        full.setEmail("requester@empresa.com");
        when(userMapper.toResponseDto(viewer)).thenReturn(full);

        UserResponseDTO result = controller.getById(10L, viewer);

        assertEquals("requester@empresa.com", result.getEmail());
    }

    // /users/{id}: Admin com PEOPLE_AND_TEAMS ve o DTO completo de qualquer
    // colega (regressao - nao pode ser prejudicado pela correcao).
    @Test
    void getById_adminWithPeopleAndTeams_viewingSomeoneElse_getsFullDto() {
        User admin = adminWithPeopleAndTeams(99L);
        User other = new User();
        other.setId(20L);
        other.setCompany(company);
        when(userService.findByIdAndCompany(20L, 1L)).thenReturn(java.util.Optional.of(other));

        UserResponseDTO full = new UserResponseDTO();
        full.setId(20);
        full.setEmail("tecnico@empresa.com");
        when(userMapper.toResponseDto(other)).thenReturn(full);

        UserResponseDTO result = controller.getById(20L, admin);

        assertEquals("tecnico@empresa.com", result.getEmail());
    }
}
