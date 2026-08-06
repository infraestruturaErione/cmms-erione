package com.grash.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.grash.model.abstracts.BasicInfos;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Entity
@Data
@NoArgsConstructor
@Schema(description = "Customer entity for managing client information and associations")
public class Customer extends BasicInfos {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Schema(description = "Unique identifier", accessMode = Schema.AccessMode.READ_ONLY)
    private Long id;

    @Schema(description = "Type of customer")
    private String customerType;

    @Schema(description = "City where the customer is located, used to group/filter work orders in the bulk report")
    private String city;

    // Opcional por enquanto - previsto pra virar o identificador principal do
    // relatorio em massa no futuro (mais preciso que nome/cidade, que podem
    // se repetir ou mudar). Nao validamos formato/unicidade ainda de proposito.
    @Schema(description = "CNPJ/CPF of the customer - optional today, planned to become the primary identifier " +
            "for the bulk report")
    private String cnpj;

    @Schema(description = "Customer description")
    private String description;

    @Schema(description = "Customer rate")
    private long rate;


    @Schema(description = "Billing name")
    private String billingName;

    @Schema(description = "Billing address line 1")
    private String billingAddress;

    @Schema(description = "Billing address line 2")
    private String billingAddress2;

    @OneToOne(fetch = FetchType.LAZY)
    private Currency billingCurrency;

    @Schema(description = "Indicates whether this is a demo customer")
    private boolean isDemo;

    @ManyToMany
    @JsonIgnore
    @JoinTable(name = "T_Part_customer_Associations",
            joinColumns = @JoinColumn(name = "id_customer"),
            inverseJoinColumns = @JoinColumn(name = "id_part"),
            indexes = {
                    @Index(name = "idx_customer_part_customer_id", columnList = "id_customer"),
                    @Index(name = "idx_customer_part_part_id", columnList = "id_part")
            })
    private List<Part> parts = new ArrayList<>();

    @ManyToMany
    @JsonIgnore
    @JoinTable(name = "T_Location_Customer_Associations",
            joinColumns = @JoinColumn(name = "id_customer"),
            inverseJoinColumns = @JoinColumn(name = "id_location"),
            indexes = {
                    @Index(name = "idx_customer_location_customer_id", columnList = "id_customer"),
                    @Index(name = "idx_customer_location_location_id", columnList = "id_location")
            })
    private List<Location> locations = new ArrayList<>();

    @ManyToMany
    @JsonIgnore
    @JoinTable(name = "T_Asset_Customer_Associations",
            joinColumns = @JoinColumn(name = "id_customer"),
            inverseJoinColumns = @JoinColumn(name = "id_asset"),
            indexes = {
                    @Index(name = "idx_customer_asset_customer_id", columnList = "id_customer"),
                    @Index(name = "idx_customer_asset_asset_id", columnList = "id_asset")
            })
    private List<Asset> assets = new ArrayList<>();

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CustomFieldValue> customFieldValues = new ArrayList<>();

}

