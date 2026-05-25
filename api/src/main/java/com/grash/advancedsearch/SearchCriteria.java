package com.grash.advancedsearch;


import com.grash.model.Customer;
import com.grash.model.User;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.criteria.JoinType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Sort.Direction;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Search criteria for filtering and paginating work orders")
public class SearchCriteria implements Cloneable {
    @Schema(description = "List of filter conditions to apply to the search")
    private List<FilterField> filterFields = new ArrayList<>();
    @Schema(description = "Sort direction for the results", allowableValues = {"ASC", "DESC"})
    private Direction direction = Direction.ASC;
    @Schema(description = "Page number for pagination (0-based)")
    private int pageNum = 0;
    @Schema(description = "Number of results per page")
    private int pageSize = 10;
    @Schema(description = "Field name to sort the results by")
    private String sortField = "id";

    public void filterCompany(User user) {
        this.filterFields.add(FilterField.builder()
                .field("company")
                .value(user.getCompany().getId())
                .operation("eq")
                .values(new ArrayList<>()).build());
    }

    public void filterCreatedBy(User user) {
        this.filterFields.add(FilterField.builder()
                .field("createdBy")
                .value(user.getId())
                .operation("eq")
                .values(new ArrayList<>()).build());
    }

    public void filterByCustomers(User user) {
        if (user.getCustomers() != null && !user.getCustomers().isEmpty()) {
            this.filterFields.add(FilterField.builder()
                    .field("customers")
                    .operation("inm")
                    .value("")
                    .values(user.getCustomers().stream().map(c -> (Object) c.getId()).collect(Collectors.toList()))
                    .build());
            FilterField last = this.filterFields.get(this.filterFields.size() - 1);
            last.setJoinType(JoinType.LEFT);
        }
    }

    @Override
    public SearchCriteria clone() {
        SearchCriteria result;
        try {
            result = (SearchCriteria) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new RuntimeException("Cloning failed", e);
        }
        result.filterFields = new ArrayList<>(this.filterFields);
        return result;
    }

}
