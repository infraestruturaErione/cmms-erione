package com.grash.repository;

import com.grash.model.Company;
import com.grash.model.File;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ContextConfiguration(classes = FileRepositoryCleanupIntegrationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class FileRepositoryCleanupIntegrationTest {
    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    static class TestJpaConfig {
    }

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private FileRepository fileRepository;

    @Test
    void cleanupCandidateRequiresBothTenantAndUploader() {
        Company company = new Company();
        company.setName("Company A");
        stampDates(company);
        entityManager.persist(company);

        File file = new File();
        file.setName("evidence.jpg");
        file.setPath("company-a/evidence.jpg");
        file.setCompany(company);
        file.setCreatedBy(20L);
        stampDates(file);
        entityManager.persist(file);
        entityManager.flush();
        entityManager.clear();

        assertTrue(fileRepository.findCleanupCandidate(file.getId(), company.getId(), 20L).isPresent());
        assertTrue(fileRepository.findCleanupCandidate(file.getId(), company.getId() + 1, 20L).isEmpty());
        assertTrue(fileRepository.findCleanupCandidate(file.getId(), company.getId(), 21L).isEmpty());
    }

    private void stampDates(com.grash.model.abstracts.DateAudit entity) {
        Date now = new Date();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
    }
}
