package com.grash.mapper;

import com.grash.dto.RolePatchDTO;
import com.grash.model.Role;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Mappings;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring")
public interface RoleMapper {
    // IGNORE por campo: RolePatchDTO ja usa List (nullable) pra estes 5
    // grupos, entao Jackson ja distingue "omitido" (null) de "[] explicito"
    // (lista vazia, nao-null) sem precisar de nenhum truque adicional. Sem
    // este IGNORE, o codigo gerado fazia "else { entity.setXPermissions(null)
    // }" quando o campo vinha omitido - um PATCH so de name/description
    // apagava as 5 listas de permissao inteiras. Com IGNORE: omitido
    // preserva a lista atual; [] limpa so aquele grupo (chega nao-null, entao
    // NAO e' ignorado - o merge existente de clear()+addAll faz a lista
    // ficar vazia); lista com valores substitui so aquele grupo. Nenhuma
    // outra logica de autorizacao/protecao de role foi alterada.
    @Mapping(target = "createPermissions", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "viewPermissions", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "viewOtherPermissions", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "editOtherPermissions", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "deleteOtherPermissions", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    Role updateRole(@MappingTarget Role entity, RolePatchDTO dto);

    @Mappings({})
    RolePatchDTO toPatchDto(Role model);
}
