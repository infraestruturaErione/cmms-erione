package com.grash.controller;

import com.grash.dto.TeamPatchDTO;
import com.grash.dto.TeamShowDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.TeamMapper;
import com.grash.model.Company;
import com.grash.model.Role;
import com.grash.model.Team;
import com.grash.model.User;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.service.TeamService;
import com.grash.service.UserService;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Auditoria (2026-09-14) do TeamController reformulado: cobre exatamente os
 * cenarios pedidos na revisao de seguranca - isolamento de empresa em
 * PATCH/DELETE/GET, PATCH sem permissao, e resolveMembers rejeitando membro
 * de outra empresa/desabilitado/inexistente em create e patch. Estilo
 * identico a UserAuthorizationTest (controller instanciado direto com mocks,
 * sem contexto Spring/banco). TeamController usa userService.whoami(req)
 * internamente (nao @CurrentUser) - por isso todo teste estuba
 * userService.whoami(any()) em vez de injetar o User como parametro.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TeamControllerAuthorizationTest {

    @Mock
    private TeamService teamService;
    @Mock
    private TeamMapper teamMapper;
    @Mock
    private UserService userService;
    @Mock
    private EntityManager em;

    private TeamController controller;
    private Company company;
    private HttpServletRequest req;

    @BeforeEach
    void setUp() {
        controller = new TeamController(teamService, teamMapper, userService, em);
        company = new Company();
        company.setId(1L);
        req = mock(HttpServletRequest.class);
    }

    private User requesterUser(Long id, Company companyRef, boolean canEditOthers, boolean canDeleteOthers) {
        User user = new User();
        user.setId(id);
        user.setCompany(companyRef);
        Role role = Role.builder()
                .roleType(RoleType.ROLE_CLIENT)
                .createPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.PEOPLE_AND_TEAMS)))
                .viewPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.PEOPLE_AND_TEAMS)))
                .editOtherPermissions(canEditOthers
                        ? new HashSet<>(Collections.singletonList(PermissionEntity.PEOPLE_AND_TEAMS))
                        : new HashSet<>())
                .deleteOtherPermissions(canDeleteOthers
                        ? new HashSet<>(Collections.singletonList(PermissionEntity.PEOPLE_AND_TEAMS))
                        : new HashSet<>())
                .build();
        user.setRole(role);
        return user;
    }

    private Team teamOf(Long id, Company companyRef, Long createdBy) {
        Team team = new Team();
        team.setId(id);
        team.setCompany(companyRef);
        team.setCreatedBy(createdBy);
        team.setName("Equipe " + id);
        team.setUsers(new ArrayList<>());
        return team;
    }

    private User activeMember(Long id, Company companyRef) {
        User member = new User();
        member.setId(id);
        member.setCompany(companyRef);
        member.setEnabled(true);
        return member;
    }

    // ===== PATCH: isolamento de empresa =====

    // PATCH /teams/{id}: equipe existe mas pertence a OUTRA empresa -
    // findByIdAndCompany (escopado) deve devolver vazio, controller deve
    // responder "not found" SEM revelar/editar o time cross-tenant.
    @Test
    void patch_teamBelongsToAnotherCompany_notFound() {
        User requester = requesterUser(10L, company, true, true);
        when(userService.whoami(req)).thenReturn(requester);
        when(teamService.findByIdAndCompany(99L, 1L)).thenReturn(Optional.empty());

        TeamPatchDTO patchDto = new TeamPatchDTO();
        CustomException ex = assertThrows(CustomException.class,
                () -> controller.patch(patchDto, 99L, req));

        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
        verify(teamService, never()).update(any(), any());
    }

    // PATCH /teams/{id}: mesma empresa, mas usuario NAO e' o criador e NAO
    // tem editOtherPermissions - deve barrar com Forbidden, mesmo a equipe
    // existindo e sendo da empresa certa.
    @Test
    void patch_sameCompany_noEditPermission_forbidden() {
        User requester = requesterUser(10L, company, false, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team existing = teamOf(5L, company, 999L); // criado por outro usuario
        when(teamService.findByIdAndCompany(5L, 1L)).thenReturn(Optional.of(existing));

        TeamPatchDTO patchDto = new TeamPatchDTO();
        CustomException ex = assertThrows(CustomException.class,
                () -> controller.patch(patchDto, 5L, req));

        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        verify(teamService, never()).update(any(), any());
    }

    // PATCH /teams/{id}: usuario COM editOtherPermissions, mesma empresa -
    // deve seguir em frente normalmente (regressao - a correcao de
    // seguranca nao pode quebrar o caminho legitimo).
    @Test
    void patch_sameCompany_withEditPermission_succeeds() {
        User requester = requesterUser(10L, company, true, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team existing = teamOf(5L, company, 999L);
        when(teamService.findByIdAndCompany(5L, 1L)).thenReturn(Optional.of(existing));
        when(teamService.update(eq(5L), any())).thenReturn(existing);
        when(teamMapper.toShowDto(existing)).thenReturn(new TeamShowDTO());

        TeamPatchDTO patchDto = new TeamPatchDTO();
        assertDoesNotThrow(() -> controller.patch(patchDto, 5L, req));
        verify(teamService).update(eq(5L), any());
    }

    // ===== DELETE: isolamento de empresa =====

    @Test
    void delete_teamBelongsToAnotherCompany_notFound() {
        User requester = requesterUser(10L, company, true, true);
        when(userService.whoami(req)).thenReturn(requester);
        when(teamService.findByIdAndCompany(99L, 1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.delete(99L, req));

        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
        verify(teamService, never()).delete(any());
    }

    @Test
    void delete_sameCompany_noPermission_forbidden() {
        User requester = requesterUser(10L, company, false, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team existing = teamOf(5L, company, 999L);
        when(teamService.findByIdAndCompany(5L, 1L)).thenReturn(Optional.of(existing));

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.delete(5L, req));

        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        verify(teamService, never()).delete(any());
    }

    // ===== GET by id: isolamento de empresa (ROLE_CLIENT) =====

    @Test
    void getById_teamBelongsToAnotherCompany_notFound() {
        User requester = requesterUser(10L, company, false, false);
        when(userService.whoami(req)).thenReturn(requester);
        when(teamService.findByIdAndCompany(99L, 1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.getById(99L, req));

        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
    }

    // ===== resolveMembers (via create/patch): membro invalido/desabilitado/outra empresa =====

    // create: um dos IDs de membro nao existe NA EMPRESA do requester
    // (findByIdAndCompany devolve vazio - simula tanto "nao existe" quanto
    // "existe mas e' de outra empresa", mesmo caminho de codigo).
    @Test
    void create_memberFromForeignCompany_rejected() {
        User requester = requesterUser(10L, company, false, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team teamReq = new Team();
        User foreignMemberRef = new User();
        foreignMemberRef.setId(77L);
        teamReq.setUsers(new ArrayList<>(Collections.singletonList(foreignMemberRef)));
        when(userService.findByIdAndCompany(77L, 1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.create(teamReq, req));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, ex.getHttpStatus());
        verify(teamService, never()).create(any());
    }

    // create: membro existe na empresa certa mas esta DESABILITADO.
    @Test
    void create_disabledMember_rejected() {
        User requester = requesterUser(10L, company, false, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team teamReq = new Team();
        User memberRef = new User();
        memberRef.setId(21L);
        teamReq.setUsers(new ArrayList<>(Collections.singletonList(memberRef)));
        User disabledMember = new User();
        disabledMember.setId(21L);
        disabledMember.setCompany(company);
        disabledMember.setEnabled(false);
        when(userService.findByIdAndCompany(21L, 1L)).thenReturn(Optional.of(disabledMember));

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.create(teamReq, req));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, ex.getHttpStatus());
        verify(teamService, never()).create(any());
    }

    // create: membro valido (mesma empresa, ativo) - deve passar e a equipe
    // criada deve conter o usuario RESOLVIDO pelo backend, nao a referencia
    // crua enviada pelo cliente.
    @Test
    void create_validActiveMember_succeeds() {
        User requester = requesterUser(10L, company, false, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team teamReq = new Team();
        User memberRef = new User();
        memberRef.setId(21L);
        teamReq.setUsers(new ArrayList<>(Collections.singletonList(memberRef)));
        User activeMember = activeMember(21L, company);
        when(userService.findByIdAndCompany(21L, 1L)).thenReturn(Optional.of(activeMember));
        when(teamService.create(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(teamMapper.toShowDto(any())).thenReturn(new TeamShowDTO());

        controller.create(teamReq, req);

        assertEquals(1, teamReq.getUsers().size());
        assertSame(activeMember, teamReq.getUsers().get(0));
        verify(teamService).create(teamReq);
    }

    // patch: mesmo teste de membro de outra empresa, agora no caminho de
    // update (nao so' create) - a correcao precisa valer nos dois.
    @Test
    void patch_memberFromForeignCompany_rejected() {
        User requester = requesterUser(10L, company, true, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team existing = teamOf(5L, company, 999L);
        when(teamService.findByIdAndCompany(5L, 1L)).thenReturn(Optional.of(existing));
        TeamPatchDTO patchDto = new TeamPatchDTO();
        User foreignMemberRef = new User();
        foreignMemberRef.setId(88L);
        patchDto.setUsers(new ArrayList<>(Collections.singletonList(foreignMemberRef)));
        when(userService.findByIdAndCompany(88L, 1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.patch(patchDto, 5L, req));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, ex.getHttpStatus());
        verify(teamService, never()).update(any(), any());
    }

    // create: referencia de membro sem id - deve ser rejeitada antes de
    // qualquer lookup.
    @Test
    void create_memberReferenceWithNullId_rejected() {
        User requester = requesterUser(10L, company, false, false);
        when(userService.whoami(req)).thenReturn(requester);
        Team teamReq = new Team();
        User invalidRef = new User(); // sem id
        teamReq.setUsers(new ArrayList<>(Collections.singletonList(invalidRef)));

        CustomException ex = assertThrows(CustomException.class,
                () -> controller.create(teamReq, req));

        assertEquals(HttpStatus.NOT_ACCEPTABLE, ex.getHttpStatus());
        verify(userService, never()).findByIdAndCompany(any(), any());
    }
}
