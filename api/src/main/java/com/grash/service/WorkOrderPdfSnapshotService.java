package com.grash.service;

import com.grash.model.File;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.FileType;
import com.grash.utils.Helper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring5.SpringTemplateEngine;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkOrderPdfSnapshotService {
    // Bump when renderer/optimizer semantics change without a template/resource change.
    private static final String RENDERER_VERSION = "individual-pdf-v1";
    private final WorkOrderReportService reports;
    private final SpringTemplateEngine templates;

    public Snapshot capture(WorkOrder workOrder, User user) {
        Map<String, File> files = new LinkedHashMap<>();
        Map<String, Object> variables = new HashMap<>(reports.buildCompanyReportVariables(user));
        variables.putAll(reports.buildWorkOrderReportVariables(workOrder, file -> {
            String identity = file.getId() + "\n" + file.getPath() + "\n" + file.getType()
                    + "\n" + file.getName() + "\n" + (file.getUpdatedAt() == null ? "" : file.getUpdatedAt().getTime());
            String marker = "urn:erione-pdf-file:" + sha256(identity);
            files.put(marker, file);
            return marker;
        }));
        String html = html(variables, user);
        String fingerprint = sha256(RENDERER_VERSION + "\n" + resourceVersion() + "\n"
                + Helper.getLocale(user).toLanguageTag() + "\n" + variables.get("timeZone")
                + "\n" + variables.get("dateFormat") + "\n" + html);
        return new Snapshot(fingerprint, html, Map.copyOf(files));
    }

    public Rendered render(Snapshot snapshot, WorkOrder workOrder, User user, StorageService storage) {
        String html = snapshot.html();
        for (Map.Entry<String, File> entry : snapshot.files().entrySet()) {
            File file = entry.getValue();
            String source = file.getType() == FileType.IMAGE
                    ? reports.imageDataUri(file, storage) : storage.generateSignedUrl(file, 5);
            if (source == null) {
                // Retain existing best-effort rendering, but never cache a report missing an image.
                Map<String, Object> variables = new HashMap<>(reports.buildCompanyReportVariables(user));
                variables.putAll(reports.buildWorkOrderReportVariables(workOrder, storage));
                return new Rendered(reports.renderPdf(html(variables, user)), false);
            }
            html = html.replace(entry.getKey(), HtmlUtils.htmlEscape(source, "UTF-8"));
        }
        return new Rendered(reports.renderPdf(html), true);
    }

    private String html(Map<String, Object> variables, User user) {
        Context context = new Context(Helper.getLocale(user));
        context.setVariables(variables);
        return templates.process("work-order-report.html", context);
    }

    private String resourceVersion() {
        StringBuilder version = new StringBuilder();
        for (String path : new String[]{"templates/work-order-report.html",
                "templates/fragments/work-order-report-body.html",
                "templates/fragments/work-order-report-styles.html", "static/images/erione-brand-logo.png",
                "fonts/Roboto-Regular.ttf", "fonts/Roboto-Bold.ttf"}) {
            try (var input = new ClassPathResource(path).getInputStream()) {
                version.append(HexFormat.of().formatHex(digest(input.readAllBytes())));
            } catch (IOException e) {
                throw new IllegalStateException("Missing PDF resource: " + path, e);
            }
        }
        return sha256(version.toString());
    }

    static String sha256(String text) {
        return HexFormat.of().formatHex(digest(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static byte[] digest(byte[] bytes) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public record Snapshot(String fingerprint, String html, Map<String, File> files) { }
    public record Rendered(byte[] bytes, boolean cacheable) { }
}
