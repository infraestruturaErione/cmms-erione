package com.grash.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.grash.dto.IdDTO;
import com.grash.model.abstracts.WorkOrderBase;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.Status;
import com.grash.utils.Helper;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import org.hibernate.envers.AuditOverride;
import org.hibernate.envers.Audited;
import org.hibernate.envers.NotAudited;
import org.hibernate.envers.RelationTargetAuditMode;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static java.util.Comparator.comparingLong;
import static java.util.stream.Collectors.collectingAndThen;
import static java.util.stream.Collectors.toCollection;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Audited(withModifiedFlag = true)
@AuditOverride(forClass = WorkOrderBase.class)
@Schema(description = "Work order entity representing a maintenance or repair task")
public class WorkOrder extends WorkOrderBase {

    @Schema(description = "Unique identifier of the work order", accessMode = Schema.AccessMode.READ_ONLY)
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Schema(description = "Custom identifier for the work order", accessMode = Schema.AccessMode.READ_ONLY)
    @Audited(withModifiedFlag = true)
    private String customId;

    @Schema(description = "The user who completed the work order", implementation = IdDTO.class)
    @ManyToOne(fetch = FetchType.LAZY)
    @Audited(targetAuditMode = RelationTargetAuditMode.NOT_AUDITED, withModifiedFlag = true)
    private User completedBy;

    @Schema(description = "The date and time when the work order was completed")
    private Date completedOn;

    @Schema(description = "The current status of the work order")
    private Status status = Status.OPEN;

    @Schema(description = "Signature captured upon work order completion")
    @Audited(targetAuditMode = RelationTargetAuditMode.NOT_AUDITED, withModifiedFlag = true)
    private String signature;

    @Schema(description = "Name of the person who signed upon work order completion")
    @NotAudited
    private String signerName;

    @Schema(description = "CPF/CNPJ of the person who signed upon work order completion")
    @NotAudited
    private String signerDocument;

    @Schema(description = "Mileage traveled to complete the work order, in kilometers")
    @NotAudited
    private Double mileageTraveled;

    // Sprint 3A - snapshot congelado dos requisitos de conclusao da Category
    // no momento em que esta WorkOrder foi criada (ver
    // WorkOrderService.applyCategoryCompletionRequirementsSnapshot). Editar a
    // Category depois, ou trocar a Category desta OS, NAO reaplica estes
    // valores - eles ficam congelados aqui. requiredSignature (em
    // WorkOrderBase, compartilhado com PreventiveMaintenance) ja cumpria este
    // papel para assinatura; estes 6 cobrem os requisitos que a
    // WorkOrderCategory ja guardava mas nunca chegavam na OS. Somente
    // armazenamento nesta sprint - nenhum bloqueio de conclusao usa estes
    // campos ainda.
    @Schema(description = "Whether the signer's name is required on completion (snapshot from the category at " +
            "creation time)")
    @NotAudited
    private boolean requireSignerName;

    @Schema(description = "Whether the signer's CPF/CNPJ is required on completion (snapshot from the category " +
            "at creation time)")
    @NotAudited
    private boolean requireSignerDocument;

    @Schema(description = "Whether at least one photo is required on completion (snapshot from the category at " +
            "creation time)")
    @NotAudited
    private boolean requirePhotos;

    @Schema(description = "Whether the field report/feedback is required on completion (snapshot from the " +
            "category at creation time)")
    @NotAudited
    private boolean requireFieldReport;

    @Schema(description = "Whether mileage traveled is required on completion (snapshot from the category at " +
            "creation time)")
    @NotAudited
    private boolean requireMileage;

    @Schema(description = "Whether the checklist must be fully filled on completion (snapshot from the category " +
            "at creation time)")
    @NotAudited
    private boolean requireChecklistCompletion;

    @Schema(description = "Indicates whether the work order is archived")
    private boolean archived;

    @Schema(description = "Indicates whether this is a demo work order")
    private boolean isDemo;

    @Schema(description = "The parent request from which this work order was created", implementation = IdDTO.class)
    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnore
    @Audited(targetAuditMode = RelationTargetAuditMode.NOT_AUDITED, withModifiedFlag = true)
    private Request parentRequest;

    @Schema(description = "Feedback provided upon work order completion")
    private String feedback;


    @Schema(description = "The preventive maintenance schedule that generated this work order", implementation =
            IdDTO.class)
    @ManyToOne(fetch = FetchType.LAZY)
    @Audited(targetAuditMode = RelationTargetAuditMode.NOT_AUDITED, withModifiedFlag = true)
    private PreventiveMaintenance parentPreventiveMaintenance;

    @Schema(description = "The first time the work order was reacted to", accessMode = Schema.AccessMode.READ_ONLY)
    @NotAudited
    private Date firstTimeToReact;

