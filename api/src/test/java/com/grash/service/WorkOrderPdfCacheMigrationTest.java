package com.grash.service;

import liquibase.*;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class WorkOrderPdfCacheMigrationTest {
    @Test
    void additiveMigrationPreservesOrdersAndEnforcesContentUniqueness() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID(), "sa", "")) {
            var sql = connection.createStatement();
            sql.execute("CREATE TABLE work_order(id BIGINT PRIMARY KEY,title VARCHAR(255))");
            sql.execute("INSERT INTO work_order VALUES(10,'Legacy OS')");
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            var migration = new Liquibase("db/changelog/2026_10_22_00000000001_work_order_pdf_cache.xml",
                    new ClassLoaderResourceAccessor(), database);
            migration.update(new Contexts(), new LabelExpression());
            migration.update(new Contexts(), new LabelExpression());
            var row = sql.executeQuery("SELECT title FROM work_order WHERE id=10");
            assertTrue(row.next()); assertEquals("Legacy OS", row.getString(1));
            sql.execute("INSERT INTO work_order_pdf_cache VALUES(1,10,'hash','reports/1/individual-cache/10/a.pdf',CURRENT_TIMESTAMP)");
            assertThrows(java.sql.SQLException.class, () -> sql.execute("INSERT INTO work_order_pdf_cache VALUES(1,10,'hash','duplicate',CURRENT_TIMESTAMP)"));
            sql.execute("INSERT INTO work_order_pdf_cache VALUES(2,10,'hash','other-company',CURRENT_TIMESTAMP)");
        }
    }
}
