package com.grash.service;

import com.grash.dto.LocationPatchDTO;
import com.grash.dto.LocationPostDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.FileMapperImpl;
import com.grash.mapper.LocationMapperImpl;
import com.grash.model.Company;
import com.grash.model.Location;
import com.grash.model.enums.LocationReferenceType;
import com.grash.repository.LocationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import jakarta.persistence.EntityManager;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Referencia Operacional (ID/PC) em Location - PATCH precisa distinguir
 * "campo omitido" (preserva) de "pedido explicito de limpeza" (referenceType
 * null + referenceCode ""), porque JSON nao distingue chave ausente de
 * valor null - um consumidor antigo que faz PATCH sem conhecer estes 2
 * campos novos NUNCA pode apagar uma referencia ja existente.
 * <p>
 * Mesmo padrao de CustomerPatchTest (bug real de producao equivalente para
 * Customer): LocationService real, LocationMapperImpl (gerado pelo
 * MapStruct) REAL - nao mockado - pra provar que o @Mapping(ignore=true)
 * de referenceType/referenceCode em LocationMapper.updateLocation funciona
 * de verdade, nao um mock fingindo funcionar. Demais dependencias mockadas.
 * update() nao invoca os sub-mappers (customer/vendor/user/team/file/
 * customFieldValue) - so' updateLocation, que so' mexe em campos escalares e
 * nas colecoes cruas do DTO - entao new LocationMapperImpl() sem os campos
 * @Autowired setados e' seguro aqui.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LocationReferencePatchTest {

    @Mock
    private LocationRepository locationRepository;
    @Mock
    private UserService userService;
    @Mock
    private CompanyService companyService;
    @Mock
    private CustomerService customerService;
    @Mock
    private org.springframework.context.MessageSource messageSource;
    @Mock
    private VendorService vendorService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private TeamService teamService;
    @Mock
    private EntityManager em;
    @Mock
    private FileService fileService;
    @Mock
    private CustomSequenceService customSequenceService;
    @Mock
    private LicenseService licenseService;
    @Mock
    private WebhookDispatchService webhookDispatchService;
    @Mock
    private CustomFieldValueService customFieldValueService;
    @Mock
    private CustomerScopeService customerScopeService;

    private LocationService locationService;
    private Company company;
    private Location existingWithId;

    @BeforeEach
    void setUp() throws NoSuchFieldException, IllegalAccessException {
        LocationMapperImpl locationMapper = new LocationMapperImpl();
        // create() chama locationMapper.toShowDto(...) pro payload do
        // webhook, que chama fileMapper.toShowDto(model.getImage())
        // incondicionalmente (nao so' quando image != null) - precisa de uma
        // instancia real (nao Spring-injetada, ja que este teste nao sobe
        // contexto) pro campo @Autowired nao ficar null. FileMapperImpl.
        // toShowDto(null) e' seguro sem storageServiceFactory (retorna null
        // antes de tocar nele) - as Locations deste teste nunca tem image.
        Field fileMapperField = LocationMapperImpl.class.getDeclaredField("fileMapper");
        fileMapperField.setAccessible(true);
        fileMapperField.set(locationMapper, new FileMapperImpl());

        locationService = new LocationService(locationRepository, userService, companyService, customerService,
                messageSource, vendorService, locationMapper, notificationService, teamService, em,
                fileService, customSequenceService, licenseService, webhookDispatchService, customFieldValueService,
                customerScopeService);

        company = new Company();
        company.setId(10L);

        existingWithId = new Location();
        existingWithId.setId(1L);
        existingWithId.setCompany(company);
        existingWithId.setName("Camera Praca Central");
        existingWithId.setAddress("Praca Central, 1");
        existingWithId.setReferenceType(LocationReferenceType.ID);
        existingWithId.setReferenceCode("15540");

        when(locationRepository.existsById(1L)).thenReturn(true);
        when(locationRepository.findById(1L)).thenReturn(Optional.of(existingWithId));
        when(locationRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(customSequenceService.getNextLocationSequence(any())).thenReturn(1L);
        when(licenseService.hasEntitlement(any())).thenReturn(true);
    }

    private LocationPatchDTO emptyPatch() {
        return new LocationPatchDTO();
    }

    // CASO CRITICO (requisito explicito do usuario): PATCH que OMITE
    // referenceType/referenceCode (consumidor antigo que nao conhece os
    // campos novos) NAO pode apagar uma referencia ja existente.
    @Test
    void patchOmittingReferenceFields_preservesExistingReference() {
        LocationPatchDTO dto = emptyPatch();
        dto.setName("Camera Praca Central - Renomeada");

        Location updated = locationService.update(1L, dto, company);

        assertEquals(LocationReferenceType.ID, updated.getReferenceType(),
                "PATCH antigo sem os campos novos nao pode apagar a referencia existente");
        assertEquals("15540", updated.getReferenceCode());
        assertEquals("Camera Praca Central - Renomeada", updated.getName(),
                "o resto do patch precisa continuar funcionando normalmente");
    }

    // Complemento do caso critico - PATCH totalmente vazio (nenhum campo,
    // nem name) tambem preserva a referencia.
    @Test
    void emptyPatch_preservesExistingReference() {
        Location updated = locationService.update(1L, emptyPatch(), company);

        assertEquals(LocationReferenceType.ID, updated.getReferenceType());
        assertEquals("15540", updated.getReferenceCode());
    }

    // CASO: referenceType=null + referenceCode="" e' o pedido EXPLICITO de
    // limpeza - diferente de omitir os dois (null/null, caso acima).
    @Test
    void explicitNullTypeAndEmptyCode_clearsExistingReference() {
        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(null);
        dto.setReferenceCode("");

        Location updated = locationService.update(1L, dto, company);

        assertNull(updated.getReferenceType());
        assertNull(updated.getReferenceCode());
    }

    // Mesmo caso, codigo so' com espacos - tambem conta como limpeza
    // explicita (trim antes de comparar a vazio).
    @Test
    void explicitNullTypeAndBlankCode_clearsExistingReference() {
        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(null);
        dto.setReferenceCode("   ");

        Location updated = locationService.update(1L, dto, company);

        assertNull(updated.getReferenceType());
        assertNull(updated.getReferenceCode());
    }

    // CASO: type + code validos altera a referencia existente (de ID/15540
    // para PC/04).
    @Test
    void validTypeAndCode_changesExistingReference() {
        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(LocationReferenceType.PC);
        dto.setReferenceCode("04");

        Location updated = locationService.update(1L, dto, company);

        assertEquals(LocationReferenceType.PC, updated.getReferenceType());
        assertEquals("04", updated.getReferenceCode());
    }

    // CASO: type + code validos tambem funciona quando NAO havia referencia
    // antes (cria uma nova via PATCH).
    @Test
    void validTypeAndCode_setsReferenceOnLocationWithoutOne() {
        Location withoutReference = new Location();
        withoutReference.setId(2L);
        withoutReference.setCompany(company);
        withoutReference.setName("Paco Municipal");
        when(locationRepository.existsById(2L)).thenReturn(true);
        when(locationRepository.findById(2L)).thenReturn(Optional.of(withoutReference));

        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(LocationReferenceType.ID);
        dto.setReferenceCode("  15540  ");

        Location updated = locationService.update(2L, dto, company);

        assertEquals(LocationReferenceType.ID, updated.getReferenceType());
        assertEquals("15540", updated.getReferenceCode(), "trim nas bordas");
    }

    // CASO invalido: type preenchido + code vazio (nao e' o sinal de
    // limpeza, que exige type NULL) - rejeitado.
    @Test
    void typeWithEmptyCode_isRejected() {
        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(LocationReferenceType.ID);
        dto.setReferenceCode("");

        CustomException ex = assertThrows(CustomException.class,
                () -> locationService.update(1L, dto, company));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    // CASO invalido: type null + code preenchido (nao vazio) - nao e' o
    // sinal de limpeza (que exige code vazio/so' espacos), e' o caso
    // "faltou o tipo pro codigo informado".
    @Test
    void nullTypeWithNonEmptyCode_isRejected() {
        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(null);
        dto.setReferenceCode("15540");

        CustomException ex = assertThrows(CustomException.class,
                () -> locationService.update(1L, dto, company));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    // CASO invalido: type preenchido + code omitido (null, nao "") - falta
    // o codigo pro tipo informado.
    @Test
    void typeWithOmittedCode_isRejected() {
        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(LocationReferenceType.PC);
        dto.setReferenceCode(null);

        assertThrows(CustomException.class, () -> locationService.update(1L, dto, company));
    }

    // Nenhuma combinacao invalida chega a chamar saveAndFlush - a excecao e'
    // lancada antes.
    @Test
    void invalidCombination_neverPersists() {
        LocationPatchDTO dto = emptyPatch();
        dto.setReferenceType(LocationReferenceType.ID);
        dto.setReferenceCode("");

        assertThrows(CustomException.class, () -> locationService.update(1L, dto, company));

        org.mockito.Mockito.verify(locationRepository, org.mockito.Mockito.never()).saveAndFlush(any());
    }

    // ===== CREATE =====

    private LocationPostDTO postDto(LocationReferenceType type, String code) {
        LocationPostDTO dto = new LocationPostDTO();
        dto.setName("Novo Local");
        dto.setReferenceType(type);
        dto.setReferenceCode(code);
        return dto;
    }

    // CREATE: sem referencia (ambos null) e' valido.
    @Test
    void create_withoutReference_isValid() {
        Location created = locationService.create(postDto(null, null), company);

        assertNull(created.getReferenceType());
        assertNull(created.getReferenceCode());
    }

    // CREATE: code em branco sem tipo tambem e' valido (trata como ausencia,
    // nao como erro).
    @Test
    void create_blankCodeWithoutType_isValid() {
        Location created = locationService.create(postDto(null, "   "), company);

        assertNull(created.getReferenceType());
        assertNull(created.getReferenceCode());
    }

    // CREATE: type + code validos.
    @Test
    void create_withValidReference_isPersisted() {
        Location created = locationService.create(postDto(LocationReferenceType.PC, "04"), company);

        assertEquals(LocationReferenceType.PC, created.getReferenceType());
        assertEquals("04", created.getReferenceCode());
    }

    // CREATE: type sem code e' rejeitado.
    @Test
    void create_typeWithoutCode_isRejected() {
        CustomException ex = assertThrows(CustomException.class,
                () -> locationService.create(postDto(LocationReferenceType.ID, null), company));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    // CREATE: code sem type e' rejeitado.
    @Test
    void create_codeWithoutType_isRejected() {
        CustomException ex = assertThrows(CustomException.class,
                () -> locationService.create(postDto(null, "15540"), company));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }
}
