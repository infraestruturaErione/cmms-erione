package com.grash.mapper;

import com.grash.dto.CategoryMiniDTO;
import com.grash.dto.CategoryPatchDTO;
import com.grash.dto.WorkOrderCategoryPatchDTO;
import com.grash.model.WorkOrderCategory;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.Mappings;

@Mapper(componentModel = "spring")
public interface WorkOrderCategoryMapper {
    WorkOrderCategory updateWorkOrderCategory(@MappingTarget WorkOrderCategory entity, CategoryPatchDTO dto);

    WorkOrderCategory updateWorkOrderCategory(@MappingTarget WorkOrderCategory entity, WorkOrderCategoryPatchDTO dto);

    @Mappings({})
    CategoryPatchDTO toPatchDto(WorkOrderCategory model);

    CategoryMiniDTO toMiniDto(WorkOrderCategory model);
}
