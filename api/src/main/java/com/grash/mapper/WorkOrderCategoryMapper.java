package com.grash.mapper;

import com.grash.dto.CategoryMiniDTO;
import com.grash.dto.CategoryPatchDTO;
import com.grash.dto.WorkOrderCategoryPatchDTO;
import com.grash.model.WorkOrderCategory;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Mappings;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring")
public interface WorkOrderCategoryMapper {
    WorkOrderCategory updateWorkOrderCategory(@MappingTarget WorkOrderCategory entity, CategoryPatchDTO dto);

    // Os 7 require* sao Boolean no DTO (ver WorkOrderCategoryPatchDTO) so pra
    // isto: com IGNORE por campo, omitido (null) preserva o valor ja salvo na
    // entidade; false/true explicito aplica normalmente (IGNORE so pula
    // quando a ORIGEM e' null, nunca quando e' false). defaultChecklist/
    // toleranceMinutes/defaultEstimatedDuration ficam de fora de proposito -
    // nao mudar o comportamento deles nesta correcao (defaultChecklist em
    // particular precisa continuar aceitando null EXPLICITO pra desassociar
    // o questionario - um IGNORE aqui quebraria isso).
    @Mapping(target = "requireSignature", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "requireSignerName", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "requireSignerDocument", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "requirePhotos", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "requireFieldReport", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "requireMileage", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "requireChecklistCompletion", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    WorkOrderCategory updateWorkOrderCategory(@MappingTarget WorkOrderCategory entity, WorkOrderCategoryPatchDTO dto);

    @Mappings({})
    CategoryPatchDTO toPatchDto(WorkOrderCategory model);

    CategoryMiniDTO toMiniDto(WorkOrderCategory model);
}
