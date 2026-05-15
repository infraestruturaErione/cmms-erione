package com.grash.dto.customer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerLocationListDTO {
    private Long id;
    private String name;
    private String customId;
    private String address;
    private Double latitude;
    private Double longitude;
}
