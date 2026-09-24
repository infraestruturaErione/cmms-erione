package com.grash.service;

import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.abstracts.DateAudit;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.RoleType;
import com.grash.repository.AssetRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.LocationRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Reproduz, com Hibernate real (H2), o desenho de producao: o User vem do banco
 * numa transacao que ja terminou (detached), e o MESMO objeto e' entregue pelo
 * cache "users" a todas as requests. Uma colecao LAZY nao inicializada nesse
 * objeto era inicializada por varias threads ao mesmo tempo
 * ("Illegal pop() with non-matching JdbcValuesSourceProcessingState",
 * HTTP 500 em /work-orders/search).
 */
@DataJpaTest
@ContextConfiguration(classes = UserCacheAllowedCustomersIntegrationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.liquibase.enabled=false",
        // Mesmo valor de application.yml: sem ele o acesso a colecao lazy de um
        // User detached falharia com LazyInitializationException em vez de
        // reproduzir o comportamento real.
        "spring.jpa.properties.hibernate.enable_lazy_load_no_trans=true"
})
// Precisa COMMITAR de verdade: a colecao lazy do User detached e' carregada
// depois, por outra conexao, e nao enxergaria dados de uma transacao de teste
// ainda aberta.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class UserCacheAllowedCustomersIntegrationTest {

    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
    }

    @Autowired
    private EntityManager em;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private TransactionTemplate tx;
    private CacheService cacheService;
    private CustomerScopeService customerScopeService;

    private Long companyId;
    private Long customerAId;
    private Long customerBId;

    @BeforeEach
    void setUp() {
        tx = new TransactionTemplate(transactionManager);
        cacheService = new CacheService(new ConcurrentMapCacheManager("users"));
        customerScopeService = new CustomerScopeService(Mockito.mock(CustomerRepository.class),
                Mockito.mock(LocationRepository.class), Mockito.mock(AssetRepository.class));

        tx.executeWithoutResult(status -> {
            Company company = new Company();
            company.setName("Empresa Cache");
            stamp(company);
            em.persist(company);
            companyId = company.getId();
            Customer a = customer("Cliente A", company);
            Customer b = customer("Cliente B", company);
            em.persist(a);
            em.persist(b);
            em.flush();
            customerAId = a.getId();
            customerBId = b.getId();
        });
    }

    private void stamp(Object entity) {
        Date now = new Date();
        if (entity instanceof DateAudit audit) {
            audit.setCreatedAt(now);
            audit.setUpdatedAt(now);
        }
    }

    private Customer customer(String name, Company company) {
        Customer customer = new Customer();
        customer.setName(name);
        customer.setCompany(company);
        stamp(customer);
        return customer;
    }

    /** Persiste o usuario numa transacao propria e o devolve DETACHED, do jeito que o repository o entrega. */
    private User loadDetachedUser(String email, RoleCode code, boolean allowCustomerA) {
        Long userId = tx.execute(status -> {
            Role role = new Role();
            role.setRoleType(RoleType.ROLE_CLIENT);
            role.setCode(code);
            role.setName(code.name());
            em.persist(role);

            Company company = em.find(Company.class, companyId);
            User user = new User();
            user.setFirstName("Test");
            user.setLastName("User");
            user.setEmail(email);
            user.setUsername(email);
            user.setPassword("x");
            user.setRole(role);
            user.setCompany(company);
            if (allowCustomerA) {
                user.setAllowedCustomers(new ArrayList<>(Collections.singletonList(em.find(Customer.class, customerAId))));
            }
            stamp(user);
            em.persist(user);
            em.flush();
            return user.getId();
        });
        // Nova transacao so pra ler: ao terminar, o User fica detached com a colecao lazy intocada.
        return tx.execute(status -> em.find(User.class, userId));
    }

    @Test
    void controlScenarioTheDetachedUserComesFromTheDatabaseWithAnUninitializedLazyCollection() {
        User loaded = loadDetachedUser("control@test.com", RoleCode.REQUESTER, true);

        // Prova que o cenario do teste e' o arriscado: sem essa premissa, os testes abaixo nao provariam nada.
        assertFalse(Hibernate.isInitialized(loaded.getAllowedCustomers()));
    }

    @Test
    void putUserInCacheInitializesAllowedCustomersSoTheCachedUserIsReadyForScopeChecks() {
        User loaded = loadDetachedUser("requester@test.com", RoleCode.REQUESTER, true);

        cacheService.putUserInCache(loaded);
        User cached = cacheService.getUserFromCache("requester@test.com").orElseThrow();

        assertTrue(Hibernate.isInitialized(cached.getAllowedCustomers()),
                "allowedCustomers deve ir inicializada para o cache");
        assertEquals(1, cached.getAllowedCustomers().size());
        assertEquals(customerAId, cached.getAllowedCustomers().get(0).getId());
        // As demais relacoes que o cache ja garantia continuam inicializadas.
        assertTrue(Hibernate.isInitialized(cached.getRole()));
        assertTrue(Hibernate.isInitialized(cached.getRole().getViewPermissions()));
    }

    @Test
    void cachedRequesterKeepsSeeingOnlyTheirOwnCustomerAfterTheSessionIsGone() {
        User loaded = loadDetachedUser("scoped@test.com", RoleCode.REQUESTER, true);
        cacheService.putUserInCache(loaded);
        User cached = cacheService.getUserFromCache("scoped@test.com").orElseThrow();

        assertTrue(customerScopeService.hasRestrictedCustomerScope(cached));
        assertEquals(Collections.singletonList(customerAId), customerScopeService.getAllowedCustomerIds(cached));
        assertTrue(customerScopeService.canAccessCustomer(cached, customerAId));
        assertFalse(customerScopeService.canAccessCustomer(cached, customerBId),
                "REQUESTER nao pode enxergar customer fora do allowedCustomers");
    }

    @Test
    void cachedLimitedAdminKeepsTheSameScope() {
        User loaded = loadDetachedUser("limited@test.com", RoleCode.LIMITED_ADMIN, true);
        cacheService.putUserInCache(loaded);
        User cached = cacheService.getUserFromCache("limited@test.com").orElseThrow();

        assertTrue(customerScopeService.hasRestrictedCustomerScope(cached));
        assertFalse(customerScopeService.canAccessCustomer(cached, customerBId));
    }

    @Test
    void cachedAdminIsNotRestrictedAndSeesEveryCustomer() {
        User loaded = loadDetachedUser("admin@test.com", RoleCode.ADMIN, false);
        cacheService.putUserInCache(loaded);
        User cached = cacheService.getUserFromCache("admin@test.com").orElseThrow();

        assertFalse(customerScopeService.hasRestrictedCustomerScope(cached));
        assertTrue(customerScopeService.canAccessCustomer(cached, customerAId));
        assertTrue(customerScopeService.canAccessCustomer(cached, customerBId));
    }

    /**
     * Varias threads lendo o MESMO User cacheado ao mesmo tempo, largando juntas
     * (barreira, sem sleep/timing artificial). Deterministico no que afirma:
     * nenhuma thread pode falhar e todas devem ver o mesmo escopo.
     */
    @Test
    void concurrentScopeChecksOnTheSameCachedUserNeverFailAndAgree() throws Exception {
        User loaded = loadDetachedUser("concurrent@test.com", RoleCode.REQUESTER, true);
        cacheService.putUserInCache(loaded);
        User cached = cacheService.getUserFromCache("concurrent@test.com").orElseThrow();

        int threads = 16;
        int iterations = 200;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CyclicBarrier startTogether = new CyclicBarrier(threads);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                Callable<Boolean> task = () -> {
                    startTogether.await();
                    boolean allConsistent = true;
                    for (int n = 0; n < iterations; n++) {
                        allConsistent &= customerScopeService.hasRestrictedCustomerScope(cached);
                        allConsistent &= customerScopeService.getAllowedCustomerIds(cached)
                                .equals(Collections.singletonList(customerAId));
                        allConsistent &= !customerScopeService.canAccessCustomer(cached, customerBId);
                    }
                    return allConsistent;
                };
                results.add(pool.submit(task));
            }
            for (Future<Boolean> result : results) {
                assertTrue(result.get(), "todas as threads devem ver o mesmo escopo, sem excecao");
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