    @Schema(description = "Timestamp when the technician started travel to the site")
    @NotAudited
    private Date departureAt;

    @Schema(description = "Latitude when the technician started travel")
    @NotAudited
    private BigDecimal departureLat;

    @Schema(description = "Longitude when the technician started travel")
    @NotAudited
    private BigDecimal departureLng;

    @Schema(description = "Timestamp when the technician checked in at the site")
    @NotAudited
    private Date checkInAt;

    @Schema(description = "Latitude when the technician checked in")
    @NotAudited
    private BigDecimal checkInLat;

    @Schema(description = "Longitude when the technician checked in")
    @NotAudited
    private BigDecimal checkInLng;

    @Schema(description = "Address where the technician checked in")
    @NotAudited
    private String checkInAddress;

    @Schema(description = "Timestamp when the technician checked out from the site")
    @NotAudited
    private Date checkOutAt;

    @Schema(description = "Latitude when the technician checked out")
    @NotAudited
    private BigDecimal checkOutLat;

    @Schema(description = "Longitude when the technician checked out")
    @NotAudited
    private BigDecimal checkOutLng;

    @Schema(description = "Address where the technician checked out")
    @NotAudited
    private String checkOutAddress;

    @NotAudited
    @OneToMany(mappedBy = "workOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 25)
    private List<CustomFieldValue> customFieldValues = new ArrayList<>();

    @JsonIgnore
    public boolean isCompliant() {
        return this.getDueDate() == null || this.getCompletedOn().before(this.getDueDate());
    }

    @JsonIgnore
    public boolean isReactive() {
        return this.getParentPreventiveMaintenance() == null;
    }

    @JsonIgnore
    public Date getRealCreatedAt() {
        return this.getParentRequest() == null ? this.getCreatedAt() : this.getParentRequest().getCreatedAt();
    }

    @JsonIgnore
    public List<User> getNewUsersToNotify(Collection<User> newUsers) {
        Collection<User> oldUsers = getUsers();
        return newUsers.stream().filter(newUser -> oldUsers.stream().noneMatch(user -> user.getId().equals(newUser.getId()))).
                collect(collectingAndThen(toCollection(() -> new TreeSet<>(comparingLong(User::getId))),
                        ArrayList::new));
    }

    // "Pode executar a OS": usado pelos endpoints operacionais (deslocamento,
    // check-in/out, Tasks/questionario, relato, evidencias, assinatura
    // operacional, mudanca de status/conclusao). De proposito mais permissivo
    // que edicao administrativa - quem criou ou foi atribuido precisa
    // continuar executando a OS. NAO usar para decidir se alguem pode editar
    // campos administrativos (categoria, prioridade, responsaveis, etc) - ver
    // canBeAdministrativelyEditedBy.
    public boolean canBeEditedBy(User user) {
        return user.getRole().getEditOtherPermissions().contains(PermissionEntity.WORK_ORDERS)
                || (this.getCreatedBy() != null && this.getCreatedBy().equals(user.getId())) || isAssignedTo(user);
    }

    // "Pode editar administrativamente a OS": so permissao real de
    // editOtherPermissions (WORK_ORDERS) - Administrator e Limited
    // Administrator tem por padrao (Helper.getDefaultRoles()), Technician e
    // Limited Technician nao. Criar a OS ou estar atribuido a ela NAO da essa
    // autorizacao (diferente de canBeEditedBy) - o tecnico executa a OS, nao
    // edita seus dados administrativos (categoria, prioridade, responsaveis,
    // requiredSignature, etc). Usado hoje so em PATCH /work-orders/{id}.
    public boolean canBeAdministrativelyEditedBy(User user) {
        return user.getRole().getEditOtherPermissions().contains(PermissionEntity.WORK_ORDERS);
    }

    //in days
    @JsonIgnore
    public static long getAverageAge(Collection<WorkOrder> completeWorkOrders) {
        List<Long> completionTimes = completeWorkOrders.stream()
                .filter(workOrder -> workOrder.getCompletedOn() != null).map(workOrder ->
                        Helper.getDateDiff(workOrder.getParentRequest() == null ? workOrder.getCreatedAt() :
                                workOrder.getParentRequest().getCreatedAt(), workOrder.getCompletedOn(), TimeUnit.DAYS))
                .collect(Collectors.toList());
        return completionTimes.isEmpty() ? 0 :
                completionTimes.stream().mapToLong(value -> value).sum() / completionTimes.size();
    }

    public boolean isAccessibleBy(User user) {
        return (user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS) &&
                (user.getRole().getViewOtherPermissions().contains(PermissionEntity.WORK_ORDERS) || (getCreatedBy() != null && getCreatedBy().equals(user.getId())) || isAssignedTo(user)))
                || getParentRequest() != null && getParentRequest().getCreatedBy().equals(user.getId())
                ;
    }
}

