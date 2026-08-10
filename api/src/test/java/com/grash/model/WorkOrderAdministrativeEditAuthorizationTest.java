package com.grash.model;

import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Gap P1 - separa "pode executar a OS" (canBeEditedBy, usado pelos endpoints
 * operacionais do tecnico) de "pode editar administrativamente a OS"
 * (canBeAdministrativelyEditedBy, usado so em PATCH /work-orders/{id}).
 * Cenarios A-F do plano.
 */
class WorkOrderAdministrativeEditAuthorizationTest {

    private User userWithRole(Long id, Set<PermissionEntity> editOtherPermissions) {
        User user = new User();
        user.setId(id);
        Role role = Role.builder()
                .editOtherPermissions(editOtherPermissions)
                .build();
        user.setRole(role);
        return user;
    }

    private WorkOrder workOrder(Long createdBy, User... assignedTo) {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setCreatedBy(createdBy);
        workOrder.setAssignedTo(assignedTo.length == 0 ? Collections.emptyList() : Arrays.asList(assignedTo));
        return workOrder;
    }

    // A) Administrator autorizado (editOtherPermissions contem WORK_ORDERS,
    // igual ao role default "Administrator" de Helper.getDefaultRoles) -> PATCH
    // administrativo permitido, mesmo sem ter criado nem estar atribuido.
    @Test
    void administrator_canAdministrativelyEdit_evenWithoutCreatedByOrAssignment() {
        User admin = userWithRole(1L, new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        WorkOrder workOrder = workOrder(999L); // criado por outra pessoa, sem assignedTo

        assertTrue(workOrder.canBeAdministrativelyEditedBy(admin));
    }

    // B) Limited Administrator com permissao WORK_ORDERS (mesmo formato de
    // editOtherPermissions que o Administrator tem por padrao) -> permitido.
    @Test
    void limitedAdministrator_withWorkOrdersPermission_canAdministrativelyEdit() {
        User limitedAdmin = userWithRole(2L, new HashSet<>(Arrays.asList(PermissionEntity.WORK_ORDERS,
                PermissionEntity.ASSETS)));
        WorkOrder workOrder = workOrder(999L);

        assertTrue(workOrder.canBeAdministrativelyEditedBy(limitedAdmin));
    }

    // Checklist structure fix - perfil administrativo CUSTOMIZADO
    // (RoleCode.USER_CREATED, nao Administrator/Limited Administrator) com
    // WORK_ORDERS explicito em editOtherPermissions -> tambem permitido. A
    // checagem e puramente pela permissao real (Set<PermissionEntity>), nunca
    // pelo RoleCode/nome do perfil - vale tanto para PATCH /work-orders/{id}
    // quanto para o bulk sync do checklist em PATCH /tasks/work-order/{id}.
    @Test
    void customRoleWithWorkOrdersPermission_canAdministrativelyEdit() {
        User user = new User();
        user.setId(10L);
        Role customRole = Role.builder()
                .code(RoleCode.USER_CREATED)
                .name("Coordenador de Campo")
                .editOtherPermissions(new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)))
                .build();
        user.setRole(customRole);
        WorkOrder workOrder = workOrder(999L); // nao criou, nao esta atribuido

        assertTrue(workOrder.canBeAdministrativelyEditedBy(user),
                "perfil customizado com WORK_ORDERS explicito deve poder editar administrativamente, " +
                        "independente do RoleCode/nome");
    }

    // C) Technician atribuido (editOtherPermissions vazio, igual ao role
    // default "Technician") -> PATCH administrativo negado, MESMO estando
    // atribuido. canBeEditedBy (usado pelos endpoints operacionais) continua
    // true para o mesmo usuario - prova que a execucao nao quebrou.
    @Test
    void assignedTechnician_cannotAdministrativelyEdit_butCanStillExecute() {
        User technician = userWithRole(3L, new HashSet<>());
        WorkOrder workOrder = workOrder(999L, technician);

        assertFalse(workOrder.canBeAdministrativelyEditedBy(technician),
                "tecnico atribuido nao deve poder editar administrativamente");
        assertTrue(workOrder.canBeEditedBy(technician),
                "tecnico atribuido deve continuar podendo executar a OS (endpoints operacionais)");
    }

    // D) Technician que criou a OS (editOtherPermissions vazio) -> PATCH
    // administrativo negado, mesmo sendo o criador. canBeEditedBy continua
    // true.
    @Test
    void creatorTechnician_cannotAdministrativelyEdit_butCanStillExecute() {
        User technician = userWithRole(4L, new HashSet<>());
        WorkOrder workOrder = workOrder(4L); // createdBy == technician.id

        assertFalse(workOrder.canBeAdministrativelyEditedBy(technician),
                "tecnico que criou a OS nao deve poder editar administrativamente so por isso");
        assertTrue(workOrder.canBeEditedBy(technician),
                "tecnico que criou a OS deve continuar podendo executa-la");
    }

    // E) Technician nem atribuido nem criador -> negado nos dois metodos.
    @Test
    void unrelatedTechnician_cannotEditOrExecute() {
        User technician = userWithRole(5L, new HashSet<>());
        WorkOrder workOrder = workOrder(999L); // outro criador, sem assignedTo

        assertFalse(workOrder.canBeAdministrativelyEditedBy(technician));
        assertFalse(workOrder.canBeEditedBy(technician));
    }

    // F) canBeEditedBy (usado pelos endpoints operacionais: depart, check-in,
    // check-out, Tasks, arquivos, labor, part quantities, change-status) nao
    // foi alterado por esta correcao - continua identico ao comportamento
    // anterior para admin, criador e atribuido.
    @Test
    void canBeEditedBy_behaviorUnchanged_forAdminCreatorAndAssignee() {
        User admin = userWithRole(6L, new HashSet<>(Collections.singletonList(PermissionEntity.WORK_ORDERS)));
        User creator = userWithRole(7L, new HashSet<>());
        User assignee = userWithRole(8L, new HashSet<>());

        WorkOrder createdByCreator = workOrder(7L);
        WorkOrder assignedToAssignee = workOrder(999L, assignee);
        WorkOrder unrelated = workOrder(999L);

        assertTrue(unrelated.canBeEditedBy(admin), "admin sempre pode executar, via permissao");
        assertTrue(createdByCreator.canBeEditedBy(creator), "criador continua podendo executar");
        assertTrue(assignedToAssignee.canBeEditedBy(assignee), "atribuido continua podendo executar");
    }
}
