package com.grash.mapper;

import com.grash.dto.AssetShowDTO;
import com.grash.dto.FileShowDTO;
import com.grash.dto.LocationMiniDTO;
import com.grash.dto.LocationPatchDTO;
import com.grash.dto.LocationPostDTO;
import com.grash.dto.LocationShowDTO;
import com.grash.model.Asset;
import com.grash.model.Location;
import com.grash.service.AssetService;
import com.grash.service.LocationService;
import org.mapstruct.*;

@Mapper(componentModel = "spring", uses = {CustomerMapper.class, VendorMapper.class, UserMapper.class,
        TeamMapper.class, FileMapper.class, CustomFieldValueMapper.class})
public interface LocationMapper {
    // referenceType/referenceCode sao ignorados aqui de proposito - a
    // semantica de "campo omitido = preserva" (diferente dos demais campos
    // escalares, que este mapper sobrescreve incondicionalmente) e' aplicada
    // manualmente em LocationService.applyReferencePatch, depois desta
    // chamada. Ver comentario la' para o motivo (evitar que um consumidor
    // antigo do PATCH apague uma referencia existente so' por nao conhecer
    // estes 2 campos novos).
    @Mapping(target = "referenceType", ignore = true)
    @Mapping(target = "referenceCode", ignore = true)
    Location updateLocation(@MappingTarget Location entity, LocationPatchDTO dto);

    @Mappings({})
    LocationPatchDTO toPatchDto(Location model);

    LocationShowDTO toShowDto(Location model, @Context LocationService locationService);

    // Usado pela busca em lista (LocationService.findBySearchCriteria) - SEM
    // o @Context LocationService, entao o @AfterMapping abaixo (que exige
    // esse Context) nunca e' selecionado pro MapStruct gerar pra este
    // overload. Isso evita 1 query de hasChildren POR LINHA (N+1) numa
    // pagina de resultados; o valor e' preenchido depois, em lote, pelo
    // proprio LocationService (findParentIdsWithChildren, 1 query pra
    // pagina inteira).
    LocationShowDTO toFlatShowDto(Location model);

    @Mapping(source = "parentLocation.id", target = "parentId")
    LocationMiniDTO toMiniDto(Location model);

    Location fromPostDto(LocationPostDTO dto);

    @AfterMapping
    default LocationShowDTO toShowDto(Location model, @MappingTarget LocationShowDTO target,
                                      @Context LocationService locationService) {
        target.setHasChildren(locationService.hasChildren(model.getId()));
        return target;
    }
}
