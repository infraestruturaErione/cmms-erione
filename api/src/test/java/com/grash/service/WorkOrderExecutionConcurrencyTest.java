package com.grash.service;

import com.grash.exception.WorkOrderExecutionException;
import com.grash.model.*;
import com.grash.model.abstracts.DateAudit;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.RoleType;
import com.grash.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@DataJpaTest
@org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase(replace = org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = WorkOrderExecutionConcurrencyTest.JpaConfig.class)
@TestPropertySource(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "spring.liquibase.enabled=false",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect", "spring.jpa.show-sql=false",
        "spring.datasource.url=jdbc:h2:mem:execution-ownership;DB_CLOSE_DELAY=-1;NON_KEYWORDS=VALUE",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password="})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class WorkOrderExecutionConcurrencyTest {
    @Configuration
    @EnableAutoConfiguration
    @EntityScan("com.grash.model")
    @EnableJpaRepositories("com.grash.repository")
    static class JpaConfig { }

    @Autowired WorkOrderRepository repository;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired CustomerRepository customers;
    @Autowired LocationRepository locations;
    @Autowired AssetRepository assets;
    private TransactionTemplate transaction;
    private WorkOrderService service;
    private Company company;
    private User fabricio;
    private User joni;

    @BeforeEach
    void setup() throws Exception {
        transaction = new TransactionTemplate(transactionManager);
        // Exercise the real service with real JPA/locks inside independently committed transactions.
        var constructor = WorkOrderService.class.getDeclaredConstructors()[0];
        Object[] args = Arrays.stream(constructor.getParameterTypes()).map(type ->
                type == WorkOrderRepository.class ? repository : type == EntityManager.class ? em : mock(type)).toArray();
        service = (WorkOrderService) constructor.newInstance(args);
        service.setDeps(mock(WorkflowService.class), new CustomerScopeService(customers, locations, assets), mock(TaskService.class));
        transaction.executeWithoutResult(status -> {
            company = new Company(); company.setName("Execution concurrency test"); stamp(company); em.persist(company);
            Role role = new Role(); role.setName("Technician"); role.setCode(RoleCode.TECHNICIAN);
            role.setRoleType(RoleType.ROLE_CLIENT);
            role.setViewPermissions(new HashSet<>(List.of(PermissionEntity.WORK_ORDERS))); em.persist(role);
            fabricio = user("Fabricio", role); joni = user("Joni", role);
        });
    }

    private User user(String name, Role role) {
        User user = new User(); user.setFirstName(name); user.setLastName("Souza");
        user.setEmail(name + UUID.randomUUID() + "@test.local"); user.setUsername(user.getEmail());
        user.setPassword("test-only"); user.setRole(role); user.setCompany(company); stamp(user); em.persist(user);
        return user;
    }

    private static void stamp(DateAudit entity) {
        entity.setCreatedAt(new Date()); entity.setUpdatedAt(new Date());
    }

    private Long order(boolean teamAssigned) {
        return transaction.execute(status -> {
            WorkOrder wo = new WorkOrder(); wo.setTitle("Shared execution"); wo.setCompany(company); stamp(wo);
            if (teamAssigned) {
                Team team = new Team(); team.setName("Equipe Jacarei"); team.setCompany(company); stamp(team);
                team.setUsers(new ArrayList<>(List.of(fabricio, joni))); em.persist(team); wo.setTeam(team);
            } else {
                wo.setAssignedTo(new ArrayList<>(List.of(fabricio, joni)));
            }
            em.persist(wo); em.flush(); return wo.getId();
        });
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void onlyOneTransactionWinsEvenWithPreviouslyLoadedNullOwner(boolean teamAssigned) throws Exception {
        Long id = order(teamAssigned);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = pool.submit(() -> compete(id, fabricio, ready, start));
            Future<Boolean> second = pool.submit(() -> compete(id, joni, ready, start));
            assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            assertEquals(1, (first.get(20, TimeUnit.SECONDS) ? 1 : 0) + (second.get(20, TimeUnit.SECONDS) ? 1 : 0));
            transaction.executeWithoutResult(status -> {
                WorkOrder wo = repository.findById(id).orElseThrow();
                assertNotNull(wo.getExecutionClaimedAt());
                assertTrue(Set.of(fabricio.getId(), joni.getId()).contains(wo.getExecutionOwner().getId()));
                User observer = wo.getExecutionOwner().getId().equals(fabricio.getId()) ? joni : fabricio;
                assertDoesNotThrow(() -> service.checkAccessToWorkOrderId(id, observer));
                assertThrows(WorkOrderExecutionException.class, () -> service.checkOperationalWriteAccess(id, observer));
            });
        } finally { start.countDown(); pool.shutdownNow(); }
    }

    private boolean compete(Long id, User actor, CountDownLatch ready, CountDownLatch start) {
        try {
            return Boolean.TRUE.equals(transaction.execute(status -> {
                assertNull(repository.findById(id).orElseThrow().getExecutionOwner());
                ready.countDown();
                try { if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Barrier timed out"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                service.startExecution(id, actor);
                return true;
            }));
        } catch (WorkOrderExecutionException conflict) {
            assertEquals("WORK_ORDER_ALREADY_IN_EXECUTION", conflict.getCode());
            return false;
        }
    }
}
