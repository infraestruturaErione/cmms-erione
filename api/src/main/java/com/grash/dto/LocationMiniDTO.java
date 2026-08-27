package com.grash.dto;

import com.grash.model.enums.LocationReferenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class LocationMiniDTO {

    @Schema(description = "Unique identifier", accessMode = Schema.AccessMode.READ_ONLY)
    private Long id;

    @Schema(description = "Name")
    private String name;

    @Schema(description = "Address")
    private String address;

    @Schema(description = "Custom identifier")
    private String customId;

    @Schema(description = "Parent location ID")
    private Long parentId;

    @Schema(description = "The longitude coordinate of the location")
    private Double longitude;

    @Schema(description = "The latitude coordinate of the location")
    private Double latitude;

    @Schema(description = "Type of the operational reference code (ID or PC) - optional, presentation-only")
    private LocationReferenceType referenceType;

    @Schema(description = "Operational reference code - optional, presentation-only")
    private String referenceCode;

}
