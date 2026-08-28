package com.grash.service;

import com.grash.model.Comment;
import com.grash.model.Company;
import com.grash.model.Customer;
import com.grash.model.File;
import com.grash.model.Location;
import com.grash.model.Task;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.FileType;
import com.grash.repository.CommentRepository;
import com.grash.utils.Helper;
import com.grash.utils.Utils;
import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import com.itextpdf.layout.font.FontProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URLConnection;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// Prepara as variaveis usadas pelo template Thymeleaf do PDF de OS
// (fragments/work-order-report-body.html) - usado tanto pelo relatorio
// individual quanto pelo em massa (WorkOrderController), um bloco por OS. A
// reutilizacao do LAYOUT em si acontece no template (th:replace do MESMO
// fragmento), nao aqui - esta classe so' prepara dados, nao renderiza HTML.
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkOrderReportService {
    private static final String FIELD_REPORT_PREFIX = "[Relato em campo]";
    private static final List<String> PHOTO_ONLY_FIELD_REPORT_TEXTS = List.of(
            "Photo evidence registered.",
            "Evidencia fotografica registrada.",
            "Evidência fotográfica registrada.",
            "EvidÃªncia fotogrÃ¡fica registrada."
    );

    private final TaskService taskService;
    private final CommentRepository commentRepository;
    private final MessageSource messageSource;
    private final Utils utils;

    // Logo oficial da Erione (marca "EI", de frontend/public/static/images/
    // logo/logo.png - mesmo arquivo usado no header/login da Web, copiado
    // pra resources/static/images do backend porque o PDF e' gerado aqui).
    // Embutido como data URI (base64), carregado uma unica vez - mesma
    // razao da nota em addEvidenceItem: dentro do container, uma URL
    // relativa/HTTP pro proprio Tomcat nao e' garantida de resolver na hora
    // do HtmlConverter renderizar, entao evitamos qualquer resolucao de
    // rede pra um asset estatico e imutavel.
    private static final String ERIONE_LOGO_DATA_URI = loadErioneLogoDataUri();

    private static String loadErioneLogoDataUri() {
        try (InputStream in = new ClassPathResource("static/images/erione-brand-logo.png").getInputStream()) {
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(in.readAllBytes());
        } catch (IOException e) {
            return null;
        }
    }

    // !!! FIXTURE DE DEV - NAO E' IMPLEMENTACAO FINAL !!!
    // CNPJ institucional da Erione pedido no layout do cabecalho do PDF, mas
    // NAO existe nenhum campo pra isso em Company/CompanySettings hoje (so'
    // name/phone/email/address - confirmado de novo nesta rodada). Sem uma
    // fonte persistente real, este valor fixo e' usado APENAS pra
    // demonstrar visualmente como o layout fica com o campo preenchido.
    // Antes de qualquer entrega real, isso precisa virar um campo de
    // verdade em Company (migration) - nao adicionei essa migration porque
    // esta rodada e' so' visual/DEV e o usuario pediu pra ser avisado antes.
    private static final String DEV_FIXTURE_ERIONE_CNPJ_NAO_USAR_EM_PRODUCAO = "08.427.847/0001-56";

    // FontProvider com Roboto (resources/fonts, Apache 2.0) embutido
    // explicitamente - a fonte padrao dos 14 fonts base do PDF (Helvetica)
    // tem um bug reproduzido visualmente gerando PDFs reais em DEV: toda
    // transicao de uma letra MAIUSCULA pra minuscula ("P" -> "refeitura")
    // ganhava um espaco extra indevido (kerning pair ausente/quebrado na
    // tabela de metricas AFM usada pelo html2pdf nesse container). Trocar
    // pra uma fonte TrueType real embutida (com sua propria tabela de
    // kerning completa) elimina o problema, ja que deixa de depender da
    // resolucao de fontes base-14/do sistema operacional do container
    // (Alpine, sem fontconfig). CSS usa font-family: Roboto (ver
    // fragments/work-order-report-styles.html).
    private static final String[] FONT_RESOURCES = {
            "fonts/Roboto-Regular.ttf",
            "fonts/Roboto-Bold.ttf"
    };

    private ConverterProperties newConverterProperties() {
        FontProvider fontProvider = new FontProvider();
        fontProvider.addStandardPdfFonts();
        for (String resource : FONT_RESOURCES) {
            try (InputStream in = new ClassPathResource(resource).getInputStream()) {
                fontProvider.addFont(in.readAllBytes());
            } catch (IOException e) {
                log.error("Falha ao carregar fonte do PDF de OS: {}", resource, e);
            }
        }
        return new ConverterProperties().setFontProvider(fontProvider);
    }

    // Unico ponto que chama HtmlConverter.convertToPdf - usado tanto pelo
    // relatorio individual quanto pelo em massa, pra garantir que os dois
    // sempre usem a MESMA configuracao de fontes.
    public byte[] renderPdf(String html) {
        ByteArrayOutputStream target = new ByteArrayOutputStream();
        HtmlConverter.convertToPdf(html, target, newConverterProperties());
        return target.toByteArray();
    }

    // Variaveis de nivel de EMPRESA - iguais pra toda OS do mesmo usuario,
    // entao so' precisam ser calculadas uma vez (individual e em massa).
    public Map<String, Object> buildCompanyReportVariables(User user) {
        Company company = user.getCompany();
        Map<String, Object> variables = new HashMap<>();
        variables.put("companyName", company.getName());
        variables.put("companyPhone", company.getPhone());
        variables.put("companyEmail", company.getEmail());
        variables.put("companyAddress", company.getAddress());
        variables.put("erioneLogoDataUri", ERIONE_LOGO_DATA_URI);
        variables.put("companyCnpj", DEV_FIXTURE_ERIONE_CNPJ_NAO_USAR_EM_PRODUCAO);
        variables.put("dateFormat", company.getCompanySettings().getGeneralPreferences().getDateFormat());
        variables.put("timeZone", company.getCompanySettings().getGeneralPreferences().getTimeZone());
        variables.put("messageSource", messageSource);
        variables.put("locale", Helper.getLocale(user));
        variables.put("utils", utils);
        return variables;
    }

    // Variaveis especificas de UMA OS - um bloco por OS no relatorio em
    // massa, exatamente as mesmas usadas no relatorio individual (nenhuma
    // logica duplicada entre os dois fluxos).
    public Map<String, Object> buildWorkOrderReportVariables(WorkOrder workOrder, StorageService storageService) {
        Long id = workOrder.getId();
        List<Task> tasks = taskService.findByWorkOrder(id);
        Map<Long, String[]> tasksImagesUrls = tasks.stream()
                .collect(Collectors.toMap(
                        Task::getId,
                        task -> task.getImages().stream()
                                .map(image -> storageService.generateSignedUrl(image, 5))
                                .toArray(String[]::new)
                ));
        List<Comment> fieldComments = commentRepository
                .findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(List.of(id), FIELD_REPORT_PREFIX);
        List<String> fieldReports = fieldComments.stream()
                .map(comment -> getRealFieldReportText(comment.getContent()))
                .filter(Objects::nonNull)
                .filter(fieldReport -> !fieldReport.isBlank())
                .collect(Collectors.toList());
        List<Map<String, Object>> fieldEvidenceItems = buildFieldEvidenceItems(workOrder, fieldComments, storageService);

        Location location = workOrder.getLocation();
        List<Customer> customers = workOrder.getCustomers();
        // CNPJ/e-mail/telefone/endereco do cliente so' sao exibidos quando ha'
        // exatamente 1 Cliente na OS - com varios Clientes nao ha' um valor
        // unico e correto pra mostrar (Customer.email/phone/address vem de
        // BasicInfos, o mesmo dado ja usado em Clientes/Cidades na Web).
        Customer singleCustomer = customers != null && customers.size() == 1 ? customers.get(0) : null;

        Map<String, Object> variables = new HashMap<>();
        variables.put("customers", Helper.enumerate(customers.stream().map(Customer::getName).collect(Collectors.toList())));
        variables.put("customerCnpj", blankToNull(singleCustomer == null ? null : singleCustomer.getCnpj()));
        variables.put("customerEmail", blankToNull(singleCustomer == null ? null : singleCustomer.getEmail()));
        variables.put("customerPhone", blankToNull(singleCustomer == null ? null : singleCustomer.getPhone()));
        variables.put("customerAddress", blankToNull(singleCustomer == null ? null : singleCustomer.getAddress()));
        variables.put("workOrder", workOrder);
        variables.put("primaryUserName", workOrder.getPrimaryUser() == null ? null :
                workOrder.getPrimaryUser().getFullName());
        // "Servico" da secao Informacoes da tarefa - categoria quando existe;
        // como Erione nem sempre tem a OS categorizada, cai pro titulo da OS
        // (sempre presente) em vez de deixar essa linha vazia.
        variables.put("serviceLabel", workOrder.getCategory() != null ? workOrder.getCategory().getName() : workOrder.getTitle());
        variables.put("tasks", tasks);
        variables.put("tasksImagesUrls", tasksImagesUrls);
        variables.put("fieldReports", fieldReports);
        variables.put("fieldEvidenceRows", chunk(fieldEvidenceItems, evidenceColumnsFor(fieldEvidenceItems.size())));
        variables.put("fieldEvidenceCount", fieldEvidenceItems.size());
        variables.put("locationIdentification", location == null ? null : locationIdentification(location));
        variables.put("locationAddressWithReference", location == null ? null : locationAddressWithReference(location));
        variables.put("checkInDistanceLabel", location == null ? null :
                distanceLabel(location.getLatitude(), location.getLongitude(), workOrder.getCheckInLat(), workOrder.getCheckInLng()));
        variables.put("checkOutDistanceLabel", location == null ? null :
                distanceLabel(location.getLatitude(), location.getLongitude(), workOrder.getCheckOutLat(), workOrder.getCheckOutLng()));
        variables.put("siteDurationLabel", durationLabel(workOrder.getCheckInAt(), workOrder.getCheckOutAt()));
        // "Duracao do deslocamento" - mesma regra ja' oficial do frontend
        // (fieldExecutionRules.ts, duration "travel": departureAt -> checkInAt),
        // so' espelhada aqui pelo mesmo motivo do siteDurationLabel acima.
        variables.put("travelDurationLabel", durationLabel(workOrder.getDepartureAt(), workOrder.getCheckInAt()));
        return variables;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    // Fotos em grade - HTML/CSS de tabela nao quebra celulas de uma <tr>
    // sozinho, precisa vir ja' agrupado em linhas daqui, senao o html2pdf
    // simplesmente cortava a(s) celula(s) que excediam a largura da pagina
    // (reproduzido: a 4a foto de uma OS de teste sumia do PDF sem aviso, nao
    // ia pra pagina seguinte). Numero de colunas varia com a quantidade de
    // fotos pra cada slot ficar num tamanho visual razoavel (1 foto sozinha
    // nao fica minuscula numa grade de 3, e 4 fotos formam um 2x2 em vez de
    // "3 grandes + 1 esticada"): 1->1 coluna, 2->2, 3->3, 4->2 (2x2), 5+->3
    // (chunk natural: 5 vira 3+2, 6 vira 3+3, 7 vira 3+3+1, etc).
    private static int evidenceColumnsFor(int count) {
        switch (count) {
            case 0:
            case 1:
                return 1;
            case 2:
                return 2;
            case 3:
                return 3;
            case 4:
                return 2;
            default:
                return 3;
        }
    }

    private static <T> List<List<T>> chunk(List<T> items, int columns) {
        List<List<T>> rows = new ArrayList<>();
        for (int i = 0; i < items.size(); i += columns) {
            rows.add(items.subList(i, Math.min(i + columns, items.size())));
        }
        return rows;
    }

    private String stripFieldReportPrefix(String content) {
        if (content == null || !content.startsWith(FIELD_REPORT_PREFIX)) {
            return null;
        }
        return content.substring(FIELD_REPORT_PREFIX.length()).trim();
    }

    private String getRealFieldReportText(String content) {
        String text = stripFieldReportPrefix(content);
        if (text == null || PHOTO_ONLY_FIELD_REPORT_TEXTS.contains(text)) {
            return null;
        }
        return text;
    }

    private List<Map<String, Object>> buildFieldEvidenceItems(WorkOrder workOrder, List<Comment> fieldComments,
                                                               StorageService storageService) {
        List<Map<String, Object>> items = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (workOrder.getImage() != null) {
            addEvidenceItem(items, seen, workOrder.getImage(), "OS", null, storageService);
        }
        if (workOrder.getFiles() != null) {
            workOrder.getFiles().forEach(file -> addEvidenceItem(items, seen, file, "OS", null, storageService));
        }
        fieldComments.forEach(comment -> {
            if (comment.getFiles() != null) {
                // getRealFieldReportText (nao stripFieldReportPrefix cru) - descarta o
                // texto padrao que o app movel grava quando o relato e' so' a foto
                // ("Evidencia fotografica registrada."), pra nao repetir essa legenda
                // generica em cada foto sem valor real pro cliente.
                String note = getRealFieldReportText(comment.getContent());
                comment.getFiles().forEach(file -> addEvidenceItem(items, seen, file, "Relato em campo", note,
                        storageService));
            }
        });
        return items;
    }

    private void addEvidenceItem(List<Map<String, Object>> items, Set<String> seen, File file, String source,
                                 String note, StorageService storageService) {
        String key = file.getId() == null ? file.getPath() : file.getId().toString();
        if (key == null || seen.contains(key)) {
            return;
        }
        seen.add(key);
        Map<String, Object> item = new HashMap<>();
        item.put("name", file.getName());
        item.put("type", file.getType());
        boolean isImage = file.getType() == FileType.IMAGE;
        // O PDF e' montado com HtmlConverter.convertToPdf DENTRO do container da API.
        // Uma URL assinada do MinIO (localhost:9000) so' funciona pro navegador do
        // usuario - de dentro do proprio container, "localhost" e' o container, nao
        // o MinIO, entao a imagem falhava silenciosamente (texto aparecia, foto nao).
        // Baixando os bytes e embutindo como data URI (mesmo esquema ja usado pra
        // workOrder.signature) elimina esse fetch de rede na hora de gerar o PDF.
        String url = null;
        if (isImage) {
            try {
                byte[] bytes = storageService.download(file.getPath());
                String mimeType = Optional.ofNullable(URLConnection.guessContentTypeFromName(file.getName()))
                        .orElse("image/jpeg");
                url = "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(bytes);
            } catch (Exception ignored) {
                isImage = false;
            }
        }
        item.put("image", isImage);
        item.put("source", source);
        item.put("note", note);
        item.put("url", url);
        items.add(item);
    }

    // ===== Referencia Operacional (ID/PC) da Location no PDF =====
    // Espelha EXATAMENTE frontend/src/utils/locationDisplay.ts (mesma regra
    // de negocio, so' que aqui porque o Thymeleaf/PDF e' renderizado no
    // backend e nao pode chamar a funcao TypeScript da Web). Qualquer ajuste
    // na regra precisa ser replicado nos dois lugares.
    private static final Pattern LEGACY_ID_PREFIX = Pattern.compile(
            "^\\s*ID[\\s:.\\-]{0,3}(\\d{1,10})\\b\\s*[-–—:]?\\s*", Pattern.CASE_INSENSITIVE);

    private static String matchedLegacyPrefix(String value) {
        if (value == null) return null;
        Matcher matcher = LEGACY_ID_PREFIX.matcher(value);
        return matcher.find() ? matcher.group() : null;
    }

    // Location.name sem o prefixo "ID N - " legado, quando presente.
    static String locationIdentification(Location location) {
        String name = location.getName() == null ? "" : location.getName().trim();
        String prefixMatch = matchedLegacyPrefix(name);
        if (prefixMatch == null) return name;
        String rest = name.substring(prefixMatch.length()).trim();
        return rest.isEmpty() ? name : rest;
    }

    // Location.address evitando duplicacao visual quando o proprio address ja
    // carrega o prefixo "ID N - " e/ou repete o texto de identificacao.
    static String locationDisplayAddress(Location location) {
        String address = location.getAddress() == null ? "" : location.getAddress().trim();
        if (address.isEmpty()) return address;

        String prefixMatch = matchedLegacyPrefix(address);
        String withoutIdPrefix = prefixMatch == null ? address : address.substring(prefixMatch.length()).trim();
        if (withoutIdPrefix.isEmpty()) return address;

        String identification = locationIdentification(location);
        if (!identification.isEmpty()) {
            String normalizedRest = withoutIdPrefix.toLowerCase();
            String normalizedIdentification = identification.toLowerCase();
            if (normalizedRest.startsWith(normalizedIdentification)) {
                String afterIdentification = withoutIdPrefix.substring(identification.length())
                        .replaceFirst("^\\s*[-–—:]\\s*", "").trim();
                if (!afterIdentification.isEmpty()) return afterIdentification;
            }
        }
        return withoutIdPrefix;
    }

    // "ID 1019 - <endereco>" / "PC 04 - <endereco>" / so' o endereco quando
    // nao ha' referencia valida (type e code, ambos presentes - mesma
    // invariante do LocationService).
    static String locationAddressWithReference(Location location) {
        String address = locationDisplayAddress(location);
        String type = location.getReferenceType() == null ? null : location.getReferenceType().name();
        String code = location.getReferenceCode() == null ? null : location.getReferenceCode().trim();
        if (type == null || code == null || code.isEmpty()) return address;
        String prefix = type + " " + code;
        return address.isEmpty() ? prefix : prefix + " - " + address;
    }

    // ===== Distancia/duracao no check-in e check-out =====
    // Espelha EXATAMENTE frontend/src/content/own/WorkOrders/fieldExecutionRules.ts
    // (getDistanceInMeters/formatDistanceLabel/formatDurationSeconds) - mesma
    // formula, mesmo arredondamento, pelo mesmo motivo do bloco acima.
    private static final double EARTH_RADIUS_METERS = 6371000;

    static String distanceLabel(Double lat1, Double lng1, BigDecimal lat2, BigDecimal lng2) {
        if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
        double la1 = Math.toRadians(lat1);
        double la2 = Math.toRadians(lat2.doubleValue());
        double dLat = Math.toRadians(lat2.doubleValue() - lat1);
        double dLng = Math.toRadians(lng2.doubleValue() - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(la1) * Math.cos(la2) * Math.pow(Math.sin(dLng / 2), 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        long roundedMeters = Math.round(EARTH_RADIUS_METERS * c);
        return roundedMeters >= 1000
                ? String.format(Locale.ROOT, "%.1f km", roundedMeters / 1000.0)
                : roundedMeters + " m";
    }

    static String durationLabel(Date start, Date end) {
        if (start == null || end == null) return null;
        long seconds = (end.getTime() - start.getTime()) / 1000;
        if (seconds < 0) return null;
        if (seconds < 60) return "menos de 1 min";
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        if (hours > 0 && minutes > 0) return hours + "h " + minutes + "min";
        if (hours > 0) return hours + "h";
        return minutes + "min";
    }
}
