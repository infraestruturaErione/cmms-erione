package com.grash.service;

import com.grash.dto.workOrder.report.*;
import com.grash.model.*;
import com.grash.model.enums.Status;
import com.grash.repository.WorkOrderRepository;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validation;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.*;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = WorkOrderBulkScopeIntegrationTest.JpaConfig.class)
@TestPropertySource(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "spring.liquibase.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:bulk_scope;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password="})
class WorkOrderBulkScopeIntegrationTest {
    @Configuration @EnableAutoConfiguration
    @EntityScan("com.grash.model") @EnableJpaRepositories("com.grash.repository")
    static class JpaConfig { }
    @Autowired EntityManager em;
    @Autowired WorkOrderRepository repository;
    WorkOrderService service;
    Company company;
    Customer selected, other;
    Date start = Date.from(Instant.parse("2026-10-01T03:00:00Z"));
    Date end = Date.from(Instant.parse("2026-11-01T03:00:00Z"));

    @BeforeEach void fixtures() {
        service = mock(WorkOrderService.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "workOrderRepository", repository);
        company = company("QA selected company");
        selected = customer(company, "QA selected customer");
        other = customer(company, "QA other customer");
    }
    Company company(String name) { Company c = new Company(); c.setName(name); c.setCreatedAt(start); c.setUpdatedAt(start); em.persist(c); return c; }
    Customer customer(Company c, String name) {
        Customer customer = new Customer(); customer.setCompany(c); customer.setName(name);
        customer.setCreatedAt(start); customer.setUpdatedAt(start); em.persist(customer); return customer;
    }
    WorkOrder order(Company c, List<Customer> customers, Status status, Date date) {
        WorkOrder wo = new WorkOrder(); wo.setCompany(c); wo.setCustomers(new ArrayList<>(customers));
        wo.setTitle("QA " + status); wo.setStatus(status); wo.setCreatedAt(date); wo.setUpdatedAt(date); em.persist(wo); em.flush();
        // Fix audit dates after persist so boundary assertions do not depend on auditing listeners.
        em.createNativeQuery("UPDATE work_order SET created_at=:date, completed_on=:completed, check_in_at=:checkin WHERE id=:id")
                .setParameter("date", date).setParameter("completed", status == Status.COMPLETE ? date : null)
                .setParameter("checkin", status == Status.OPEN ? null : date).setParameter("id", wo.getId()).executeUpdate();
        em.refresh(wo); return wo;
    }
    List<WorkOrder> search(WorkOrderBulkReportScope scope, WorkOrderOperationalReportPeriodField field) {
        em.flush();
        return service.findByCustomersAndPeriod(List.of(selected.getId()), field, start, end, company.getId(), scope);
    }
    @Test void defaultKeepsCompletedOnlyAndAllIncludesEveryStatusButNotOtherCustomerOrCompany() {
        Set<Long> expected = new HashSet<>();
        for (Status status : Status.values()) expected.add(order(company, List.of(selected), status, start).getId());
        order(company, List.of(other), Status.OPEN, start);
        Company foreign = company("QA foreign");
        order(foreign, List.of(selected), Status.COMPLETE, start);
        var all = search(WorkOrderBulkReportScope.ALL, WorkOrderOperationalReportPeriodField.CREATED_AT);
        assertEquals(expected, new HashSet<>(all.stream().map(WorkOrder::getId).toList()));
        var completed = service.findCompletedByCustomersAndPeriod(List.of(selected.getId()),
                WorkOrderOperationalReportPeriodField.COMPLETED_ON, start, end, company.getId());
        assertEquals(1, completed.size()); assertEquals(Status.COMPLETE, completed.get(0).getStatus());
    }
    @Test void includesStartAndLastDayButExcludesNextDayAndPreviousInstant() {
        var first = order(company, List.of(selected, other), Status.OPEN, start);
        var last = order(company, List.of(selected), Status.IN_PROGRESS, new Date(end.getTime()-1));
        order(company, List.of(selected), Status.COMPLETE, end);
        order(company, List.of(selected), Status.COMPLETE, new Date(start.getTime()-1));
        assertEquals(Set.of(first.getId(), last.getId()), new HashSet<>(
                search(WorkOrderBulkReportScope.ALL, WorkOrderOperationalReportPeriodField.CREATED_AT).stream().map(WorkOrder::getId).toList()));
    }
    @Test void checkinFilterExcludesOrdersWithoutCheckinEvenInAllMode() {
        order(company, List.of(selected), Status.OPEN, start);
        var checked = order(company, List.of(selected), Status.IN_PROGRESS, start);
        assertEquals(List.of(checked.getId()), search(WorkOrderBulkReportScope.ALL,
                WorkOrderOperationalReportPeriodField.CHECK_IN_AT).stream().map(WorkOrder::getId).toList());
    }
    @Test void rejectsAllWithCompletionPeriodAtServiceBoundary() {
        assertThrows(com.grash.exception.CustomException.class, () -> search(
                WorkOrderBulkReportScope.ALL, WorkOrderOperationalReportPeriodField.COMPLETED_ON));
    }
    @Test void validatesMissingDatesReversedDatesNullFieldsAndLegacyDefault() throws Exception {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var dto = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().readValue(
                    "{\"customerId\":1,\"start\":\"2026-10-01\",\"end\":\"2026-10-31\"}", WorkOrderBulkReportRequestDTO.class);
            assertEquals(WorkOrderBulkReportScope.COMPLETED, dto.getScope());
            assertTrue(validator.validate(dto).isEmpty());
            dto.setScope(WorkOrderBulkReportScope.ALL); assertFalse(validator.validate(dto).isEmpty());
            dto.setPeriodField(WorkOrderOperationalReportPeriodField.CREATED_AT); assertTrue(validator.validate(dto).isEmpty());
            dto.setEnd(dto.getStart().minusDays(1)); assertFalse(validator.validate(dto).isEmpty());
            dto.setEnd(dto.getStart()); assertTrue(validator.validate(dto).isEmpty());
            dto.setScope(null); assertFalse(validator.validate(dto).isEmpty());
            dto.setScope(WorkOrderBulkReportScope.COMPLETED); dto.setPeriodField(null); assertFalse(validator.validate(dto).isEmpty());
            dto.setPeriodField(WorkOrderOperationalReportPeriodField.CREATED_AT); dto.setStart(null); assertFalse(validator.validate(dto).isEmpty());
        }
    }
}
