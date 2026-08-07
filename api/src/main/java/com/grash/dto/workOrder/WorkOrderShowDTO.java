package com.grash.dto.workOrder;

import com.grash.dto.*;
import com.grash.dto.cutomField.CustomFieldValueShowDTO;
import com.grash.model.enums.Status;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@Schema(description = "Work order DTO for displaying work order details in API responses")
public class WorkOrderShowDTO extends WorkOrderBaseShowDTO {

    @Schema(description = "User who completed the work order")
    private UserMiniDTO completedBy;

    @Schema(description = "Date and time when the work order was completed")
    private Date completedOn;

    @Schema(description = "Whether the work order is archived")
    private boolean archived;

    @Schema(description = "Parent maintenance request that triggered this work order")
    private RequestMiniDTO parentRequest;

    @Schema(description = "Parent preventive maintenance that generated this work order")
    private PreventiveMaintenanceMiniDTO parentPreventiveMaintenance;

    @Schema(description = "Base64 encoded signature for the completed work order")
    private String signature;

    @Schema(description = "Current status of the work order")
    private Status status;

    @Schema(description = "Feedback or notes provided upon work order completion")
    private String feedback;

    @Schema(description = "Audio description file attached to the work order")
    private FileShowDTO audioDescription;

    @Schema(description = "Custom identifier for the work order")
    private String customId;

    @Schema(description = "Timestamp when the technician started travel to the site")
    private Date departureAt;

    @Schema(description = "Latitude when the technician started travel")
    private BigDecimal departureLat;

    @Schema(description = "Longitude when the technician started travel")
    private BigDecimal departureLng;

    @Schema(description = "Timestamp when the technician checked in at the site")
    private Date checkInAt;

    @Schema(description = "Latitude when the technician checked in")
    private BigDecimal checkInLat;

    @Schema(description = "Longitude when the technician checked in")
    private BigDecimal checkInLng;

    @Schema(description = "Address where the technician checked in")
    private String checkInAddress;

    @Schema(description = "Timestamp when the technician checked out from the site")
    private Date checkOutAt;

    @Schema(description = "Latitude when the technician checked out")
    private BigDecimal checkOutLat;

    @Schema(description = "Longitude when the technician checked out")
    private BigDecimal checkOutLng;

    @Schema(description = "Address where the technician checked out")
    private String checkOutAddress;

    // Estes 3 eram gravados no banco (via change-status) mas nunca voltavam na
    // resposta - a tela de assinatura no web/mobile lia sempre undefined.
    @Schema(description = "Name of the person who signed the work order")
    private String signerName;

    @Schema(description = "Document (CPF/CNPJ) of the person who signed")
    private String signerDocument;

    @Schema(description = "Mileage traveled to complete the work order")
    private Double mileageTraveled;

    // Sprint 3A - snapshot congelado dos requisitos de conclusao da Category
    // no momento da criacao (ver WorkOrder.java / WorkOrderService). So
    // leitura: propositalmente ausente de WorkOrderPatchDTO/
    // WorkOrderBasePatchDTO, o snapshot nao deve ser reescrito diretamente via
    // PATCH nesta sprint.
    @Schema(description = "Whether the signer's name is required on completion (snapshot from the category)")
    private boolean requireSignerName;

    @Schema(description = "Whether the signer's CPF/CNPJ is required on completion (snapshot from the category)")
    private boolean requireSignerDocument;

    @Schema(description = "Whether at least one photo is required on completion (snapshot from the category)")
    private boolean requirePhotos;

    @Schema(description = "Whether the field report/feedback is required on completion (snapshot from the category)")
    private boolean requireFieldReport;

    @Schema(description = "Whether mileage traveled is required on completion (snapshot from the category)")
    private boolean requireMileage;

    @Schema(description = "Whether the checklist must be fully filled on completion (snapshot from the category)")
    private boolean requireChecklistCompletion;
}
