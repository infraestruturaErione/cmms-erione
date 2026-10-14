package com.grash.service;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class WorkOrderExecutionMigrationTest {
    @Test
    void newMigrationPreservesLegacyRowsWithNullableOwnerAndAuditColumns() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID(), "sa", "")) {
            var sql = connection.createStatement();
            sql.execute("CREATE TABLE own_user (id BIGINT PRIMARY KEY)");
            sql.execute("CREATE TABLE work_order (id BIGINT PRIMARY KEY, title VARCHAR(255))");
            sql.execute("CREATE TABLE work_order_aud (id BIGINT, rev BIGINT)");
            sql.execute("INSERT INTO work_order (id, title) VALUES (10, 'Legacy OS')");
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            var migration = new Liquibase("db/changelog/2026_10_14_00000000001_workorder_execution_owner.xml",
                    new ClassLoaderResourceAccessor(), database);
            migration.update(new Contexts(), new LabelExpression());
            var row = sql.executeQuery("SELECT title, execution_owner_id, execution_claimed_at, completed_assigned_user_names FROM work_order WHERE id=10");
            assertTrue(row.next()); assertEquals("Legacy OS", row.getString(1));
            assertNull(row.getObject(2)); assertNull(row.getObject(3)); assertNull(row.getObject(4));
            assertFalse(row.next());
            sql.executeQuery("SELECT execution_owner_id, execution_claimed_at, execution_owner_mod, execution_claimed_at_mod FROM work_order_aud");
            assertThrows(java.sql.SQLException.class, () -> sql.execute("INSERT INTO work_order (id, execution_owner_id) VALUES (20, 9999)"));
        }
    }
}
