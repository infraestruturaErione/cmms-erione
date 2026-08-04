package com.grash.controller;


import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.FilePatchDTO;
import com.grash.dto.FileShowDTO;
import com.grash.dto.SuccessResponse;
import com.grash.dto.license.LicenseEntitlement;
import com.grash.exception.CustomException;
import com.grash.factory.StorageServiceFactory;
import com.grash.mapper.FileMapper;
import com.grash.model.File;
import com.grash.model.User;
import com.grash.model.RequestPortal;
import com.grash.model.Task;
import com.grash.model.enums.*;
import com.grash.service.FileService;
import com.grash.service.LicenseService;
import com.grash.service.RateLimiterService;
import com.grash.service.RequestPortalService;
import com.grash.service.TaskService;
import com.grash.service.UserService;
import com.grash.utils.Helper;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.*;
import java.util.stream.Collectors;


@RestController
@Tag(name = "Files", description = "Operations on files")
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {
    private final StorageServiceFactory storageServiceFactory;
    private final FileService fileService;
    private final UserService userService;
    private final TaskService taskService;
    private final FileMapper fileMapper;
    private final LicenseService licenseService;
    private final RequestPortalService requestPortalService;
    private final RateLimiterService rateLimiterService;

    @PostMapping(value = "/upload", produces = "application/json")
    public List<FileShowDTO> handleFileUpload(@Parameter(description = "Files to upload") @RequestParam("files") MultipartFile[] filesReq,
                                              @Parameter(description = "Folder path to store files") @RequestParam(
                                                      "folder") String folder,
                                              @Parameter(description = "Whether files should be hidden (true/false)") @RequestParam("hidden") String hidden, HttpServletRequest req,
                                              @Parameter(description = "Type of file") @RequestParam("type") FileType fileType,
                                              @Parameter(description = "Optional task ID to associate files with") @RequestParam(value = "taskId", required = false) Integer taskId) {
        if (!licenseService.hasEntitlement(LicenseEntitlement.FILE_ATTACHMENTS))
            throw new CustomException("You need a license to add a file", HttpStatus.FORBIDDEN);
        User user = userService.whoami(req);
        if (user.getRole().getCreatePermissions().contains(PermissionEntity.FILES) &&
                user.getCompany().getSubscription().getSubscriptionPlan().getFeatures().contains(PlanFeatures.FILE)) {
            // Valida todos os arquivos ANTES de enviar qualquer um: evita que um
            // arquivo invalido no meio do lote deixe os anteriores ja enviados
            // orfaos no banco/storage (sem serem retornados pro cliente).
            Arrays.asList(filesReq).forEach(fileReq -> validateFileForUpload(fileReq, fileType));

            Collection<File> result = new ArrayList<>();
            Arrays.asList(filesReq).forEach(fileReq -> {
                String filePath = storageServiceFactory.getStorageService().upload(fileReq, folder);
                Task task = null;
                if (taskId != null) {
                    Optional<Task> optionalTask = taskService.findById(taskId.longValue());
                    if (optionalTask.isPresent()) {
                        task = optionalTask.get();
                    }
                }
                result.add(fileService.create(new File(fileReq.getOriginalFilename(), filePath, fileType, task,
                        hidden.equals("true"))));
            });
            return result.stream().map(fileMapper::toShowDto).collect(Collectors.toList());
        } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
    }

    private static final Map<String, byte[]> IMAGE_MAGIC_BYTES = new LinkedHashMap<String, byte[]>() {{
        put("JPEG", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});
        put("PNG", new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47});
        put("GIF", new byte[]{0x47, 0x49, 0x46, 0x38});
        put("BMP", new byte[]{0x42, 0x4D});
        put("WEBP_RIFF", new byte[]{0x52, 0x49, 0x46, 0x46});
    }};

    // Bloqueado pra QUALQUER tipo de upload (nao so IMAGE) - anexo administrativo
    // (type=OTHER) tambem passa por aqui e nao tinha nenhuma validacao de
    // conteudo antes, so a de imagem. Extensao continua sendo o sinal mais
    // pratico pra executavel/script disfarcado; nao tentamos cobrir todo tipo
    // de documento legitimo (pdf, docx, xlsx, etc. continuam livres).
    private static final Set<String> DANGEROUS_EXTENSIONS = Set.of(
            "exe", "dll", "bat", "cmd", "com", "scr", "msi", "msp", "jar", "sh", "ps1", "psm1",
            "vbs", "vbe", "js", "jse", "wsf", "wsh", "app", "apk", "deb", "rpm", "gadget"
    );

    private void validateFileForUpload(MultipartFile fileReq, FileType fileType) {
        if (fileReq == null || fileReq.isEmpty()) {
            throw new CustomException("Arquivo vazio ou inválido: " + (fileReq == null ? "" :
                    fileReq.getOriginalFilename()), HttpStatus.BAD_REQUEST);
        }
        String originalName = fileReq.getOriginalFilename();
        String extension = originalName != null && originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase()
                : "";
        if (DANGEROUS_EXTENSIONS.contains(extension)) {
            throw new CustomException("Tipo de arquivo não permitido: \"" + originalName + "\".",
                    HttpStatus.BAD_REQUEST);
        }
        if (fileType == FileType.IMAGE) {
            byte[] header;
            try (java.io.InputStream inputStream = fileReq.getInputStream()) {
                header = inputStream.readNBytes(12);
            } catch (Exception e) {
                throw new CustomException("Não foi possível ler o arquivo: " + fileReq.getOriginalFilename(),
                        HttpStatus.BAD_REQUEST);
            }
            boolean matchesKnownImage = IMAGE_MAGIC_BYTES.values().stream()
                    .anyMatch(signature -> startsWith(header, signature));
            if (!matchesKnownImage) {
                throw new CustomException("O arquivo \"" + fileReq.getOriginalFilename() + "\" não é uma imagem " +
                        "válida.", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }

    @PostMapping(value = "/upload/request-portal/{uuid}", produces = "application/json")
    public ResponseEntity<List<FileShowDTO>> uploadToRequestPortal(@Parameter(description = "Request portal UUID") @PathVariable("uuid") String uuid,
                                                                   @Parameter(description = "Files to upload") @RequestParam("files") MultipartFile[] filesReq,
                                                                   @Parameter(description = "Type of file") @RequestParam("type") FileType fileType,
                                                                   HttpServletRequest req) {
        String clientIp = Helper.extractClientIp(req);
        if (!rateLimiterService.resolveFileUploadBucket(clientIp).tryConsume(1)) {
            throw new CustomException("Rate limit exceeded. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }

        RequestPortal requestPortal = requestPortalService.findByUuidByUser(uuid).orElseThrow(() -> new CustomException(
                "Request Portal not found", HttpStatus.NOT_FOUND));

        String folder = "company " + requestPortal.getCompany().getId() + "/request-portal/" + requestPortal.getUuid();

        Collection<File> result = new ArrayList<>();
        Arrays.asList(filesReq).forEach(fileReq -> {
            String filePath = storageServiceFactory.getStorageService().upload(fileReq, folder);
            File file = new File(fileReq.getOriginalFilename(), filePath, fileType, null, true);
            file.setCompany(requestPortal.getCompany());
            result.add(fileService.create(file));
        });
        List<FileShowDTO> response = result.stream().map(fileMapper::toShowDto).collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Page<FileShowDTO>> search(@Parameter(description = "Search criteria for filtering files") @RequestBody SearchCriteria searchCriteria,
                                                    HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (user.getRole().getViewPermissions().contains(PermissionEntity.FILES)) {
                searchCriteria.filterCompany(user);
                boolean canViewOthers = user.getRole().getViewOtherPermissions().contains(PermissionEntity.FILES);
                if (!canViewOthers) {
                    searchCriteria.filterCreatedBy(user);
                }
                searchCriteria.getFilterFields().add(FilterField.builder()
                        .field("hidden")
                        .value(false)
                        .operation("eq")
                        .values(new ArrayList<>())
                        .alternatives(new ArrayList<>()).build());
            } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
        }
        return ResponseEntity.ok(fileService.findBySearchCriteria(searchCriteria).map(fileMapper::toShowDto));
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")

    public FileShowDTO getById(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<File> optionalFile = fileService.findById(id);
        if (optionalFile.isPresent()) {
            File savedFile = optionalFile.get();
            if (user.getRole().getViewPermissions().contains(PermissionEntity.FILES) &&
                    (user.getRole().getViewOtherPermissions().contains(PermissionEntity.FILES) || savedFile.getCreatedBy().equals(user.getId()))) {
                return fileMapper.toShowDto(savedFile);
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public FileShowDTO patch(@Parameter(description = "File fields to update") @Valid @RequestBody FilePatchDTO file,
                             @PathVariable("id") Long id,
                             HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<File> optionalFile = fileService.findById(id);

        if (optionalFile.isPresent()) {
            File savedFile = optionalFile.get();
            if (user.getRole().getEditOtherPermissions().contains(PermissionEntity.FILES) || savedFile.getCreatedBy().equals(user.getId())) {
                savedFile.setName(file.getName());
                return fileMapper.toShowDto(fileService.update(savedFile));
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("File not found", HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public ResponseEntity<SuccessResponse> delete(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);

        Optional<File> optionalFile = fileService.findById(id);
        if (optionalFile.isPresent()) {
            File savedFile = optionalFile.get();
            if (user.getId().equals(savedFile.getCreatedBy())
                    || user.getRole().getDeleteOtherPermissions().contains(PermissionEntity.FILES)) {
                fileService.delete(id);
                return new ResponseEntity<>(new SuccessResponse(true, "Deleted successfully"),
                        HttpStatus.OK);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("File not found", HttpStatus.NOT_FOUND);
    }

//    @GetMapping("/download/tos")
//    public byte[] downloadTOS() {
//        return storageServiceFactory.getStorageService().download("terms and privacy/Atlas CMMS Terms of service
//        .pdf");
//    }
//
//    @GetMapping("/download/privacy-policy")
//    public byte[] downloadPrivacyPolicy() {
//        return storageServiceFactory.getStorageService().download("terms and privacy/Atlas CMMS privacy policy.pdf");
//    }
}


