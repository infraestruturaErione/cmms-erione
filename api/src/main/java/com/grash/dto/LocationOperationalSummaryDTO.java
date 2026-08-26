package com.grash.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Aggregate operational counters for a single Location, computed via DB-side COUNT queries " +
        "(never a full collection load)")
public class LocationOperationalSummaryDTO {
    private long totalAssets;
    private long openWorkOrders;
    private long enRouteWorkOrders;
    private long inProgressWorkOrders;
    private long onHoldWorkOrders;
    private long completedWorkOrders;
    private long totalWorkOrders;
}
