package com.grash.dto.customer;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Operational summary for a customer/city hub")
public class CustomerOperationalSummaryDTO {
    private long totalLocations;
    private long totalAssets;
    private long locationsWithAssets;
    private long locationsWithoutAssets;
    private long locationsWithCoordinates;
    private long openWorkOrders;
    private long enRouteWorkOrders;
    private long inProgressWorkOrders;
    private long onHoldWorkOrders;
    private long completedWorkOrders;
    private long totalWorkOrders;
}
