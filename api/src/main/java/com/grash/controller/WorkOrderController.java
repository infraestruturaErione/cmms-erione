package com.grash.controller;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.*;
import com.grash.dto.license.LicenseEntitlement;
import com.grash.dto.workOrder.WorkOrderCheckInDTO;
import com.grash.dto.workOrder.WorkOrderCheckOutDTO;
import com.grash.dto.workOrder.WorkOrderDepartDTO;
import com.grash.dto.workOrder.WorkOrderPatchDTO;
import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.dto.workOrder.WorkOrderShowDTO;
import com.grash.dto.workOrder.report.WorkOrderOperationalReportRequestDTO;
import com.grash.dto.workOrder.report.WorkOrderOperationalReportResponseDTO;
import com.grash.exception.CustomException;
import com.grash.factory.StorageServiceFactory;
import com.grash.mapper.PreventiveMaintenanceMapper;
import com.grash.mapper.WorkOrderMapper;
import com.grash.factory.MailServiceFactory;
import com.grash.model.*;
import com.grash.model.abstracts.WorkOrderBase;
import com.grash.model.enums.*;
import com.grash.model.enums.workflow.WFMainCondition;
import com.grash.repository.CommentRepository;
import com.grash.repository.CustomerRepository;
import com.grash.repository.GeneratedReportRepository;
import com.grash.dto.workOrder.report.WorkOrderBulkReportRequestDTO;
import com.grash.dto.workOrder.report.GeneratedReportShowDTO;
import com.grash.service.*;
import com.grash.utils.Helper;
import com.grash.utils.MultipartFileImpl;
import com.grash.utils.Utils;
import com.itextpdf.html2pdf.HtmlConverter;


import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring5.SpringTemplateEngine;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import jakarta.transaction.Transactional;

import jakarta.validation.Valid;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLConnection;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import static java.util.Comparator.comparingLong;
import static java.util.stream.Collectors.collectingAndThen;
import static java.util.stream.Collectors.toCollection;

@RestController
@RequestMapping("/work-orders")
@Tag(name = "Work Orders", description = "Operations on work orders")
@RequiredArgsConstructor
@Transactional
public class WorkOrderController {
    private static final String FIELD_REPORT_PREFIX = "[Relato em campo]";
    private static final List<String> PHOTO_ONLY_FIELD_REPORT_TEXTS = List.of(
            "Photo evidence registered.",
            "Evidencia fotografica registrada.",
            "Evidência fotográfica registrada.",
            "EvidÃªncia fotogrÃ¡fica registrada."
    );

    private final WorkOrderService workOrderService;
    private final WorkOrderMapper workOrderMapper;
    private final UserService userService;
    private final GeneratedReportRepository generatedReportRepository;
    private final MessageSource messageSource;
    private final AssetService assetService;
    private final LocationService locationService;
    private final LaborService laborService;
    private final PartService partService;
    private final FileService fileService;
    private final PartQuantityService partQuantityService;
    private final NotificationService notificationService;
    private final MailServiceFactory mailServiceFactory;
    private final Utils utils;
    private final TaskService taskService;
    private final RelationService relationService;
    private final AdditionalCostService additionalCostService;
    private final WorkOrderHistoryService workOrderHistoryService;
    private final SpringTemplateEngine thymeleafTemplateEngine;
    private final StorageServiceFactory storageServiceFactory;
    private final WorkflowService workflowService;
    private final Environment environment;
    private final PreventiveMaintenanceService preventiveMaintenanceService;
    private final EntityManager em;
    private final PreventiveMaintenanceMapper preventiveMaintenanceMapper;
    private final BrandingService brandingService;
    private final ScheduleService scheduleService;
    private final LicenseService licenseService;
    private final IntercomService intercomService;
    private final CompanyService companyService;
    private final WorkOrderOperationalReportService workOrderOperationalReportService;
    private final CustomerScopeService customerScopeService;
    private final CommentRepository commentRepository;
    private final CustomerRepository customerRepository;


    @Value("${frontend.url}")
    private String frontendUrl;

