package com.grash.service;

import com.grash.dto.RolePatchDTO;
import com.grash.mapper.RoleMapperImpl;
import com.grash.model.Role;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Correcao (esta rodada): RolePatchDTO.xPermissions e List (ja nullable),
 * mas RoleMapper nao tinha nenhuma protecao - o codigo gerado fazia
 * "else { entity.setXPermissions(null) }" quando o campo vinha omitido do
 * JSON. Um PATCH {"name":"Supervisor N2"} apagava as 5 listas de permissao
 * inteiras. Fix: nullValuePropertyMappingStrategy=IGNORE por campo no
 * RoleMapper - omitido (null) preserva a lista atual; [] explicito (nao-null,
 * vazio) limpa so aquele grupo; lista com valores substitui so aquele grupo.
 * Nenhuma logica de autorizacao/RoleService foi alterada.
 *
 * Usa o mapper REAL (RoleMapperImpl), nao mockado.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RolePatchSemanticsTest {

    @Mock
    private RoleRepository roleRepository;
    @Mock
    private CompanySettingsService companySettingsService;
    @Mock
    private LicenseService licenseService;

    private RoleService roleService;

    @BeforeEach
    void setUp() {
        roleService = new RoleService(roleRepository, new RoleMapperImpl(), companySettingsService, licenseService);
    }

    private Role roleWith(Set<PermissionEntity> create, Set<PermissionEntity> view, Set<PermissionEntity> viewOther,
                           Set<PermissionEntity> editOther, Set<PermissionEntity> deleteOther) {
        Role role = new Role();
        role.setId(1L);
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setName("Supervisor");
        role.setDescription("Supervisor de campo");
        role.setCreatePermissions(new HashSet<>(create));
        role.setViewPermissions(new HashSet<>(view));
        role.setViewOtherPermissions(new HashSet<>(viewOther));
        role.setEditOtherPermissions(new HashSet<>(editOther));
        role.setDeleteOtherPermissions(new HashSet<>(deleteOther));
        return role;
    }

    private Role update(Role saved, RolePatchDTO patch) {
        when(roleRepository.existsById(saved.getId())).thenReturn(true);
        when(roleRepository.findById(saved.getId())).thenReturn(Optional.of(saved));
        when(roleRepository.save(saved)).thenReturn(saved);
        return roleService.update(saved.getId(), patch);
    }

    private static Set<PermissionEntity> setOf(PermissionEntity... entities) {
        return new HashSet<>(List.of(entities));
    }

    // 1 - PATCH somente de name preserva os 5 grupos de permissoes.
    @Test
    void patchingOnlyName_preservesAllFivePermissionGroups() {
        Role saved = roleWith(
                setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS, PermissionEntity.ASSETS),
                setOf(PermissionEntity.ASSETS),
                setOf(PermissionEntity.CATEGORIES),
                setOf(PermissionEntity.LOCATIONS));
        RolePatchDTO patch = new RolePatchDTO();
        patch.setName("Supervisor N2");

        Role result = update(saved, patch);

        assertEquals("Supervisor N2", result.getName());
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getCreatePermissions());
        assertEquals(setOf(PermissionEntity.WORK_ORDERS, PermissionEntity.ASSETS), result.getViewPermissions());
        assertEquals(setOf(PermissionEntity.ASSETS), result.getViewOtherPermissions());
        assertEquals(setOf(PermissionEntity.CATEGORIES), result.getEditOtherPermissions());
        assertEquals(setOf(PermissionEntity.LOCATIONS), result.getDeleteOtherPermissions());
    }

    // 2 - PATCH somente de description preserva os 5 grupos.
    @Test
    void patchingOnlyDescription_preservesAllFivePermissionGroups() {
        Role saved = roleWith(setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.ASSETS),
                setOf(), setOf(PermissionEntity.CATEGORIES), setOf());
        RolePatchDTO patch = new RolePatchDTO();
        patch.setDescription("Nova descricao");

        Role result = update(saved, patch);

        assertEquals("Nova descricao", result.getDescription());
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getCreatePermissions());
        assertEquals(setOf(PermissionEntity.ASSETS), result.getViewPermissions());
        assertEquals(setOf(PermissionEntity.CATEGORIES), result.getEditOtherPermissions());
    }

    // 3 - propriedade omitida preserva (cada grupo individualmente).
    @Test
    void omittedGroup_isPreserved_whileOthersChange() {
        Role saved = roleWith(setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS));
        RolePatchDTO patch = new RolePatchDTO();
        patch.setName("Supervisor");
        patch.setViewPermissions(List.of(PermissionEntity.ASSETS)); // so este muda

        Role result = update(saved, patch);

        assertEquals(setOf(PermissionEntity.ASSETS), result.getViewPermissions(), "alterado explicitamente");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getCreatePermissions(), "omitido, preservado");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getViewOtherPermissions(), "omitido, preservado");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getEditOtherPermissions(), "omitido, preservado");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getDeleteOtherPermissions(), "omitido, preservado");
    }

    // 4 - [] explicito limpa SOMENTE o grupo enviado.
    @Test
    void explicitEmptyList_clearsOnlyThatGroup() {
        Role saved = roleWith(setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS));
        RolePatchDTO patch = new RolePatchDTO();
        patch.setName("Supervisor");
        patch.setViewPermissions(Collections.emptyList()); // limpa explicitamente

        Role result = update(saved, patch);

        assertTrue(result.getViewPermissions().isEmpty(), "[] explicito deve limpar, nao ser tratado como omitido");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getCreatePermissions(), "outros grupos intocados");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getViewOtherPermissions());
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getEditOtherPermissions());
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getDeleteOtherPermissions());
    }

    // 5 - lista explicita SUBSTITUI somente o grupo enviado.
    @Test
    void explicitNonEmptyList_replacesOnlyThatGroup() {
        Role saved = roleWith(setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS));
        RolePatchDTO patch = new RolePatchDTO();
        patch.setName("Supervisor");
        patch.setEditOtherPermissions(List.of(PermissionEntity.ASSETS, PermissionEntity.LOCATIONS));

        Role result = update(saved, patch);

        assertEquals(setOf(PermissionEntity.ASSETS, PermissionEntity.LOCATIONS), result.getEditOtherPermissions());
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getCreatePermissions(), "outros grupos intocados");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getViewPermissions());
    }

    // 6 - demais grupos permanecem intactos mesmo com payload tocando varios
    // campos simultaneamente (name + 2 grupos).
    @Test
    void multipleFieldsChanged_untouchedGroupsRemainIntact() {
        Role saved = roleWith(setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS), setOf(PermissionEntity.WORK_ORDERS),
                setOf(PermissionEntity.WORK_ORDERS));
        RolePatchDTO patch = new RolePatchDTO();
        patch.setName("Novo nome");
        patch.setCreatePermissions(List.of(PermissionEntity.ASSETS));
        patch.setDeleteOtherPermissions(Collections.emptyList());

        Role result = update(saved, patch);

        assertEquals("Novo nome", result.getName());
        assertEquals(setOf(PermissionEntity.ASSETS), result.getCreatePermissions());
        assertTrue(result.getDeleteOtherPermissions().isEmpty());
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getViewPermissions(), "omitido, preservado");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getViewOtherPermissions(), "omitido, preservado");
        assertEquals(setOf(PermissionEntity.WORK_ORDERS), result.getEditOtherPermissions(), "omitido, preservado");
    }

    // Sem NPE numa role recem-criada (colecoes vazias do construtor, nunca
    // patchada antes).
    @Test
    void newRoleWithEmptyDefaults_patchingOnlyName_doesNotThrow() {
        Role saved = new Role();
        saved.setId(2L);
        saved.setRoleType(RoleType.ROLE_CLIENT);
        saved.setName("Nova role");
        RolePatchDTO patch = new RolePatchDTO();
        patch.setName("Role renomeada");

        assertDoesNotThrow(() -> update(saved, patch));
    }
}
