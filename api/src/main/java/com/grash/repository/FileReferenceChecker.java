package com.grash.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Checks every database foreign key that points to {@code file.id}.
 *
 * <p>The File entity does not expose reverse mappings for all usages (for
 * example Comment files, company logos and legacy audit columns). Database
 * metadata is therefore the authoritative, fail-closed source for deciding
 * whether a File is unused.</p>
 */
@Repository
@RequiredArgsConstructor
public class FileReferenceChecker {
    private final JdbcTemplate jdbcTemplate;

    public boolean isReferenced(Long fileId) {
        return Boolean.TRUE.equals(jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            DatabaseMetaData metadata = connection.getMetaData();
            TableIdentifier fileTable = findFileTable(metadata, connection.getCatalog(), connection.getSchema());
            Set<ForeignKeyReference> references = findExportedKeys(metadata, fileTable);

            for (ForeignKeyReference reference : references) {
                String sql = "select 1 from " + qualifiedName(metadata, reference.schema(), reference.table())
                        + " where " + quoted(metadata, reference.column()) + " = ?";
                try (PreparedStatement statement = connection.prepareStatement(sql)) {
                    statement.setLong(1, fileId);
                    statement.setMaxRows(1);
                    try (ResultSet resultSet = statement.executeQuery()) {
                        if (resultSet.next()) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }));
    }

    private TableIdentifier findFileTable(DatabaseMetaData metadata, String catalog, String currentSchema)
            throws SQLException {
        TableIdentifier fallback = null;
        try (ResultSet tables = metadata.getTables(catalog, null, null, new String[]{"TABLE"})) {
            while (tables.next()) {
                String tableName = tables.getString("TABLE_NAME");
                if (!"file".equalsIgnoreCase(tableName)) {
                    continue;
                }
                TableIdentifier candidate = new TableIdentifier(
                        tables.getString("TABLE_CAT"), tables.getString("TABLE_SCHEM"), tableName);
                if (currentSchema != null && currentSchema.equalsIgnoreCase(candidate.schema())) {
                    return candidate;
                }
                fallback = candidate;
            }
        }
        if (fallback == null) {
            throw new IllegalStateException("Could not inspect File references");
        }
        return fallback;
    }

    private Set<ForeignKeyReference> findExportedKeys(DatabaseMetaData metadata, TableIdentifier fileTable)
            throws SQLException {
        Set<ForeignKeyReference> references = new LinkedHashSet<>();
        try (ResultSet keys = metadata.getExportedKeys(fileTable.catalog(), fileTable.schema(), fileTable.table())) {
            while (keys.next()) {
                references.add(new ForeignKeyReference(
                        keys.getString("FKTABLE_SCHEM"),
                        keys.getString("FKTABLE_NAME"),
                        keys.getString("FKCOLUMN_NAME")));
            }
        }
        return references;
    }

    private String qualifiedName(DatabaseMetaData metadata, String schema, String table) throws SQLException {
        if (schema == null || schema.isBlank()) {
            return quoted(metadata, table);
        }
        return quoted(metadata, schema) + "." + quoted(metadata, table);
    }

    private String quoted(DatabaseMetaData metadata, String identifier) throws SQLException {
        String quote = metadata.getIdentifierQuoteString();
        if (quote == null || quote.isBlank()) {
            return identifier;
        }
        return quote + identifier.replace(quote, quote + quote) + quote;
    }

    private record TableIdentifier(String catalog, String schema, String table) {
    }

    private record ForeignKeyReference(String schema, String table, String column) {
    }
}
