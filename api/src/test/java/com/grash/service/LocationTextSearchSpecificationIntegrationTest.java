package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SpecificationBuilder;
import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Location;
import com.grash.model.abstracts.DateAudit;
import com.grash.repository.LocationRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.JoinType;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Reforma de Locations/Customer, Etapa 1: cenario real do DEV2 reproduzido
 * aqui como teste - "Central de Videomonitoramento Consorciada" vinculada a
 * DOIS Customers ("Prefeitura de Santa Branca" e "Prefeitura de
 * Paraibuna"). Requisito explicito do usuario:
 * - buscar por qualquer um dos dois Customers precisa encontrar a Location;
 * - a Location NUNCA pode aparecer duplicada;
 * - totalElements NUNCA pode ser inflado pela relacao ManyToMany.
 * <p>
 * Executa LocationService.textSearchSpecification (Specification real, EXISTS
 * correlacionado - ver comentario no metodo) contra H2 real via
 * @DataJpaTest, mesmo padrao de CustomerScopeSpecificationIntegrationTest.
 */
@DataJpaTest
@ContextConfiguration(classes = LocationTextSearchSpecificationIntegrationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.liquibase.enabled=false"
})
class LocationTextSearchSpecificationIntegrationTest {

    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
    }

    @Autowired
    private LocationRepository locationRepository;
    @Autowired
    private EntityManager em;

    private Company company;
    private Customer santaBranca;
    private Customer paraibuna;
    private Location multiCustomerLocation;
    private Location ubsCentro;

    @BeforeEach
    void setUp() {
        company = persistCompany();
        santaBranca = persistCustomer("Prefeitura de Santa Branca");
        paraibuna = persistCustomer("Prefeitura de Paraibuna");

        // Reproduz exatamente o cenario real encontrado no DEV2 (auditoria
        // pre-implementacao): 1 Location com 2 Customers.
        multiCustomerLocation = new Location();
        multiCustomerLocation.setName("Central de Videomonitoramento Consorciada");
        multiCustomerLocation.setAddress("Av. Central, 10");
        multiCustomerLocation.setCustomId("L000009");
        multiCustomerLocation.setCompany(company);
        multiCustomerLocation.setCustomers(new ArrayList<>(List.of(santaBranca, paraibuna)));
        stampAudit(multiCustomerLocation);
        em.persist(multiCustomerLocation);

        ubsCentro = new Location();
        ubsCentro.setName("UBS Centro");
        ubsCentro.setAddress("Rua Marechal Deodoro, 500");
        ubsCentro.setCustomId("L000012");
        ubsCentro.setCompany(company);
        ubsCentro.setCustomers(new ArrayList<>(List.of(santaBranca)));
        stampAudit(ubsCentro);
        em.persist(ubsCentro);

        em.flush();
        em.clear();
    }

    private Company persistCompany() {
        Company c = new Company();
        c.setName("Empresa Teste");
        stampAudit(c);
        em.persist(c);
        return c;
    }

    private Customer persistCustomer(String name) {
        Customer customer = new Customer();
        customer.setName(name);
        customer.setCompany(company);
        stampAudit(customer);
        em.persist(customer);
        return customer;
    }

    private void stampAudit(Object entity) {
        Date now = new Date();
        if (entity instanceof DateAudit dateAudit) {
            dateAudit.setCreatedAt(now);
            dateAudit.setUpdatedAt(now);
        }
    }

    private Page<Location> search(String text) {
        Specification<Location> spec = LocationService.textSearchSpecification(text);
        return locationRepository.findAll(spec, PageRequest.of(0, 10, Sort.by("id")));
    }

    // CASO 1 (requisito explicito): buscar por "Santa Branca" (nome de um
    // dos 2 Customers vinculados) encontra a Location multi-customer.
    @Test
    void searchByFirstLinkedCustomerName_findsMultiCustomerLocation() {
        Page<Location> page = search("Santa Branca");

        List<Long> ids = page.getContent().stream().map(Location::getId).toList();
        assertTrue(ids.contains(multiCustomerLocation.getId()));
        assertTrue(ids.contains(ubsCentro.getId()), "UBS Centro tambem e' vinculada a Santa Branca");
    }

    // CASO 1 (requisito explicito): buscar pelo OUTRO Customer ("Paraibuna")
    // tambem encontra a MESMA Location.
    @Test
    void searchBySecondLinkedCustomerName_alsoFindsMultiCustomerLocation() {
        Page<Location> page = search("Paraibuna");

        List<Long> ids = page.getContent().stream().map(Location::getId).toList();
        assertEquals(List.of(multiCustomerLocation.getId()), ids,
                "so a Location vinculada a Paraibuna deve aparecer - UBS Centro nao esta vinculada a ela");
    }

    // CASO CRITICO (requisito explicito): a Location com 2 Customers NUNCA
    // pode aparecer duplicada, e totalElements NUNCA pode ser inflado pela
    // relacao ManyToMany - mesmo buscando por um termo que so bate nela.
    @Test
    void multiCustomerLocation_isNeverDuplicated_totalElementsNeverInflated() {
        Page<Location> page = search("Consorciada");

        assertEquals(1, page.getTotalElements(), "totalElements precisa contar a Location UMA vez, nao uma por " +
                "Customer associado");
        assertEquals(1, page.getContent().size(), "conteudo da pagina nao pode ter a Location duplicada");
        assertEquals(multiCustomerLocation.getId(), page.getContent().get(0).getId());
    }

    // Busca por nome direto da Location.
    @Test
    void searchByLocationName_findsIt() {
        Page<Location> page = search("UBS Centro");

        assertEquals(List.of(ubsCentro.getId()), page.getContent().stream().map(Location::getId).toList());
    }

    // Busca por parte do endereco.
    @Test
    void searchByAddressFragment_findsIt() {
        Page<Location> page = search("Marechal Deodoro");

        assertEquals(List.of(ubsCentro.getId()), page.getContent().stream().map(Location::getId).toList());
    }

    // Busca por customId/codigo.
    @Test
    void searchByCustomId_findsIt() {
        Page<Location> page = search("L000012");

        assertEquals(List.of(ubsCentro.getId()), page.getContent().stream().map(Location::getId).toList());
    }

    // Termo sem correspondencia nenhuma - resultado vazio, nao erro.
    @Test
    void searchWithNoMatch_returnsEmpty() {
        Page<Location> page = search("termo-que-nao-existe-em-lugar-nenhum");

        assertTrue(page.getContent().isEmpty());
        assertEquals(0, page.getTotalElements());
    }

    // Busca vazia/nula nao filtra nada (Specification null - builder.build()
    // sem ela devolve todas as Locations da company).
    @Test
    void blankOrNullSearch_returnsNullSpecification() {
        assertNull(LocationService.textSearchSpecification(null));
        assertNull(LocationService.textSearchSpecification("   "));
    }

    // CASO 4 (requisito explicito): filtro explicito de Customer (via
    // FilterField "customers"/"inm" ja existente, single-value - nao meu
    // Specification de texto) encontra a Location multi-customer por
    // QUALQUER um dos 2 Customers, sem duplicar.
    @Test
    void explicitCustomerFilter_singleValue_findsMultiCustomerLocation_noDuplication() {
        FilterField customerFilter = FilterField.builder()
                .field("customers").operation("inm").joinType(JoinType.LEFT)
                .value("").values(new ArrayList<>(List.of(paraibuna.getId()))).build();

        SpecificationBuilder<Location> builder = new SpecificationBuilder<>();
        builder.with(customerFilter);
        Page<Location> page = locationRepository.findAll(builder.build(), PageRequest.of(0, 10, Sort.by("id")));

        assertEquals(1, page.getTotalElements());
        assertEquals(multiCustomerLocation.getId(), page.getContent().get(0).getId());
    }

    // CASO 5 (requisito explicito): Customer + texto combinados - AND entre
    // os dois filtros.
    @Test
    void customerFilterCombinedWithText_appliesAsAnd() {
        FilterField customerFilter = FilterField.builder()
                .field("customers").operation("inm").joinType(JoinType.LEFT)
                .value("").values(new ArrayList<>(List.of(santaBranca.getId()))).build();

        SpecificationBuilder<Location> builder = new SpecificationBuilder<>();
        builder.with(customerFilter);
        builder.with(LocationService.textSearchSpecification("UBS"));

        Page<Location> page = locationRepository.findAll(builder.build(), PageRequest.of(0, 10, Sort.by("id")));

        // So UBS Centro bate em AMBOS (customer Santa Branca E texto "UBS") -
        // Central de Videomonitoramento tambem e' de Santa Branca, mas nao
        // bate no texto "UBS".
        assertEquals(1, page.getTotalElements());
        assertEquals(ubsCentro.getId(), page.getContent().get(0).getId());
    }

    // BUG CRITICO DE PRODUCAO (833 Locations reais): a tela global
    // "/app/locations" com "Cliente: Todos" + busca vazia usava
    // GET locations/children/0 (parentLocation IS NULL), que em producao
    // retornava 0 porque a maioria/todos os Locations reais tem
    // parentLocation preenchido. A correcao faz a tela SEMPRE usar
    // POST locations/search (builder vazio = todas as Locations da
    // company, com ou sem parentLocation) - este teste reproduz a escala
    // real (833) pra confirmar que nenhum Location e' excluido por ter
    // parentLocation, que o total NUNCA e' inflado/mascarado, e que uma
    // pagina nunca carrega mais que o pageSize pedido.
    @Test
    void emptySearchAndNoFilters_returnsAllCompanyLocations_regardlessOfParentLocation() {
        final int totalToCreate = 833;
        Location previous = null;
        int withParentCount = 0;
        for (int i = 0; i < totalToCreate; i++) {
            Location location = new Location();
            location.setName("Location " + i);
            location.setCustomId("L" + String.format("%06d", i + 100));
            location.setCompany(company);
            // Metade das Locations tem parentLocation preenchido (cenario
            // real de producao) - a outra metade e' raiz (parentLocation
            // null). Ambas precisam contar igualmente pro total global.
            if (previous != null && i % 2 == 0) {
                location.setParentLocation(previous);
                withParentCount++;
            }
            stampAudit(location);
            em.persist(location);
            previous = location;
            if (i % 100 == 0) {
                em.flush();
            }
        }
        em.flush();
        em.clear();

        // +2 das Locations criadas no setUp (multiCustomerLocation, ubsCentro).
        long expectedTotal = totalToCreate + 2;
        assertTrue(withParentCount > 0, "sanity check: o cenario precisa incluir Locations com parentLocation");

        SpecificationBuilder<Location> builder = new SpecificationBuilder<>();
        // Sem FilterField nenhum e sem texto de busca - exatamente o que o
        // frontend agora sempre envia pra "Cliente: Todos" + busca vazia.
        Page<Location> firstPage = locationRepository.findAll(builder.build(), PageRequest.of(0, 10, Sort.by("id")));

        assertEquals(expectedTotal, firstPage.getTotalElements(),
                "totalElements precisa ser o total REAL de Locations da company, com ou sem parentLocation");
        assertEquals(10, firstPage.getContent().size(),
                "a primeira pagina nunca pode trazer mais que o pageSize pedido, mesmo com centenas de registros");

        // Nenhuma pagina, ao longo de toda a paginacao, pode extrapolar o
        // pageSize - e a soma de todo mundo precisa bater com o total.
        long totalPages = (expectedTotal + 9) / 10;
        long accumulated = 0;
        for (int page = 0; page < totalPages; page++) {
            Page<Location> p = locationRepository.findAll(builder.build(), PageRequest.of(page, 10, Sort.by("id")));
            assertTrue(p.getContent().size() <= 10, "nenhuma pagina pode carregar mais que o pageSize pedido");
            accumulated += p.getContent().size();
        }
        assertEquals(expectedTotal, accumulated,
                "a soma de todas as paginas precisa bater com totalElements - nada pode ser perdido nem duplicado");
    }
}
