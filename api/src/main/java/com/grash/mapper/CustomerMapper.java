package com.grash.mapper;

import com.grash.dto.CustomerMiniDTO;
import com.grash.dto.CustomerPatchDTO;
import com.grash.dto.CustomerPostDTO;
import com.grash.dto.CustomerShowDTO;
import com.grash.model.Customer;
import org.mapstruct.AfterMapping;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Mappings;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", uses = {CustomFieldValueMapper.class})
public interface CustomerMapper {
    // Semantica de PATCH parcial real: um campo OMITIDO no corpo do PATCH
    // fica null em CustomerPatchDTO, e nullValuePropertyMappingStrategy =
    // IGNORE faz o MapStruct simplesmente NAO chamar o setter da entidade
    // nesse caso (em vez do padrao, que sobrescreveria o valor existente
    // com null). Um campo ENVIADO (nao-null) continua sendo copiado
    // normalmente - so muda o que acontece quando o campo nao vem.
    //
    // id/company/createdAt/createdBy/updatedAt/updatedBy sao ignorados
    // explicitamente por defesa - CustomerPatchDTO nao tem mais essas
    // propriedades (parou de estender BasicInfos/CompanyAudit/Audit, ver
    // comentario no DTO), mas ficam listados aqui pra deixar a intencao
    // clara e blindar contra qualquer reintroducao futura acidental dessas
    // propriedades no DTO. O bug original de "id" (PATCH sem id vindo do
    // cliente sobrescrevia o id real da entidade com null, e o Hibernate
    // rejeitava o flush com "identifier ... altered from null to X") so'
    // nao existe mais porque a propriedade nem existe no DTO agora.
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "company", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    // rate e' "long" primitivo na entidade (nao "Long") - despachar um
    // Long nulo direto pro setter causaria NullPointerException no
    // unboxing. billingCurrency e rate continuam com o tratamento manual
    // ja existente (ignorados aqui, reaplicados so' se nao-nulos em
    // preserveNullablePatchSemantics) em vez de depender da strategy
    // global, pra nao mudar um comportamento ja testado.
    @Mapping(target = "rate", ignore = true)
    @Mapping(target = "billingCurrency", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    Customer updateCustomer(@MappingTarget Customer entity, CustomerPatchDTO dto);

    @AfterMapping
    default void preserveNullablePatchSemantics(
            @MappingTarget Customer entity,
            CustomerPatchDTO dto
    ) {
        if (dto.getRate() != null) {
            entity.setRate(dto.getRate());
        }
        if (dto.getBillingCurrency() != null) {
            entity.setBillingCurrency(dto.getBillingCurrency());
        }
    }

    @Mappings({})
    CustomerPatchDTO toPatchDto(Customer model);

    CustomerMiniDTO toMiniDto(Customer model);

    CustomerShowDTO toShowDto(Customer model);

    Customer fromPostDto(CustomerPostDTO dto);
}
