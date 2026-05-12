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
}
