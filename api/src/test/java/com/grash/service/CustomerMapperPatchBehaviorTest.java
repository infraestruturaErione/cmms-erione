package com.grash.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.dto.CustomerPatchDTO;
import com.grash.mapper.CustomerMapper;
import com.grash.model.Currency;
import com.grash.model.Customer;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import static org.junit.jupiter.api.Assertions.*;

class CustomerMapperPatchBehaviorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CustomerMapper mapper = Mappers.getMapper(CustomerMapper.class);

    @Test
    void patchMapsCustomerType() throws Exception {
        Customer entity = new Customer();
        entity.setName("Acme");
        entity.setCustomerType("OLD");

        CustomerPatchDTO dto = objectMapper.readValue(
                "{\"customerType\":\"NEW\"}",
                CustomerPatchDTO.class
        );

        Customer mapped = mapper.updateCustomer(entity, dto);

        assertEquals("NEW", mapped.getCustomerType());
    }

    @Test
    void patchPreservesRateWhenAbsentOrNullAndUpdatesWhenNumberProvided() throws Exception {
        Customer entity = new Customer();
        entity.setName("Acme");
        entity.setRate(123L);

        CustomerPatchDTO absentRate = objectMapper.readValue("{}", CustomerPatchDTO.class);
        Customer mappedAbsent = mapper.updateCustomer(entity, absentRate);
        assertEquals(123L, mappedAbsent.getRate());

        entity.setRate(123L);
        CustomerPatchDTO nullRate = objectMapper.readValue("{\"rate\":null}", CustomerPatchDTO.class);
        Customer mappedNull = mapper.updateCustomer(entity, nullRate);
        assertEquals(123L, mappedNull.getRate());

        entity.setRate(123L);
        CustomerPatchDTO numericRate = objectMapper.readValue("{\"rate\":456}", CustomerPatchDTO.class);
        Customer mappedNumeric = mapper.updateCustomer(entity, numericRate);
        assertEquals(456L, mappedNumeric.getRate());
    }

    @Test
    void patchPreservesBillingCurrencyWhenAbsentOrNull() throws Exception {
        Customer entity = new Customer();
        entity.setName("Acme");
        Currency currency = new Currency();
        currency.setId(99L);
        currency.setName("BRL");
        entity.setBillingCurrency(currency);

        CustomerPatchDTO absentCurrency = objectMapper.readValue("{}", CustomerPatchDTO.class);
        Customer mappedAbsent = mapper.updateCustomer(entity, absentCurrency);
        assertNotNull(mappedAbsent.getBillingCurrency());
        assertEquals(99L, mappedAbsent.getBillingCurrency().getId());

        entity.setBillingCurrency(currency);
        CustomerPatchDTO nullCurrency = objectMapper.readValue("{\"billingCurrency\":null}", CustomerPatchDTO.class);
        Customer mappedNull = mapper.updateCustomer(entity, nullCurrency);
        assertNotNull(mappedNull.getBillingCurrency());
        assertEquals(99L, mappedNull.getBillingCurrency().getId());
    }

    // Comportamento intencionalmente mudado por este fix: o endpoint PATCH
    // nao tem como distinguir "campo omitido no JSON" de "campo enviado
    // como null" usando um DTO comum (ambos resultam no mesmo valor null no
    // Java) - sem introduzir Optional<T>/JSON Merge Patch (fora do escopo
    // pedido), a unica semantica de PATCH segura e' tratar os dois casos
    // igual: preservar o valor existente. Antes deste fix, "phone": null
    // apagava o telefone existente (mesmo bug de nulls indevidos que afetava
    // TODOS os campos omitidos, so' que aqui explicito via JSON) - esse era
    // o comportamento incorreto que este teste validava de proposito.
    @Test
    void patchWithExplicitNull_preservesExistingValue_sameAsOmittedField() throws Exception {
        Customer entity = new Customer();
        entity.setName("Acme");
        entity.setPhone("+5511999999999");

        CustomerPatchDTO dto = objectMapper.readValue(
                "{\"phone\":null}",
                CustomerPatchDTO.class
        );

        Customer mapped = mapper.updateCustomer(entity, dto);

        assertEquals("+5511999999999", mapped.getPhone());
    }
}
