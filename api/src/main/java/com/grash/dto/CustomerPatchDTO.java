package com.grash.dto;

import com.grash.dto.cutomField.CustomFieldValuePostDTO;
import com.grash.model.Currency;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

// Nao estende BasicInfos de proposito: BasicInfos e' @MappedSuperclass de
// ENTIDADE (Customer extends BasicInfos extends CompanyAudit extends Audit
// extends DateAudit), entao herdar dela aqui trazia junto:
// - name com @NotNull -> um PATCH que so' muda cnpj era rejeitado com 400
//   se nao reenviasse o name inteiro (semantica de PUT, nao de PATCH);
// - id/company/createdAt/updatedAt/createdBy/updatedBy como propriedades
//   Java validas do DTO, que o CustomerMapper.updateCustomer podia
//   sobrescrever com null sem querer (id ja tinha causado um 500 real -
//   ver comentario no mapper).
// Todo campo aqui e' opcional por design: omitido = preserva o valor atual
// da entidade (ver CustomerMapper.updateCustomer, que ignora nulls nesse
// metodo especifico). id/company/auditoria simplesmente nao existem nesta
// classe, entao nao ha o que o mapper possa sobrescrever por engano.
@Data
@NoArgsConstructor
@Schema(description = "DTO for patching an existing customer - every field is optional, omitted fields preserve " +
        "the current value")
public class CustomerPatchDTO {
    @Schema(description = "Customer name")
    private String name;

    @Schema(description = "Address")
    private String address;

    @Schema(description = "Phone number")
    private String phone;

    @Schema(description = "Website")
    private String website;

    @Schema(description = "Email address")
    private String email;

    @Schema(description = "Type of customer")
    private String customerType;

    @Schema(description = "City where the customer is located, used to group/filter work orders in the bulk report")
    private String city;

    @Schema(description = "CNPJ/CPF of the customer - optional today, planned to become the primary identifier " +
            "for the bulk report")
    private String cnpj;

    @Schema(description = "Description")
    private String description;

    @Schema(description = "Hourly rate")
    private Long rate;

    @Schema(description = "Billing name")
    private String billingName;

    @Schema(description = "Billing address line 1")
    private String billingAddress;

    @Schema(description = "Billing address line 2")
    private String billingAddress2;

    @Schema(description = "Currency for billing", implementation = IdDTO.class)
    private Currency billingCurrency;

    @Schema(description = "Custom field values for the customer - omitted or empty preserves existing values")
    private List<CustomFieldValuePostDTO> customFields = new ArrayList<>();
}
