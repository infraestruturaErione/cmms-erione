package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.workOrder.report.WorkOrderOperationalReportRequestDTO;
import com.grash.dto.workOrder.report.WorkOrderOperationalReportResponseDTO;
import com.grash.dto.workOrder.report.WorkOrderOperationalReportRowDTO;
import com.grash.dto.workOrder.report.WorkOrderOperationalReportSummaryDTO;
import com.grash.model.Comment;
import com.grash.model.Customer;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.enums.Status;
import com.grash.repository.CommentRepository;
import jakarta.persistence.criteria.JoinType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkOrderOperationalReportService {
    private static final String FIELD_REPORT_PREFIX = "[Relato em campo]";

    private final WorkOrderService workOrderService;
    private final CommentRepository commentRepository;

    public WorkOrderOperationalReportResponseDTO buildReport(WorkOrderOperationalReportRequestDTO request, User user) {
        SearchCriteria criteria = buildCriteria(request);
        Page<WorkOrder> workOrders = workOrderService.findBySearchCriteria(workOrderService.getSearchCriteria(user,
                criteria));
        Map<Long, String> fieldReports = getLatestFieldReports(workOrders.getContent());
        List<WorkOrderOperationalReportRowDTO> rows = workOrders.getContent().stream()
                .map(workOrder -> toRow(workOrder, fieldReports.get(workOrder.getId())))
                .collect(Collectors.toList());

        return WorkOrderOperationalReportResponseDTO.builder()
                .rows(rows)
                .summary(buildSummary(rows))
                .page(WorkOrderOperationalReportResponseDTO.PageInfo.builder()
                        .totalElements(workOrders.getTotalElements())
                        .totalPages(workOrders.getTotalPages())
                        .pageNum(workOrders.getNumber())
                        .pageSize(workOrders.getSize())
                        .build())
                .build();
    }

    private SearchCriteria buildCriteria(WorkOrderOperationalReportRequestDTO request) {
        WorkOrderOperationalReportRequestDTO safeRequest = request == null ? new WorkOrderOperationalReportRequestDTO() :
                request;
        SearchCriteria source = safeRequest.getSearchCriteria() == null ? new SearchCriteria() :
                safeRequest.getSearchCriteria();
        SearchCriteria criteria = new SearchCriteria();
        criteria.setDirection(source.getDirection());
        criteria.setPageNum(source.getPageNum());
        criteria.setPageSize(source.getPageSize());
        criteria.setSortField(source.getSortField());
        criteria.setFilterFields(source.getFilterFields() == null ? new ArrayList<>() : new ArrayList<>(source
                .getFilterFields()));
        normalizeFilterAliases(criteria);
        addPeriodFilters(criteria, safeRequest);
        return criteria;
    }

    private void normalizeFilterAliases(SearchCriteria criteria) {
        criteria.getFilterFields().forEach(filterField -> {
            if ("customer".equals(filterField.getField())) {
                filterField.setField("customers");
                if (filterField.getJoinType() == null) {
                    filterField.setJoinType(JoinType.LEFT);
                }
            }
        });
    }

    private void addPeriodFilters(SearchCriteria criteria, WorkOrderOperationalReportRequestDTO request) {
        String periodField = request.getPeriodField() == null ? "createdAt" : request.getPeriodField().getFieldName();
        if (request.getStart() != null) {
            criteria.getFilterFields().add(FilterField.builder()
                    .field(periodField)
                    .operation("ge")
                    .value(request.getStart())
                    .values(new ArrayList<>())
                    .build());
        }
        if (request.getEnd() != null) {
            criteria.getFilterFields().add(FilterField.builder()
                    .field(periodField)
                    .operation("le")
                    .value(request.getEnd())
                    .values(new ArrayList<>())
                    .build());
        }
    }

    private Map<Long, String> getLatestFieldReports(List<WorkOrder> workOrders) {
        List<Long> workOrderIds = workOrders.stream().map(WorkOrder::getId).collect(Collectors.toList());
        if (workOrderIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> result = new LinkedHashMap<>();
        commentRepository.findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(workOrderIds,
                        FIELD_REPORT_PREFIX)
                .forEach(comment -> result.putIfAbsent(comment.getWorkOrder().getId(),
                        stripFieldReportPrefix(comment.getContent())));
        return result;
    }

    private String stripFieldReportPrefix(String content) {
        if (content == null) {
            return null;
        }
        return content.substring(FIELD_REPORT_PREFIX.length()).trim();
    }

    private WorkOrderOperationalReportRowDTO toRow(WorkOrder workOrder, String fieldReport) {
        return WorkOrderOperationalReportRowDTO.builder()
                .id(workOrder.getId())
                .customId(workOrder.getCustomId())
                .title(workOrder.getTitle())
                .description(workOrder.getDescription())
                .customerNames(workOrder.getCustomers() == null ? List.of() : workOrder.getCustomers().stream()
                        .map(Customer::getName)
                        .collect(Collectors.toList()))
                .locationName(workOrder.getLocation() == null ? null : workOrder.getLocation().getName())
                .assetName(workOrder.getAsset() == null ? null : workOrder.getAsset().getName())
                .technicianName(getTechnicianName(workOrder))
                .priority(workOrder.getPriority())
                .status(workOrder.getStatus())
                .createdAt(workOrder.getCreatedAt())
                .completedOn(workOrder.getCompletedOn())
                .departureAt(workOrder.getDepartureAt())
                .checkInAt(workOrder.getCheckInAt())
                .checkOutAt(workOrder.getCheckOutAt())
                .travelDurationSeconds(diffSeconds(workOrder.getDepartureAt(), workOrder.getCheckInAt()))
                .siteDurationSeconds(diffSeconds(workOrder.getCheckInAt(), workOrder.getCheckOutAt()))
                .totalFieldDurationSeconds(diffSeconds(workOrder.getDepartureAt(), workOrder.getCheckOutAt()))
                .fieldReport(fieldReport)
                .filesCount(workOrder.getFiles() == null ? 0 : workOrder.getFiles().size())
                .hasImage(workOrder.getImage() != null)
                .hasSignature(workOrder.getSignature() != null && !workOrder.getSignature().isBlank())
                .build();
    }

    private String getTechnicianName(WorkOrder workOrder) {
        if (workOrder.getPrimaryUser() != null) {
            return workOrder.getPrimaryUser().getFullName();
        }
        if (workOrder.getAssignedTo() == null || workOrder.getAssignedTo().isEmpty()) {
            return null;
        }
        return workOrder.getAssignedTo().stream()
                .filter(Objects::nonNull)
                .map(User::getFullName)
                .collect(Collectors.joining(", "));
    }

    private Long diffSeconds(Date start, Date end) {
        if (start == null || end == null) {
            return null;
        }
        long diff = (end.getTime() - start.getTime()) / 1000;
        return diff < 0 ? null : diff;
    }

    private WorkOrderOperationalReportSummaryDTO buildSummary(List<WorkOrderOperationalReportRowDTO> rows) {
        return WorkOrderOperationalReportSummaryDTO.builder()
                .total(rows.size())
                .open(countStatus(rows, Status.OPEN))
                .enRoute(countStatus(rows, Status.EN_ROUTE))
                .inProgress(countStatus(rows, Status.IN_PROGRESS))
                .onHold(countStatus(rows, Status.ON_HOLD))
                .complete(countStatus(rows, Status.COMPLETE))
                .withCheckIn(rows.stream().filter(row -> row.getCheckInAt() != null).count())
                .withCheckOut(rows.stream().filter(row -> row.getCheckOutAt() != null).count())
                .withFieldReport(rows.stream().filter(row -> row.getFieldReport() != null && !row.getFieldReport()
                        .isBlank()).count())
                .withAttachments(rows.stream().filter(row -> row.getFilesCount() > 0 || row.isHasImage()).count())
                .withSignature(rows.stream().filter(WorkOrderOperationalReportRowDTO::isHasSignature).count())
                .build();
    }

    private long countStatus(List<WorkOrderOperationalReportRowDTO> rows, Status status) {
        return rows.stream().filter(row -> row.getStatus() == status).count();
    }
}
