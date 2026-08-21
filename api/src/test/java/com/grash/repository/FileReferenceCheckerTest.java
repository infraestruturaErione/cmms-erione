package com.grash.repository;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileReferenceCheckerTest {
    private JdbcTemplate jdbcTemplate;
    private FileReferenceChecker checker;

    @BeforeEach
    void setUp() {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:file-references-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        jdbcTemplate = new JdbcTemplate(dataSource);
        checker = new FileReferenceChecker(jdbcTemplate);

        jdbcTemplate.execute("create table \"file\" (\"id\" bigint primary key)");
        jdbcTemplate.execute("create table \"comment_files\" (\"comment_id\" bigint not null, " +
                "\"files_id\" bigint references \"file\"(\"id\"))");
        jdbcTemplate.execute("create table \"asset\" (\"id\" bigint primary key, " +
                "\"image_id\" bigint references \"file\"(\"id\"))");
        jdbcTemplate.update("insert into \"file\" (\"id\") values (?), (?), (?)", 10L, 11L, 12L);
    }

    @Test
    void unreferencedFileIsReportedAsUnused() {
        assertFalse(checker.isReferenced(10L));
    }

    @Test
    void commentCreatedButResponseLostStillKeepsItsFiles() {
        jdbcTemplate.update("insert into \"comment_files\" (\"comment_id\", \"files_id\") values (?, ?)",
                100L, 11L);

        assertTrue(checker.isReferenced(11L));
    }

    @Test
    void nonCommentEntityAssociationIsAlsoDiscovered() {
        jdbcTemplate.update("insert into \"asset\" (\"id\", \"image_id\") values (?, ?)", 200L, 12L);

        assertTrue(checker.isReferenced(12L));
    }
}