    @PostMapping("/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Page<WorkOrderShowDTO>> search(@Parameter(description = "Search criteria for filtering work" +
                                                                 " orders") @RequestBody SearchCriteria searchCriteria,
                                                         HttpServletRequest req) {
        User user = userService.whoami(req);
        return ResponseEntity.ok(workOrderService.findBySearchCriteria(workOrderService.getSearchCriteria(user,
                searchCriteria)).map(workOrderMapper::toShowDto));
    }

    @PostMapping("/search/mini")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Page<WorkOrderBaseMiniDTO>> searchMini(@Parameter(description = "Search criteria for " +
                                                                         "filtering work orders") @RequestBody SearchCriteria searchCriteria,
                                                                 HttpServletRequest req) {
        User user = userService.whoami(req);
        return ResponseEntity.ok(workOrderService.findBySearchCriteria(workOrderService.getSearchCriteria(user,
                        searchCriteria))
                .map(workOrderMapper::toBaseMiniDto));
    }

    @PostMapping("/reports/operational")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<WorkOrderOperationalReportResponseDTO> getOperationalReport(
            @Parameter(description = "Operational report filters") @RequestBody WorkOrderOperationalReportRequestDTO request,
            HttpServletRequest req) {
        User user = userService.whoami(req);
        return ResponseEntity.ok(workOrderOperationalReportService.buildReport(request, user));
    }

    @PostMapping("/events")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public Collection<CalendarEvent<WorkOrderBaseMiniDTO>> getEvents(@Parameter(description = "Date range for " +
            "calendar events") @Valid @RequestBody DateRange
                                                                             dateRange, HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS)) {
            List<CalendarEvent<WorkOrderBaseMiniDTO>> result = new ArrayList<>();
            result.addAll(preventiveMaintenanceService.getEvents(dateRange.getEnd(), user.getCompany().getId()).stream()
                    .filter(calendarEvent -> calendarEvent.getDate().after(new Date()))
                    .filter(calendarEvent -> canViewWorkOrderBase(user, calendarEvent.getEvent()))
                    .map(calendarEvent -> new CalendarEvent<>(calendarEvent.getType(),
                            preventiveMaintenanceMapper.toBaseMiniDto(calendarEvent.getEvent()),
                            calendarEvent.getDate()))
                    .collect(Collectors.toList()));
            return result;
        } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
    }

    private boolean canViewWorkOrderBase(User user, WorkOrderBase workOrderBase) {
        boolean canViewOthers =
                user.getRole().getViewOtherPermissions().contains(workOrderBase instanceof PreventiveMaintenance ?
                        PermissionEntity.PREVENTIVE_MAINTENANCES : PermissionEntity.WORK_ORDERS);
        return canViewOthers || (workOrderBase.getCreatedBy() != null && workOrderBase.getCreatedBy().equals(user.getId())) || workOrderBase.isAssignedTo(user);

    }

    @GetMapping("/asset/{id}")
    @PreAuthorize("permitAll()")
    public Collection<WorkOrderShowDTO> getByAsset(@PathVariable("id") Long id,
                                                   HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Asset> optionalAsset = assetService.findById(id);
        if (optionalAsset.isPresent()) {
            customerScopeService.assertCanAccessAsset(user, id);
            return workOrderService.findByAsset(id).stream()
                    .filter(workOrder -> canViewWorkOrderBase(user, workOrder))
                    .filter(workOrder -> customerScopeService.canAccessWorkOrderBase(user, workOrder))
                    .map(workOrderMapper::toShowDto).collect(Collectors.toList());
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/location/{id}")
    @PreAuthorize("permitAll()")
    public Collection<WorkOrderShowDTO> getByLocation(@PathVariable("id") Long id,
                                                      HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Location> optionalLocation = locationService.findById(id);
        if (optionalLocation.isPresent()) {
            customerScopeService.assertCanAccessLocation(user, id);
            return workOrderService.findByLocation(id).stream()
                    .filter(workOrder -> canViewWorkOrderBase(user, workOrder))
                    .filter(workOrder -> customerScopeService.canAccessWorkOrderBase(user, workOrder))
                    .map(workOrderMapper::toShowDto).collect(Collectors.toList());
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")
    public WorkOrderShowDTO getById(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        return workOrderMapper.toShowDto(workOrderService.checkAccessToWorkOrderId(id, user));
    }

    @PostMapping("")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    WorkOrderShowDTO create(@Parameter(description = "Work order data to create") @Valid @RequestBody WorkOrderPostDTO
                                    workOrderReq, HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getCreatePermissions().contains(PermissionEntity.WORK_ORDERS)
                && (workOrderReq.getSignature() == null ||
                user.getCompany().getSubscription().getSubscriptionPlan().getFeatures().contains(PlanFeatures.SIGNATURE))) {
            customerScopeService.prepareAndValidateRequestScope(workOrderReq, user);
            if (user.getCompany().getCompanySettings().getGeneralPreferences().isAutoAssignWorkOrders()) {
                User primaryUser = workOrderReq.getPrimaryUser();
                workOrderReq.setPrimaryUser(primaryUser == null ? user : primaryUser);
            }
            WorkOrder createdWorkOrder = workOrderService.create(workOrderReq, user.getCompany());

            // Fire Intercom event for first work order creation
            if (!user.getCompany().isFirstWorkOrderCreated()) {
                user.getCompany().setFirstWorkOrderCreated(true);
                companyService.update(user.getCompany());
                Map<String, Object> metadata = new HashMap<>();
                metadata.put("work_order_id", createdWorkOrder.getId());
                metadata.put("work_order_title", createdWorkOrder.getTitle());
                intercomService.createCompanyActivationEvent(
                        "first-work-order-created",
                        user.getCompany().getId(),
                        user.getEmail(),
                        metadata
                );
            }

            return workOrderMapper.toShowDto(createdWorkOrder);
        } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
    }

    @GetMapping("/part/{id}")
    @PreAuthorize("permitAll()")

    public Collection<WorkOrderShowDTO> getByPart(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Part> optionalPart = partService.findById(id);
        if (optionalPart.isPresent()) {
            Collection<PartQuantity> partQuantities = partQuantityService.findByPart(id).stream()
                    .filter(partQuantity -> partQuantity.getWorkOrder() != null).collect(Collectors.toList());
            Collection<WorkOrder> workOrders =
                    partQuantities.stream().map(PartQuantity::getWorkOrder).collect(Collectors.toList());
            Collection<WorkOrder> uniqueWorkOrders =
                    workOrders.stream().collect(collectingAndThen(toCollection(() -> new TreeSet<>(comparingLong(WorkOrder::getId))),
                            ArrayList::new));
            return uniqueWorkOrders.stream().map(workOrderMapper::toShowDto).collect(Collectors.toList());
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public WorkOrderShowDTO patch(@Parameter(description = "Work order fields to update") @Valid @RequestBody WorkOrderPatchDTO
                                          workOrder, @PathVariable("id") Long id,
                                  HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            // Edicao administrativa (categoria, prioridade, responsaveis,
            // requiredSignature, etc) exige permissao real de WORK_ORDERS -
            // diferente dos endpoints operacionais (depart/check-in/check-out/
            // Tasks/etc), que continuam usando canBeEditedBy (tecnico
            // atribuido/criador executa a OS, mas nao a edita
            // administrativamente).
            if (savedWorkOrder.canBeAdministrativelyEditedBy(user)) {
                em.detach(savedWorkOrder);
                customerScopeService.prepareAndValidateRequestScope(workOrder, user);
                WorkOrder patchedWorkOrder = workOrderService.update(id, workOrder, user);
                notificationService.notifyWorkOrderChanged(savedWorkOrder.getUsers(), patchedWorkOrder.getId());

                if (patchedWorkOrder.isArchived() && !savedWorkOrder.isArchived()) {
                    Collection<Workflow> workflows =
                            workflowService.findByMainConditionAndCompany(WFMainCondition.WORK_ORDER_ARCHIVED,
                                    user.getCompany().getId());
                    workflows.forEach(workflow -> workflowService.runWorkOrder(workflow, patchedWorkOrder));
                }

                boolean shouldNotify =
                        !user.getCompany().getCompanySettings().getGeneralPreferences().isDisableClosedWorkOrdersNotif() || !patchedWorkOrder.getStatus().equals(Status.COMPLETE);
                if (shouldNotify)
                    workOrderService.patchNotify(savedWorkOrder, patchedWorkOrder, Helper.getLocale(user));
                return workOrderMapper.toShowDto(patchedWorkOrder);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("WorkOrder not found", HttpStatus.NOT_FOUND);
    }

    @PatchMapping("/{id}/change-status")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public WorkOrderShowDTO changeStatus(@Parameter(description = "Work order status change data") @Valid @RequestBody WorkOrderChangeStatusDTO
                                                 workOrder, @PathVariable("id") Long id,
                                         HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        WorkOrder savedWorkOrder = optionalWorkOrder.get();
        em.detach(savedWorkOrder); // detach FIRST
        WorkOrder originalWorkOrder = savedWorkOrder;
        WorkOrder mutableWO = workOrderService.findById(id).get(); // fresh managed copy

        if (mutableWO.getFirstTimeToReact() == null && !workOrder.getStatus().equals(Status.ON_HOLD))
            mutableWO.setFirstTimeToReact(new Date());
        Status savedWorkOrderStatusBefore = mutableWO.getStatus();

        if (workOrder.getStatus() == null) throw new CustomException("Status can't be null", HttpStatus.NOT_ACCEPTABLE);
        if (workOrder.getSignature() != null && !licenseService.hasEntitlement(LicenseEntitlement.SIGNATURE_CAPTURE))
            throw new CustomException("You need a license to add signature to work order",
                    HttpStatus.FORBIDDEN);
        mutableWO.setSignature(workOrder.getSignature());
        mutableWO.setStatus(workOrder.getStatus());
        mutableWO.setFeedback(workOrder.getFeedback());
        if (workOrder.getSignerName() != null) mutableWO.setSignerName(workOrder.getSignerName());
        if (workOrder.getSignerDocument() != null) mutableWO.setSignerDocument(workOrder.getSignerDocument());
        if (workOrder.getMileageTraveled() != null) mutableWO.setMileageTraveled(workOrder.getMileageTraveled());

        if (workOrder.getStatus() != Status.COMPLETE) {
            mutableWO.setCompletedOn(null);
            mutableWO.setCompletedBy(null);
        }
        if (mutableWO.canBeEditedBy(user) && (workOrder.getSignature() == null ||
                user.getCompany().getSubscription().getSubscriptionPlan().getFeatures().contains(PlanFeatures.SIGNATURE))) {
            if (!workOrder.getStatus().equals(Status.IN_PROGRESS)) {
                if (workOrder.getStatus().equals(Status.COMPLETE)) {
                    // So grava completedBy/completedOn na primeira transicao pra
                    // COMPLETE - reenvio duplicado (retry de rede, duplo clique que
                    // escapou do loading do botao) nao deve reescrever o horario de
                    // conclusao real.
                    if (!savedWorkOrderStatusBefore.equals(Status.COMPLETE)) {
                        mutableWO.setCompletedBy(user);
                        mutableWO.setCompletedOn(new Date());
                    }
                    if (mutableWO.getAsset() != null) {
                        Asset asset = mutableWO.getAsset();
                        Collection<WorkOrder> workOrdersOfSameAsset = workOrderService.findByAsset(asset.getId());
                        if (workOrdersOfSameAsset.stream().noneMatch(workOrder1 -> !workOrder1.getId().equals(id) && !workOrder1.getStatus().equals(Status.COMPLETE))) {
                            assetService.stopDownTime(asset.getId(), Helper.getLocale(user));
                        }
                    }
                    if (mutableWO.getParentPreventiveMaintenance() != null)
                        scheduleService.scheduleNextWorkOrderJobAfterCompletion(mutableWO.getParentPreventiveMaintenance().getSchedule().getId(), mutableWO.getCompletedOn());
                }
                Collection<Labor> labors = laborService.findByWorkOrder(id);
                Collection<Labor> primaryTimes = labors.stream().filter(Labor::isLogged).collect(Collectors.toList());
                primaryTimes.forEach(laborService::stop);
            }
            WorkOrder patchedWorkOrder = workOrderService.saveAndFlushWithWebhook(mutableWO, user.getCompany(),
                    originalWorkOrder);

            if (patchedWorkOrder.getStatus().equals(Status.COMPLETE) && !savedWorkOrderStatusBefore.equals(Status.COMPLETE)) {
                List<User> admins =
                        userService.findWorkersByCompany(user.getCompany().getId()).stream().filter(ownUser -> ownUser.getRole().getViewPermissions().contains(PermissionEntity.SETTINGS) && ownUser.isEnabled() && ownUser.getUserSettings().shouldEmailUpdatesForWorkOrders()).collect(Collectors.toList());
                notificationService.createMultiple(admins.stream().map(admin -> new Notification(messageSource.getMessage("complete_work_order_content", new String[]{patchedWorkOrder.getTitle(), user.getFullName()}, Helper.getLocale(admin)), admin,
                                NotificationType.WORK_ORDER, id)).collect(Collectors.toList()), true,
                        messageSource.getMessage("complete_work_order", null, Helper.getLocale(user)));
                Collection<Workflow> workflows =
                        workflowService.findByMainConditionAndCompany(WFMainCondition.WORK_ORDER_CLOSED,
                                user.getCompany().getId());
                workflows.forEach(workflow -> workflowService.runWorkOrder(workflow, patchedWorkOrder));
            }
            if (user.getCompany().getCompanySettings().getGeneralPreferences().isWoUpdateForRequesters()
                    && savedWorkOrderStatusBefore != patchedWorkOrder.getStatus()
                    && patchedWorkOrder.getParentRequest() != null) {
                Long requesterId = patchedWorkOrder.getParentRequest().getCreatedBy();
                String requesterEmail = null;
                User requester = null;
                if (requesterId == null) {
                    String contact = patchedWorkOrder.getParentRequest().getContact();
                    if (contact != null && Helper.isValidEmailAddress(contact)) {
                        requesterEmail = contact;
                    }
                } else {
                    requester = userService.findById(requesterId).get();
                    requesterEmail = requester.getEmail();
                }
                Locale locale = Helper.getLocale(user);
                String message = messageSource.getMessage("notification_wo_request",
                        new Object[]{patchedWorkOrder.getTitle(),
                                messageSource.getMessage(patchedWorkOrder.getStatus().toString(), null, locale)},
                        locale);
                if (requester != null) {
                    notificationService.create(new Notification(message, requester,
                            NotificationType.WORK_ORDER, id));
                }
                if ((requester != null && requester.getUserSettings().shouldEmailUpdatesForRequests() && requester.isEnabled()) || requesterEmail != null) {
                    Map<String, Object> mailVariables = new HashMap<String, Object>() {{
                        put("workOrderLink", frontendUrl + "/app/work-orders/" + id);
                        put("message", message);
                    }};
                    mailServiceFactory.getMailService().sendMessageUsingThymeleafTemplate(new String[]{requesterEmail},
                            messageSource.getMessage("request_update", null, locale), mailVariables, "requester" +
                                    "-update.html", Helper.getLocale(user), null);
                }
            }
            return workOrderMapper.toShowDto(patchedWorkOrder);
        } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
    }

    @PostMapping("/{id}/depart")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public WorkOrderShowDTO depart(@Valid @RequestBody WorkOrderDepartDTO dto,
                                   @PathVariable("id") Long id,
                                   HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            if (savedWorkOrder.canBeEditedBy(user)) {
                em.detach(savedWorkOrder);
                WorkOrder originalWorkOrder = savedWorkOrder;
                WorkOrder mutableWO = workOrderService.findById(id).get();

                // Idempotente: reenvio duplicado (retry de rede, duplo clique) nao
                // deve reescrever o horario/local do deslocamento ja registrado.
                if (mutableWO.getDepartureAt() == null) {
                    mutableWO.setDepartureAt(new Date());
                    mutableWO.setDepartureLat(dto.getDepartureLat());
                    mutableWO.setDepartureLng(dto.getDepartureLng());
                    mutableWO = workOrderService.saveAndFlushWithWebhook(mutableWO, user.getCompany(), originalWorkOrder);
                }
                return workOrderMapper.toShowDto(mutableWO);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("WorkOrder not found", HttpStatus.NOT_FOUND);
    }

    @PostMapping("/{id}/check-in")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public WorkOrderShowDTO checkIn(@Valid @RequestBody WorkOrderCheckInDTO dto,
                                   @PathVariable("id") Long id,
                                   HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            if (savedWorkOrder.canBeEditedBy(user)) {
                em.detach(savedWorkOrder);
                WorkOrder originalWorkOrder = savedWorkOrder;
                WorkOrder mutableWO = workOrderService.findById(id).get();

                // Idempotente: reenvio duplicado nao deve reescrever o check-in.
                if (mutableWO.getCheckInAt() == null) {
                    mutableWO.setCheckInAt(new Date());
                    mutableWO.setCheckInLat(dto.getCheckInLat());
                    mutableWO.setCheckInLng(dto.getCheckInLng());
                    mutableWO.setCheckInAddress(dto.getCheckInAddress());
                    mutableWO = workOrderService.saveAndFlushWithWebhook(mutableWO, user.getCompany(), originalWorkOrder);
                }
                return workOrderMapper.toShowDto(mutableWO);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("WorkOrder not found", HttpStatus.NOT_FOUND);
    }

    @PostMapping("/{id}/check-out")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public WorkOrderShowDTO checkOut(@Valid @RequestBody WorkOrderCheckOutDTO dto,
                                   @PathVariable("id") Long id,
                                   HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            if (savedWorkOrder.canBeEditedBy(user)) {
                em.detach(savedWorkOrder);
                WorkOrder originalWorkOrder = savedWorkOrder;
                WorkOrder mutableWO = workOrderService.findById(id).get();

                // Idempotente: reenvio duplicado nao deve reescrever o check-out.
                if (mutableWO.getCheckOutAt() == null) {
                    mutableWO.setCheckOutAt(new Date());
                    mutableWO.setCheckOutLat(dto.getCheckOutLat());
                    mutableWO.setCheckOutLng(dto.getCheckOutLng());
                    mutableWO.setCheckOutAddress(dto.getCheckOutAddress());
                    mutableWO = workOrderService.saveAndFlushWithWebhook(mutableWO, user.getCompany(), originalWorkOrder);
                }
                return workOrderMapper.toShowDto(mutableWO);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("WorkOrder not found", HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public ResponseEntity<SuccessResponse> delete(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);

        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            if (
                    user.getId().equals(savedWorkOrder.getCreatedBy()) ||
                            user.getRole().getDeleteOtherPermissions().contains(PermissionEntity.WORK_ORDERS)) {
                Map<String, Object> mailVariables = new HashMap<String, Object>() {{
                    put("workOrdersLink", frontendUrl + "/app/work-orders");
                    put("workOrderTitle", savedWorkOrder.getTitle());
                    put("deleter", user.getFullName());
                }};
                String title = messageSource.getMessage("deleted_wo", null, Helper.getLocale(user));

                List<User> usersToMail =
                        userService.findByCompany(user.getCompany().getId()).stream().filter(user1 -> user1.getRole()
                                        .getViewPermissions().contains(PermissionEntity.SETTINGS))
                                .filter(user1 -> user1.isEnabled() && user1.getUserSettings().isEmailNotified()).collect(Collectors.toList());

                mailServiceFactory.getMailService().sendMessageUsingThymeleafTemplate(usersToMail.stream().map(User::getEmail)
                                .toArray(String[]::new), title, mailVariables, "deleted-work-order.html",
                        Helper.getLocale(user), null);

                workOrderService.delete(savedWorkOrder, user.getCompany());
                return new ResponseEntity<>(new SuccessResponse(true, "Deleted successfully"),
                        HttpStatus.OK);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("WorkOrder not found", HttpStatus.NOT_FOUND);
    }

    @GetMapping(path = "/report/{id}")
    @Transactional
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<?> getPDF(@PathVariable("id") Long id, HttpServletRequest req,
                                    HttpServletResponse response) throws IOException {
        User user = userService.whoami(req);
        StorageService storageService = storageServiceFactory.getStorageService();
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            if (user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS) &&
                    (user.getRole().getViewOtherPermissions().contains(PermissionEntity.WORK_ORDERS) || user.getId().equals(savedWorkOrder.getCreatedBy()) || savedWorkOrder.isAssignedTo(user))) {
                Context thymeleafContext = new Context();
                thymeleafContext.setLocale(Helper.getLocale(user));
                Map<String, Object> variables = new HashMap<>(buildCompanyReportVariables(user, storageService));
                variables.putAll(buildWorkOrderReportVariables(savedWorkOrder, storageService));
                thymeleafContext.setVariables(variables);

                String reportHtml = thymeleafTemplateEngine.process("work-order-report.html", thymeleafContext);

                /* Setup Source and target I/O streams */
                ByteArrayOutputStream target = new ByteArrayOutputStream();
                /* Call convert method */
                HtmlConverter.convertToPdf(reportHtml, target);
                /* extract output as bytes */
                byte[] bytes = target.toByteArray();
                MultipartFile file = new MultipartFileImpl(bytes, "Work Order Report.pdf");
                return ResponseEntity.ok()
                        .body(new SuccessResponse(true, storageServiceFactory.getStorageService().uploadAndSign(file,
                                "reports/" + user.getCompany().getId())));
            } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);

    }

    // Variaveis de nivel de EMPRESA usadas pelo template do relatorio - iguais
    // pra toda OS do mesmo usuario, entao so' precisam ser calculadas uma vez
    // (usado tanto no relatorio individual quanto no relatorio em massa).
    private Map<String, Object> buildCompanyReportVariables(User user, StorageService storageService) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("companyName", user.getCompany().getName());
        variables.put("companyPhone", user.getCompany().getPhone());
        variables.put("companyLogo", user.getCompany().getLogo() == null ? null :
                storageService.generateSignedUrl(user.getCompany().getLogo(), 5));
        com.grash.model.Currency currency =
                user.getCompany().getCompanySettings().getGeneralPreferences().getCurrency();
        variables.put("currency", currency == null ? null : currency.getCode());
        variables.put("utils", utils);
        variables.put("dateFormat", user.getCompany().getCompanySettings().getGeneralPreferences().getDateFormat());
        variables.put("timeZone", user.getCompany().getCompanySettings().getGeneralPreferences().getTimeZone());
        variables.put("environment", environment);
        variables.put("messageSource", messageSource);
        variables.put("locale", Helper.getLocale(user));
        variables.put("backgroundColor", brandingService.getMailBackgroundColor());
        return variables;
    }

    // Variaveis especificas de UMA OS - extraido do relatorio individual pra
    // poder ser chamado em loop no relatorio em massa (uma OS por bloco no
    // mesmo PDF), sem duplicar a logica de evidencias/checklist/etc.
    private Map<String, Object> buildWorkOrderReportVariables(WorkOrder savedWorkOrder, StorageService storageService) {
        Long id = savedWorkOrder.getId();
        Optional<User> creator = savedWorkOrder.getCreatedBy() == null ? Optional.empty() :
                userService.findById(savedWorkOrder.getCreatedBy());
        List<Task> tasks = taskService.findByWorkOrder(id);
        Map<Long, String[]> tasksImagesUrls = tasks.stream()
                .collect(Collectors.toMap(
                        Task::getId,
                        task -> task.getImages().stream()
                                .map(image -> storageService.generateSignedUrl(image, 5))
                                .toArray(String[]::new)
                ));
        Collection<PartQuantity> partQuantities = partQuantityService.findByWorkOrder(id);
        Collection<Labor> labors = laborService.findByWorkOrder(id);
        Collection<Relation> relations = relationService.findByWorkOrder(id);
        Collection<AdditionalCost> additionalCosts = additionalCostService.findByWorkOrder(id);
        Collection<WorkOrderHistory> workOrderHistories = workOrderHistoryService.findByWorkOrder(id);
        List<Comment> fieldComments = commentRepository
                .findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(List.of(id),
                        FIELD_REPORT_PREFIX);
        List<String> fieldReports = fieldComments.stream()
                .map(comment -> getRealFieldReportText(comment.getContent()))
                .filter(Objects::nonNull)
                .filter(fieldReport -> !fieldReport.isBlank())
                .collect(Collectors.toList());
        List<Map<String, Object>> fieldEvidenceItems = buildFieldEvidenceItems(savedWorkOrder, fieldComments,
                storageService);
        Map<String, Object> variables = new HashMap<>();
        variables.put("assignedTo",
                Helper.enumerate(savedWorkOrder.getAssignedTo().stream().map(User::getFullName).collect(Collectors.toList())));
        variables.put("customers",
                Helper.enumerate(savedWorkOrder.getCustomers().stream().map(Customer::getName).collect(Collectors.toList())));
        variables.put("workOrder", savedWorkOrder);
        variables.put("primaryUserName", savedWorkOrder.getPrimaryUser() == null ? null :
                savedWorkOrder.getPrimaryUser().getFullName());
        variables.put("createdBy", creator.<Object>map(User::getFullName).orElse(null));
        variables.put("tasks", tasks);
        variables.put("labors", labors);
        variables.put("relations", relations);
        variables.put("additionalCosts", additionalCosts);
        variables.put("workOrderHistories", workOrderHistories);
        variables.put("partQuantities", partQuantities);
        variables.put("tasksImagesUrls", tasksImagesUrls);
        variables.put("fieldReports", fieldReports);
        variables.put("fieldEvidenceItems", fieldEvidenceItems);
        return variables;
    }

    @PostMapping(path = "/report/bulk")
    @Transactional
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public ResponseEntity<?> getBulkPDF(@Valid @RequestBody WorkOrderBulkReportRequestDTO request,
                                        HttpServletRequest req) {
        User user = userService.whoami(req);
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS)) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        Long companyId = user.getCompany().getId();
        Customer selectedCustomer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new CustomException("Cliente nao encontrado", HttpStatus.NOT_FOUND));
        // O cliente ja passa por CompanyAudit.afterLoad() (lanca 403 sozinho se
        // for de outra empresa) - nao precisa checar de novo aqui.

        // O relatorio e' restrito EXCLUSIVAMENTE ao cliente selecionado. Cidade
        // e' so um dado cadastral exibido no PDF - nunca usada pra ampliar a
        // busca pra outros clientes que por coincidencia tenham o mesmo texto
        // em Customer.city (cidade nao e' vinculo empresarial/matriz-filial).
        //
        // CNPJ, quando informado, serve so de CONFERENCIA contra o cliente
        // selecionado - nunca pra localizar ou trocar de cliente. Se nao bater,
        // e' erro de validacao, nao uma busca por outro cliente da cidade.
        String requestedCnpjDigits = onlyDigits(request.getCnpj());
        if (!requestedCnpjDigits.isEmpty()
                && !requestedCnpjDigits.equals(onlyDigits(selectedCustomer.getCnpj()))) {
            throw new CustomException("O CNPJ informado nao corresponde ao cliente selecionado",
                    HttpStatus.BAD_REQUEST);
        }

        // O periodo representa datas CIVIS (LocalDate) no timezone configurado
        // da empresa - nao um instante UTC. O frontend manda so a data (ex:
        // "2026-08-01"), sem fingir que ja e' UTC; quem resolve pro instante
        // certo e' o backend: inicio do dia inicial (inclusive) ate' o inicio
        // do dia SEGUINTE ao final (exclusivo), ambos calculados no fuso da
        // empresa - nunca no fuso do navegador nem no fuso da JVM (que e'
        // sempre UTC, ver ApiApplication.configureDefaultTimeZone).
        String companyTimeZoneId = user.getCompany().getCompanySettings().getGeneralPreferences().getTimeZone();
        ZoneId companyZone;
        try {
            companyZone = ZoneId.of(companyTimeZoneId);
        } catch (Exception invalidZone) {
            companyZone = ZoneId.of(GeneralPreferences.DEFAULT_TIME_ZONE);
        }
        Date periodStartInstant = Date.from(request.getStart().atStartOfDay(companyZone).toInstant());
        Date periodEndExclusiveInstant = Date.from(request.getEnd().plusDays(1).atStartOfDay(companyZone).toInstant());

        List<Long> customerIds = Collections.singletonList(selectedCustomer.getId());
        List<WorkOrder> workOrders = workOrderService.findCompletedByCustomersAndPeriod(customerIds,
                request.getPeriodField(), periodStartInstant, periodEndExclusiveInstant, companyId);
        if (workOrders.isEmpty()) {
            throw new CustomException("Nenhuma OS concluida encontrada nesse periodo", HttpStatus.NOT_FOUND);
        }
        StorageService storageService = storageServiceFactory.getStorageService();
        Context thymeleafContext = new Context();
        thymeleafContext.setLocale(Helper.getLocale(user));
        Map<String, Object> variables = new HashMap<>(buildCompanyReportVariables(user, storageService));
        List<Map<String, Object>> workOrderReports = workOrders.stream()
                .map(workOrder -> buildWorkOrderReportVariables(workOrder, storageService))
                .collect(Collectors.toList());
        // Cabecalho/nome do arquivo sempre correspondem ao cliente selecionado.
        // Cidade e CNPJ, quando existirem no cadastro, entram so como dado
        // informativo do proprio cliente selecionado - nunca de outro.
        String customerLabel = selectedCustomer.getName();
        variables.put("customerLabel", customerLabel);
        variables.put("cityLabel", selectedCustomer.getCity());
        variables.put("cnpjLabel", selectedCustomer.getCnpj());
        // Periodo exibido usa as LocalDate ORIGINAIS escolhidas pelo usuario,
        // formatadas direto (sem hora/fuso) - nunca reconstruidas a partir do
        // instante UTC calculado acima pra query. Assim o PDF/historico
        // sempre mostram exatamente as datas que foram selecionadas.
        DateTimeFormatter periodDateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        String periodStartLabel = request.getStart().format(periodDateFormatter);
        String periodEndLabel = request.getEnd().format(periodDateFormatter);
        variables.put("periodStart", periodStartLabel);
        variables.put("periodEnd", periodEndLabel);
        variables.put("workOrderReports", workOrderReports);
        thymeleafContext.setVariables(variables);

        String reportHtml = thymeleafTemplateEngine.process("work-orders-bulk-report.html", thymeleafContext);
        ByteArrayOutputStream target = new ByteArrayOutputStream();
        HtmlConverter.convertToPdf(reportHtml, target);
        byte[] bytes = target.toByteArray();
        MultipartFile file = new MultipartFileImpl(bytes, "Relatorio em Massa - " + customerLabel + ".pdf");
        String filePath = storageService.upload(file, "reports/" + companyId);

        String description = "Cliente: " + customerLabel +
                (requestedCnpjDigits.isEmpty() ? "" : " · CNPJ: " + request.getCnpj()) +
                " · Periodo: " + periodStartLabel + " a " + periodEndLabel;
        Date expiresAt = new Date(System.currentTimeMillis() + GENERATED_REPORT_TTL_MS);
        generatedReportRepository.save(GeneratedReport.builder()
                .companyId(companyId)
                .type(GeneratedReportType.WORK_ORDER_BULK)
                .status(GeneratedReportStatus.DONE)
                .description(description)
                .filePath(filePath)
                .expiresAt(expiresAt)
                .build());

        return ResponseEntity.ok()
                .body(new SuccessResponse(true, storageService.generateSignedUrl(filePath, 10)));
    }

    private static final long GENERATED_REPORT_TTL_MS = 7L * 24 * 60 * 60 * 1000;

    private static String onlyDigits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    @GetMapping(path = "/report/bulk/history")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public List<GeneratedReportShowDTO> getBulkPDFHistory(HttpServletRequest req) {
        User user = userService.whoami(req);
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS)) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        Long companyId = user.getCompany().getId();
        Date now = new Date();
        return generatedReportRepository
                .findByCompanyIdAndTypeOrderByCreatedAtDesc(companyId, GeneratedReportType.WORK_ORDER_BULK)
                .stream()
                .map(report -> {
                    Optional<User> requester = report.getCreatedBy() == null ? Optional.empty() :
                            userService.findById(report.getCreatedBy());
                    return GeneratedReportShowDTO.builder()
                            .id(report.getId())
                            .description(report.getDescription())
                            .requestedByName(requester.map(User::getFullName).orElse(null))
                            .requestedAt(report.getCreatedAt())
                            .status(report.getStatus())
                            .expiresAt(report.getExpiresAt())
                            .available(report.getExpiresAt() != null && report.getExpiresAt().after(now))
                            .build();
                })
                .collect(Collectors.toList());
    }

    @GetMapping(path = "/report/bulk/history/{id}/download")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public SuccessResponse downloadBulkPDFFromHistory(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        if (!user.getRole().getViewPermissions().contains(PermissionEntity.WORK_ORDERS)) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        GeneratedReport report = generatedReportRepository.findById(id)
                .orElseThrow(() -> new CustomException("Relatorio nao encontrado", HttpStatus.NOT_FOUND));
        if (!report.getCompanyId().equals(user.getCompany().getId())) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (report.getExpiresAt() == null || report.getExpiresAt().before(new Date())) {
            throw new CustomException("Esse relatorio ja expirou", HttpStatus.GONE);
        }
        StorageService storageService = storageServiceFactory.getStorageService();
        return new SuccessResponse(true, storageService.generateSignedUrl(report.getFilePath(), 10));
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
                String note = stripFieldReportPrefix(comment.getContent());
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

    @GetMapping("/urgent")
    @PreAuthorize("permitAll()")
    public SuccessResponse getUrgentCount(HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT) && user.getRole().getViewPermissions().contains(PermissionEntity.REQUESTS)) {
            return new SuccessResponse(true, workOrderService.countUrgent(user).toString());
        } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
    }

    @PatchMapping("/files/{id}/add")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public List<File> addFilesToWorkOrder(@PathVariable("id") Long id, @Parameter(description = "List of files to " +
                                                  "add") @RequestBody List<File> files,
                                          HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            if (!savedWorkOrder.canBeEditedBy(user))
                throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
            savedWorkOrder.getFiles().addAll(files);
            workOrderService.save(savedWorkOrder);
            return savedWorkOrder.getFiles();
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/files/{id}/{fileId}/remove")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    public List<File> removeFileFromWorkOrder(@PathVariable("id") Long id,
                                              @PathVariable("fileId") Long fileId, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<WorkOrder> optionalWorkOrder = workOrderService.findById(id);
        if (optionalWorkOrder.isPresent()) {
            WorkOrder savedWorkOrder = optionalWorkOrder.get();
            if (!savedWorkOrder.canBeEditedBy(user))
                throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
            savedWorkOrder.getFiles().removeIf(file -> file.getId().equals(fileId));
            workOrderService.save(savedWorkOrder);
            return savedWorkOrder.getFiles();
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

}


