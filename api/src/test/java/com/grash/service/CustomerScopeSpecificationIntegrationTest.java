package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SpecificationBuilder;
import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Location;
import com.grash.model.Request;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.abstracts.DateAudit;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.RoleType;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import com.grash.repository.RequestRepository;
import com.grash.repository.WorkOrderRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.JoinType;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regressao estrutural (3a rodada do pedido de correcao): Customer Scope
 * precisa ser SECURITY_SCOPE AND (USER_FILTER_TREE), nunca
 * SECURITY_SCOPE OR USER_FILTER - nenhum FilterField.alternatives enviado
 * pelo usuario pode escapar o escopo, em nenhuma profundidade.
 * <p>
 * Executa a Specification REAL (WrapperSpecification + SpecificationBuilder
 * + CustomerScopeService.customerScopeSpecification) contra um banco H2 real
 * via @DataJpaTest - nao apenas verifica mutacao de FilterField como os
 * testes antigos de addCustomerManyToManyScopeFilter (removido).
 */
@DataJpaTest
// @DataJpaTest normalmente descobre o @SpringBootApplication (ApiApplication)
// como fonte de configuracao e tenta instancia-lo como bean tambem - mas
// ApiApplication tem @RequiredArgsConstructor com dependencias pesadas
// (UserService etc.) que nao existem nesta fatia so-JPA. Uma
// @Configuration minima propria (via @ContextConfiguration) evita puxar a
// aplicacao inteira so pra testar Specification/predicate.
@ContextConfiguration(classes = CustomerScopeSpecificationIntegrationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.liquibase.enabled=false"
})
class CustomerScopeSpecificationIntegrationTest {

    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
    }

    @Autowired
    private WorkOrderRepository workOrderRepository;
    @Autowired
    private RequestRepository requestRepository;
    @Autowired
    private LocationRepository locationRepository;
    @Autowired
    private CustomerRepository customerRepository;
    @Autowired
    private AssetRepository assetRepository;
    @Autowired
    private EntityManager em;

    private CustomerScopeService customerScopeService;
    private Company company;
    private Customer customerA;
    private Customer customerB;
    private User requesterA;
    private User admin;
    private WorkOrder woA;
    private WorkOrder woB;

    @BeforeEach
    void setUp() {
        customerScopeService = new CustomerScopeService(customerRepository, locationRepository, assetRepository);

        company = persistCompany();
        customerA = persistCustomer("Cliente A");
        customerB = persistCustomer("Cliente B");

        Role requesterRole = persistRole(RoleCode.REQUESTER);
        Role adminRole = persistRole(RoleCode.ADMIN);

        requesterA = persistUser("requesterA@test.com", requesterRole, List.of(customerA));
        admin = persistUser("admin@test.com", adminRole, List.of());

        // Titulos deliberadamente compartilhando "XYZ" - um filtro de titulo
        // sozinho (sem escopo) bateria nos DOIS, provando que so o AND do
        // Customer Scope reduz o resultado pra A.
        woA = persistWorkOrder("XYZ Alpha", List.of(customerA));
        woB = persistWorkOrder("XYZ Beta", List.of(customerB));

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

    private Role persistRole(RoleCode code) {
        Role role = new Role();
        role.setRoleType(RoleType.ROLE_CLIENT);
        role.setCode(code);
        role.setName(code.name());
        em.persist(role);
        return role;
    }

    private User persistUser(String email, Role role, List<Customer> allowedCustomers) {
        User user = new User();
        user.setFirstName("Test");
        user.setLastName("User");
        user.setEmail(email);
        user.setUsername(email);
        user.setPassword("x");
        user.setRole(role);
        user.setCompany(company);
        user.setAllowedCustomers(new ArrayList<>(allowedCustomers));
        stampAudit(user);
        em.persist(user);
        return user;
    }

    private WorkOrder persistWorkOrder(String title, List<Customer> customers) {
        return persistWorkOrder(title, customers, com.grash.model.enums.Status.OPEN);
    }

    private WorkOrder persistWorkOrder(String title, List<Customer> customers, com.grash.model.enums.Status status) {
        WorkOrder wo = new WorkOrder();
        wo.setTitle(title);
        wo.setCompany(company);
        wo.setCustomers(new ArrayList<>(customers));
        wo.setStatus(status);
        stampAudit(wo);
        em.persist(wo);
        return wo;
    }

    private void stampAudit(Object entity) {
        Date now = new Date();
        if (entity instanceof DateAudit dateAudit) {
            dateAudit.setCreatedAt(now);
            dateAudit.setUpdatedAt(now);
        }
    }

    // --- helper de execucao real, espelha WorkOrderService.findBySearchCriteria ---
    private List<Long> searchWorkOrderIds(List<FilterField> filterFields, User user) {
        SpecificationBuilder<WorkOrder> builder = new SpecificationBuilder<>();
        filterFields.forEach(builder::with);
        Specification<WorkOrder> scopeSpec = customerScopeService.customerScopeSpecification(user, "customers");
        if (scopeSpec != null) {
            builder.with(scopeSpec);
        }
        return workOrderRepository.findAll(builder.build()).stream().map(WorkOrder::getId)
                .collect(Collectors.toList());
    }

    private FilterField titleContains(String value) {
        return FilterField.builder().field("title").operation("cn").value(value).build();
    }

    private FilterField customersIn(Long... ids) {
        return FilterField.builder().field("customers").operation("inm").joinType(JoinType.LEFT).value("")
                .values(new ArrayList<>(Arrays.asList(ids))).build();
    }

    // 1) Baseline: filtro simples de titulo que bate em A e B sem escopo -
    // com Customer Scope, so A pode voltar.
    @Test
    void titleFilterAlone_isScopedToOnlyAllowedCustomer() {
        List<Long> ids = searchWorkOrderIds(new ArrayList<>(List.of(titleContains("XYZ"))), requesterA);

        assertEquals(List.of(woA.getId()), ids);
    }

    // 2) Cenario exato do bug reportado: customers=[1] (dentro do escopo) OR
    // title contains "XYZ" (bate em A e B) - o ramo OR nao pode trazer B.
    @Test
    void customersAllowedOrTitleXYZ_neverLeaksDisallowedCustomer() {
        FilterField main = customersIn(customerA.getId());
        main.setAlternatives(new ArrayList<>(List.of(titleContains("XYZ"))));

        List<Long> ids = searchWorkOrderIds(new ArrayList<>(List.of(main)), requesterA);

        assertEquals(List.of(woA.getId()), ids);
        assertFalse(ids.contains(woB.getId()), "Customer B nunca pode vazar via alternatives");
    }

    // 3) Cenario exato do bug: customers=[2] (fora do escopo) OR title
    // contains "XYZ" (bate em A e B) - Customer 2 nao pode EXPANDIR o
    // resultado; so A pode voltar (nunca B, mesmo casando pelo titulo).
    @Test
    void customersDisallowedOrTitleXYZ_neverLeaksDisallowedCustomer() {
        FilterField main = customersIn(customerB.getId());
        main.setAlternatives(new ArrayList<>(List.of(titleContains("XYZ"))));

        List<Long> ids = searchWorkOrderIds(new ArrayList<>(List.of(main)), requesterA);

        assertEquals(List.of(woA.getId()), ids);
        assertFalse(ids.contains(woB.getId()), "Customer B nunca pode vazar via alternatives");
    }

    // 4) Alternative escondida em campo SEM relacao com customers - o main
    // filter (title) nao bate em nada; so a alternative "customers=[2]"
    // bateria em B se o escopo nao fosse aplicado de forma independente.
    @Test
    void alternativeOnUnrelatedField_hiddenDisallowedCustomer_neverLeaks() {
        FilterField main = titleContains("no-such-title-match");
        main.setAlternatives(new ArrayList<>(List.of(customersIn(customerB.getId()))));

        List<Long> ids = searchWorkOrderIds(new ArrayList<>(List.of(main)), requesterA);

        assertTrue(ids.isEmpty(), "sem escopo o customers=[2] escondido bateria em B; com escopo, zero resultados");
    }

    // 5) Alternativas aninhadas (2 niveis) - a mesma protecao precisa valer
    // em qualquer profundidade da arvore.
    @Test
    void nestedAlternatives_hiddenDisallowedCustomer_neverLeaks() {
        FilterField deepest = customersIn(customerB.getId());
        FilterField midLevel = titleContains("no-such-title-match-2");
        midLevel.setAlternatives(new ArrayList<>(List.of(deepest)));
        FilterField main = titleContains("no-such-title-match-3");
        main.setAlternatives(new ArrayList<>(List.of(midLevel)));

        List<Long> ids = searchWorkOrderIds(new ArrayList<>(List.of(main)), requesterA);

        assertTrue(ids.isEmpty(), "alternative aninhada (2 niveis) tambem precisa respeitar o escopo");
    }

    // 6) Sem nenhum filtro - Requester so ve os recursos do(s) customer(s)
    // permitido(s).
    @Test
    void noFilters_seesOnlyAllowedCustomer() {
        List<Long> ids = searchWorkOrderIds(new ArrayList<>(), requesterA);

        assertEquals(List.of(woA.getId()), ids);
    }

    // 7) Admin nao sofre restricao de Customer Scope - mesmo filtro do
    // cenario 3 (que pra Requester nunca vaza B) devolve os dois pro Admin.
    @Test
    void admin_isNeverRestrictedByCustomerScope() {
        FilterField main = customersIn(customerB.getId());
        main.setAlternatives(new ArrayList<>(List.of(titleContains("XYZ"))));

        List<Long> ids = searchWorkOrderIds(new ArrayList<>(List.of(main)), admin);

        assertEquals(2, ids.size());
        assertTrue(ids.contains(woA.getId()) && ids.contains(woB.getId()));
    }

    // --- SpecificationBuilder.with(Specification) empilhado: DUAS
    // Specifications REALMENTE restritivas (nao cb.conjunction(), que e'
    // sempre verdadeiro e sobreviveria mesmo se with() SOBRESCREVESSE em vez
    // de acumular - nao provava a acumulacao de verdade). Espelha
    // RequestService.findBySearchCriteria, que ja empilha uma Specification
    // de negocio (priority/status) ANTES da de Customer Scope. Cenario:
    // spec1 = cancelled==false (negocio), spec2 = customerScope(A) -
    // Request de A cancelada e' excluida por spec1 mesmo passando em spec2;
    // Request de B passa em spec1 mas e' excluida por spec2; so a Request de
    // A nao-cancelada passa nas duas.
    @Test
    void specificationBuilder_twoRestrictiveSpecifications_bothApplyAsAnd() {
        Request reqA = new Request();
        reqA.setTitle("Req XYZ Alpha");
        reqA.setCompany(company);
        reqA.setCustomers(new ArrayList<>(List.of(customerA)));
        reqA.setCancelled(false);
        stampAudit(reqA);
        em.persist(reqA);

        Request reqACancelled = new Request();
        reqACancelled.setTitle("Req XYZ Alpha Cancelled");
        reqACancelled.setCompany(company);
        reqACancelled.setCustomers(new ArrayList<>(List.of(customerA)));
        reqACancelled.setCancelled(true);
        stampAudit(reqACancelled);
        em.persist(reqACancelled);

        Request reqB = new Request();
        reqB.setTitle("Req XYZ Beta");
        reqB.setCompany(company);
        reqB.setCustomers(new ArrayList<>(List.of(customerB)));
        reqB.setCancelled(false);
        stampAudit(reqB);
        em.persist(reqB);
        em.flush();

        SpecificationBuilder<Request> builder = new SpecificationBuilder<>();
        // 1a Specification "de negocio", genuinamente restritiva.
        builder.with((Specification<Request>) (root, query, cb) -> cb.equal(root.get("cancelled"), false));
        // 2a Specification: Customer Scope.
        Specification<Request> scopeSpec = customerScopeService.customerScopeSpecification(requesterA, "customers");
        builder.with(scopeSpec);

        List<Long> ids = requestRepository.findAll(builder.build()).stream().map(Request::getId)
                .collect(Collectors.toList());

        assertEquals(List.of(reqA.getId()), ids,
                "as duas Specifications restritivas empilhadas precisam valer as DUAS (AND) - "
                        + "nem cancelled=false sozinha (deixaria passar B) nem customerScope sozinha "
                        + "(deixaria passar a cancelada de A)");
    }

    // Regressao (3a rodada, achado do Gepeto): customerScopeSpecification
    // fazia JOIN many-to-many em "customers" no ROOT da query - uma
    // WorkOrder compartilhada entre 2 Customers, AMBOS permitidos pro
    // Requester, gerava 1 linha de JOIN por Customer, duplicando a entidade
    // no resultado (e inflava totalElements). Fix definitivo: EXISTS
    // (subquery correlacionada) em vez de JOIN no root - nunca multiplica
    // linha nenhuma, entao nem precisa de DISTINCT (que em Hibernate 6
    // sempre vira SQL DISTINCT de verdade e quebra com Postgres 42P10 em
    // varios sorts - ver customerScopeSpecification). Sem query.distinct
    // nenhum aqui.
    @Test
    void sharedResource_allowedForBothCustomers_isNotDuplicated() {
        WorkOrder sharedWo = persistWorkOrder("Compartilhada A+B", List.of(customerA, customerB));
        em.flush();
        em.clear();

        User requesterBoth = persistUser("requesterBoth@test.com",
                persistRole(RoleCode.REQUESTER), List.of(customerA, customerB));
        em.flush();
        em.clear();

        SpecificationBuilder<WorkOrder> builder = new SpecificationBuilder<>();
        Specification<WorkOrder> scopeSpec = customerScopeService.customerScopeSpecification(requesterBoth,
                "customers");
        builder.with(scopeSpec);
        FilterField titleFilter = titleContains("Compartilhada");
        builder.with(titleFilter);

        org.springframework.data.domain.Page<WorkOrder> page = workOrderRepository.findAll(builder.build(),
                org.springframework.data.domain.PageRequest.of(0, 10));

        assertEquals(1, page.getTotalElements(), "totalElements precisa contar a entidade UMA vez, nao uma por " +
                "Customer associado");
        assertEquals(1, page.getContent().size(), "conteudo da pagina nao pode ter a mesma WorkOrder duplicada");
        assertEquals(sharedWo.getId(), page.getContent().get(0).getId());
    }

    // Paginacao com multiplos recursos permitidos e pageSize=1: cada pagina
    // precisa trazer um ID DIFERENTE (sem repeticao entre paginas), e
    // totalElements precisa ser o total real de recursos permitidos - prova
    // que o EXISTS nao interfere na paginacao (o que um JOIN duplicador
    // faria, ao inflar o total e/ou repetir linha entre paginas).
    @Test
    void multipleAllowedResources_pageSize1_pagesAreDistinctAndConsistent() {
        // woA (Customer A) e woB (Customer B) ja existem do setUp - torna
        // requesterAll permitido pros dois, sem nenhum compartilhado.
        User requesterAll = persistUser("requesterAll@test.com",
                persistRole(RoleCode.REQUESTER), List.of(customerA, customerB));
        em.flush();
        em.clear();

        SpecificationBuilder<WorkOrder> builder = new SpecificationBuilder<>();
        Specification<WorkOrder> scopeSpec = customerScopeService.customerScopeSpecification(requesterAll,
                "customers");
        builder.with(scopeSpec);
        builder.with(titleContains("XYZ"));

        org.springframework.data.domain.Page<WorkOrder> page0 = workOrderRepository.findAll(builder.build(),
                org.springframework.data.domain.PageRequest.of(0, 1,
                        org.springframework.data.domain.Sort.by("id")));
        org.springframework.data.domain.Page<WorkOrder> page1 = workOrderRepository.findAll(builder.build(),
                org.springframework.data.domain.PageRequest.of(1, 1,
                        org.springframework.data.domain.Sort.by("id")));

        assertEquals(2, page0.getTotalElements());
        assertEquals(1, page0.getContent().size());
        assertEquals(1, page1.getContent().size());
        Long id0 = page0.getContent().get(0).getId();
        Long id1 = page1.getContent().get(0).getId();
        assertNotEquals(id0, id1, "as duas paginas nao podem trazer o mesmo recurso");
        assertEquals(Set.of(woA.getId(), woB.getId()), Set.of(id0, id1));
    }

    // --- Location: mesmo mecanismo, campo "name" no lugar de "title". ---
    @Test
    void location_customersDisallowedOrName_neverLeaksDisallowedCustomer() {
        Location locA = new Location();
        locA.setName("XYZ Predio A");
        locA.setCompany(company);
        locA.setCustomers(new ArrayList<>(List.of(customerA)));
        stampAudit(locA);
        em.persist(locA);

        Location locB = new Location();
        locB.setName("XYZ Predio B");
        locB.setCompany(company);
        locB.setCustomers(new ArrayList<>(List.of(customerB)));
        stampAudit(locB);
        em.persist(locB);
        em.flush();

        SpecificationBuilder<Location> builder = new SpecificationBuilder<>();
        FilterField main = customersIn(customerB.getId());
        main.setAlternatives(new ArrayList<>(List.of(FilterField.builder().field("name").operation("cn")
                .value("XYZ").build())));
        builder.with(main);
        Specification<Location> scopeSpec = customerScopeService.customerScopeSpecification(requesterA, "customers");
        if (scopeSpec != null) builder.with(scopeSpec);

        List<Long> ids = locationRepository.findAll(builder.build()).stream().map(Location::getId)
                .collect(Collectors.toList());

        assertEquals(List.of(locA.getId()), ids);
    }
}
