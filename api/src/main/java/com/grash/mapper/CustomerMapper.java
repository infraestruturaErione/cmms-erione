package com.grash.mapper;

import com.grash.dto.CustomerMiniDTO;
import com.grash.dto.CustomerPatchDTO;
import com.grash.dto.CustomerPostDTO;
import com.grash.dto.CustomerShowDTO;
import com.grash.model.Customer;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Mappings;

@Mapper(componentModel = "spring", uses = {CustomFieldValueMapper.class})
public interface CustomerMapper {
    // CustomerPatchDTO herda "id" de CompanyAudit (via BasicInfos) mas o
    // corpo do PATCH nunca manda id (fica null) - sem ignorar, o MapStruct
    // sobrescrevia o id real da entidade com null e o Hibernate rejeitava o
    // flush ("identifier ... altered from null to X"). Toda edicao de
    // cliente quebrava com HTTP 500, nao so quando city foi adicionado.
    @Mapping(target = "id", ignore = true)
    Customer updateCustomer(@MappingTarget Customer entity, CustomerPatchDTO dto);

    @Mappings({})
    CustomerPatchDTO toPatchDto(Customer model);

    CustomerMiniDTO toMiniDto(Customer model);

    CustomerShowDTO toShowDto(Customer model);

    Customer fromPostDto(CustomerPostDTO dto);
}
