package com.grash.service;

import com.grash.dto.CustomerPatchDTO;
import com.grash.dto.cutomField.CustomFieldValuePostDTO;
import com.grash.mapper.CustomerMapperImpl;
import com.grash.model.Company;
import com.grash.model.Currency;
import com.grash.model.CustomFieldValue;
import com.grash.model.Customer;
import com.grash.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bug real de producao: PATCH /customers/{id} nao tinha semantica de PATCH
 * parcial. CustomerPatchDTO estendia BasicInfos (@MappedSuperclass de
 * ENTIDADE, nao DTO), trazendo junto name com @NotNull (PATCH sem name
 * rejeitado com 400 mesmo mudando so' um campo) e id/company/createdAt/
 * createdBy/updatedAt/updatedBy como propriedades que o CustomerMapper
 * podia sobrescrever com null. E' o mesmo mapper usado pelo endpoint real
 * (CustomerController.patch -> CustomerService.update -> CustomerMapper.
 * updateCustomer), so' com CustomerRepository/CustomFieldValueService/
 * LicenseService mockados - CustomerMapperImpl (gerado pelo MapStruct) e'
 * usado de verdade, sem mock, pra provar o comportamento real de mapping.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CustomerPatchTest {

    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private LicenseService licenseService;
    @Mock
    private CustomFieldValueService customFieldValueService;

    private CustomerService customerService;
    private Company company;
    private Customer existing;

    @BeforeEach
    void setUp() {
        customerService = new CustomerService(customerRepository, new CustomerMapperImpl(), licenseService,
                customFieldValueService);

        company = new Company();
        company.setId(10L);

        existing = new Customer();
        existing.setId(1L);
        existing.setCompany(company);
        existing.setCreatedBy(2L);
        existing.setUpdatedBy(2L);
        existing.setCreatedAt(new Date(1000L));
        existing.setUpdatedAt(new Date(2000L));
        existing.setName("Prefeitura de Santa Branca");
        existing.setAddress("Praca Ajudante Franca, 20");
        existing.setPhone("11999999999");
        existing.setWebsite("https://santabranca.sp.gov.br");
        existing.setEmail("contato@santabranca.sp.gov.br");
        existing.setCustomerType("Prefeitura");
        existing.setCity("Santa Branca");
        existing.setCnpj("11.111.111/0001-11");
        existing.setDescription("Cliente original");
        existing.setRate(100L);
        existing.setBillingName("Municipio de Santa Branca");
        existing.setBillingAddress("Endereco de cobranca original");
        existing.setBillingAddress2("Complemento original");
        Currency originalCurrency = new Currency();
        originalCurrency.setId(5L);
        existing.setBillingCurrency(originalCurrency);
        CustomFieldValue existingCfv = new CustomFieldValue();
        existing.setCustomFieldValues(new ArrayList<>(List.of(existingCfv)));

        when(customerRepository.existsById(1L)).thenReturn(true);
        when(customerRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(customerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    // CASO 1 (requisito explicito): PATCH so' cnpj altera somente cnpj.
    @Test
    void patchOnlyCnpj_changesOnlyCnpj() {
        CustomerPatchDTO dto = new CustomerPatchDTO();
        dto.setCnpj("22.222.222/0001-22");

        Customer updated = customerService.update(1L, dto, company);

        assertEquals("22.222.222/0001-22", updated.getCnpj());
        assertEquals("Prefeitura de Santa Branca", updated.getName());
        assertEquals("Praca Ajudante Franca, 20", updated.getAddress());
        assertEquals("11999999999", updated.getPhone());
        assertEquals("https://santabranca.sp.gov.br", updated.getWebsite());
        assertEquals("contato@santabranca.sp.gov.br", updated.getEmail());
        assertEquals("Prefeitura", updated.getCustomerType());
        assertEquals("Santa Branca", updated.getCity());
        assertEquals("Cliente original", updated.getDescription());
        assertEquals("Municipio de Santa Branca", updated.getBillingName());
        assertEquals("Endereco de cobranca original", updated.getBillingAddress());
        assertEquals("Complemento original", updated.getBillingAddress2());
        assertEquals(100L, updated.getRate());
        assertEquals(5L, updated.getBillingCurrency().getId());
    }

    // CASO 2 (requisito explicito): PATCH so' address altera somente address.
    @Test
    void patchOnlyAddress_changesOnlyAddress() {
        CustomerPatchDTO dto = new CustomerPatchDTO();
        dto.setAddress("Novo Endereco, 500");

        Customer updated = customerService.update(1L, dto, company);

        assertEquals("Novo Endereco, 500", updated.getAddress());
        assertEquals("Prefeitura de Santa Branca", updated.getName());
        assertEquals("11999999999", updated.getPhone());
        assertEquals("11.111.111/0001-11", updated.getCnpj());
        assertEquals("Prefeitura", updated.getCustomerType());
        assertEquals("Santa Branca", updated.getCity());
    }

    // CASO 3 (requisito explicito): PATCH sem name e' valido - nao lanca
    // excecao e o name existente e' preservado. A ausencia de @NotNull em
    // CustomerPatchDTO.name (comparado a Customer.name, que continua
    // exigindo o valor na entidade/BasicInfos) e' confirmada via reflection,
    // provando que a validacao de Bean Validation do @Valid no controller
    // nao rejeitaria mais um PATCH sem name.
    @Test
    void patchWithoutName_isValid_preservesExistingName() throws NoSuchFieldException {
        CustomerPatchDTO dto = new CustomerPatchDTO();
        dto.setCity("Nova Cidade");

        Customer updated = customerService.update(1L, dto, company);

        assertEquals("Prefeitura de Santa Branca", updated.getName());
        assertEquals("Nova Cidade", updated.getCity());

        Field nameField = CustomerPatchDTO.class.getDeclaredField("name");
        assertFalse(
                nameField.isAnnotationPresent(jakarta.validation.constraints.NotNull.class),
                "CustomerPatchDTO.name nao pode mais ter @NotNull - PATCH parcial precisa aceitar name omitido"
        );
    }

    // CASO 4 (requisito explicito): campos omitidos permanecem - cobertura
    // ampla com varios campos de uma vez, incluindo um PATCH "vazio"
    // (nenhum campo setado) que nao deve alterar nada na entidade.
    @Test
    void emptyPatch_preservesEveryField() {
        CustomerPatchDTO dto = new CustomerPatchDTO();

        Customer updated = customerService.update(1L, dto, company);

        assertEquals("Prefeitura de Santa Branca", updated.getName());
        assertEquals("Praca Ajudante Franca, 20", updated.getAddress());
        assertEquals("11999999999", updated.getPhone());
        assertEquals("https://santabranca.sp.gov.br", updated.getWebsite());
        assertEquals("contato@santabranca.sp.gov.br", updated.getEmail());
        assertEquals("Prefeitura", updated.getCustomerType());
        assertEquals("Santa Branca", updated.getCity());
        assertEquals("11.111.111/0001-11", updated.getCnpj());
        assertEquals("Cliente original", updated.getDescription());
        assertEquals(100L, updated.getRate());
        assertEquals("Municipio de Santa Branca", updated.getBillingName());
        assertEquals("Endereco de cobranca original", updated.getBillingAddress());
        assertEquals("Complemento original", updated.getBillingAddress2());
        assertEquals(5L, updated.getBillingCurrency().getId());
    }

    // CASO 5 (requisito explicito): auditoria/company nao sao alterados,
    // mesmo quando outros campos sao patchados de verdade.
    @Test
    void patch_neverChangesIdCompanyOrAuditFields() {
        CustomerPatchDTO dto = new CustomerPatchDTO();
        dto.setName("Nome Alterado");
        dto.setCnpj("33.333.333/0001-33");

        Customer updated = customerService.update(1L, dto, company);

        assertEquals(1L, updated.getId());
        assertSame(company, updated.getCompany());
        assertEquals(2L, updated.getCreatedBy());
        assertEquals(2L, updated.getUpdatedBy());
        assertEquals(new Date(1000L), updated.getCreatedAt());
        assertEquals(new Date(2000L), updated.getUpdatedAt());
    }

    // CASO 6 (requisito explicito): customFields omitido/vazio nao apaga os
    // existentes - CustomFieldValueService.setCustomFields nunca e' chamado
    // nesses dois casos, e a colecao da entidade continua a mesma.
    @Test
    void customFields_omittedOrEmpty_doesNotWipeExisting() {
        List<CustomFieldValue> originalValues = existing.getCustomFieldValues();

        CustomerPatchDTO omittedDto = new CustomerPatchDTO();
        omittedDto.setCustomFields(null);
        Customer afterOmitted = customerService.update(1L, omittedDto, company);
        assertSame(originalValues, afterOmitted.getCustomFieldValues());
        assertEquals(1, afterOmitted.getCustomFieldValues().size());

        CustomerPatchDTO emptyDto = new CustomerPatchDTO();
        emptyDto.setCustomFields(new ArrayList<>());
        Customer afterEmpty = customerService.update(1L, emptyDto, company);
        assertSame(originalValues, afterEmpty.getCustomFieldValues());
        assertEquals(1, afterEmpty.getCustomFieldValues().size());

        verify(customFieldValueService, never()).setCustomFields(any(), any(), any(), any(), any(), any());
    }

    // Complemento do caso 6 - com customFields REALMENTE preenchido, o
    // service continua chamando setCustomFields normalmente (comportamento
    // pre-existente preservado, nao alterado por esta correcao).
    @Test
    void customFields_whenProvided_stillDelegatesToCustomFieldValueService() {
        CustomerPatchDTO dto = new CustomerPatchDTO();
        CustomFieldValuePostDTO cfv = new CustomFieldValuePostDTO();
        dto.setCustomFields(new ArrayList<>(List.of(cfv)));

        customerService.update(1L, dto, company);

        verify(customFieldValueService).setCustomFields(any(), any(), any(), any(), any(), any());
    }
}
