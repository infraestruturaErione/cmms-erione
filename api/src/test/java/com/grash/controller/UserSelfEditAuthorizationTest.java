package com.grash.controller;

import com.grash.dto.UserPatchDTO;
import com.grash.dto.UserResponseDTO;
import com.grash.mapper.UserMapper;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.service.CompanyService;
import com.grash.service.CustomerScopeService;
import com.grash.service.IntercomService;
import com.grash.service.RoleService;
import com.grash.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Auditoria (2026-09-14), item 3: PATCH /users/{id} liberava self-edit sem
 * NENHUMA restricao de campo - um Requester/Limited Admin mandando
 * {"allowedCustomers": []} pra si mesmo virava irrestrito em
 * CustomerScopeService (empty = unrestricted, semantica global preservada
 * de proposito, ver auditoria). Corrigido em UserController.patch: o campo
 * allowedCustomers so' e' aplicado quando quem faz a chamada tem
 * editOtherPermissions(PEOPLE_AND_TEAMS) - mesmo editando a si mesmo.
 *
 * role/permissions/company/enabled/status NAO estao em UserPatchDTO (so'
 * existem em endpoints proprios - /users/{id}/role e /users/{id}/disable) e
 * ambos ja exigiam editOtherPermissions SEM excecao de self antes desta
 * rodada - confirmado aqui como regressao-guard, nao como fix novo.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserSelfEditAuthorizationTest {

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
    private CustomerScopeService customerScopeService;

    private UserController controller;
    private Company company;

    @BeforeEach
    void setUp() {
        controller = new UserController(userService, roleService, userMapper, intercomService, companyService,
                customerScopeService);
        company = new Company();
        company.setId(1L);
    }

    private User plainRequester(Long id, boolean canEditOthers) {
        User user = new User();
        user.setId(id);
        user.setCompany(company);
        user.setRole(Role.builder()
                .code(RoleCode.REQUESTER)
                .viewPermissions(new HashSet<>())
                .editOtherPermissions(canEditOthers
                        ? new HashSet<>(Collections.singletonList(PermissionEntity.PEOPLE_AND_TEAMS))
                        : new HashSet<>())
                .build());
        return user;
    }

    private User savedUserSameAs(User requester) {
        User saved = new User();
        saved.setId(requester.getId());
        saved.setCompany(company);
        return saved;
    }

    // a) usuario comum NAO consegue alterar o proprio allowedCustomers -
    // o campo chega null em userService.update, mesmo tendo sido enviado
    // preenchido no request.
    @Test
    void selfEdit_withoutEditOtherPermission_allowedCustomersStripped() {
        User requester = plainRequester(10L, false);
        User saved = savedUserSameAs(requester);
        when(userService.findByIdAndCompany(10L, 1L)).thenReturn(Optional.of(saved));
        when(userService.update(eq(10L), any())).thenReturn(saved);
        when(userMapper.toResponseDto(saved)).thenReturn(new UserResponseDTO());

        UserPatchDTO patchDto = new UserPatchDTO();
        patchDto.setFirstName("Novo Nome");
        patchDto.setAllowedCustomers(new ArrayList<>()); // tentativa de auto-escalonamento

        controller.patch(patchDto, 10L, requester);

        ArgumentCaptor<UserPatchDTO> captor = ArgumentCaptor.forClass(UserPatchDTO.class);
        verify(userService).update(eq(10L), captor.capture());
        assertNull(captor.getValue().getAllowedCustomers());
        // d) o resto do self-edit continua funcionando normalmente.
        assertEquals("Novo Nome", captor.getValue().getFirstName());
    }

    // b) confirma (regression-guard, nao fix novo) que role/status nao tem
    // via de auto-escalonamento: os dois endpoints dedicados exigem
    // editOtherPermissions SEM excecao de self.
    @Test
    void patchRole_selfWithoutEditOtherPermission_forbidden() {
        User requester = plainRequester(10L, false);
        User saved = savedUserSameAs(requester);
        when(userService.findByIdAndCompany(10L, 1L)).thenReturn(Optional.of(saved));
        when(roleService.findById(any())).thenReturn(Optional.of(
                Role.builder().id(2L).build()));

        assertThrows(com.grash.exception.CustomException.class,
                () -> controller.patchRole(10L, 2L, requester));
        verify(userService, never()).save(any());
    }

    @Test
    void disable_selfWithoutEditOtherPermission_forbidden() {
        User requester = plainRequester(10L, false);
        User saved = savedUserSameAs(requester);
        when(userService.findByIdAndCompany(10L, 1L)).thenReturn(Optional.of(saved));

        assertThrows(com.grash.exception.CustomException.class,
                () -> controller.disable(10L, requester));
        verify(userService, never()).save(any());
    }

    // c) admin com editOtherPermissions continua conseguindo alterar
    // allowedCustomers (inclusive o proprio, se for o caso) - a correcao
    // nao pode quebrar o caminho administrativo legitimo.
    @Test
    void edit_withEditOtherPermission_allowedCustomersPreserved() {
        User admin = plainRequester(99L, true);
        User otherUser = new User();
        otherUser.setId(20L);
        otherUser.setCompany(company);
        when(userService.findByIdAndCompany(20L, 1L)).thenReturn(Optional.of(otherUser));
        when(userService.update(eq(20L), any())).thenReturn(otherUser);
        when(userMapper.toResponseDto(otherUser)).thenReturn(new UserResponseDTO());

        UserPatchDTO patchDto = new UserPatchDTO();
        patchDto.setAllowedCustomers(new ArrayList<>());

        controller.patch(patchDto, 20L, admin);

        ArgumentCaptor<UserPatchDTO> captor = ArgumentCaptor.forClass(UserPatchDTO.class);
        verify(userService).update(eq(20L), captor.capture());
        assertNotNull(captor.getValue().getAllowedCustomers());
    }

    // d) edicao legitima do proprio perfil (campos benignos) continua
    // funcionando de ponta a ponta, sem exigir editOtherPermissions.
    @Test
    void selfEdit_benignFields_stillSucceeds() {
        User requester = plainRequester(10L, false);
        User saved = savedUserSameAs(requester);
        when(userService.findByIdAndCompany(10L, 1L)).thenReturn(Optional.of(saved));
        when(userService.update(eq(10L), any())).thenReturn(saved);
        UserResponseDTO responseDto = new UserResponseDTO();
        responseDto.setFirstName("Novo Nome");
        when(userMapper.toResponseDto(saved)).thenReturn(responseDto);

        UserPatchDTO patchDto = new UserPatchDTO();
        patchDto.setFirstName("Novo Nome");
        patchDto.setPhone("11999999999");

        UserResponseDTO result = controller.patch(patchDto, 10L, requester);

        assertEquals("Novo Nome", result.getFirstName());
    }
}
