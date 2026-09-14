package com.grash.controller;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.dto.SuccessResponse;
import com.grash.dto.TeamMiniDTO;
import com.grash.dto.TeamPatchDTO;
import com.grash.dto.TeamShowDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.TeamMapper;
import com.grash.model.User;
import com.grash.model.Team;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleType;
import com.grash.service.TeamService;
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

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.Collection;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/teams")
@Tag(name = "Teams", description = "Operations on teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;
    private final TeamMapper teamMapper;
    private final UserService userService;
    private final EntityManager em;

    @PostMapping("/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Page<TeamShowDTO>> search(@Parameter(description = "Search criteria for filtering teams") @RequestBody SearchCriteria searchCriteria,
                                                    HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)) {
            if (user.getRole().getViewPermissions().contains(PermissionEntity.PEOPLE_AND_TEAMS)) {
                searchCriteria.filterCompany(user);
            } else throw new CustomException("Access Denied", HttpStatus.FORBIDDEN);
        }
        return ResponseEntity.ok(teamService.findBySearchCriteria(searchCriteria));
    }

    @GetMapping("/mini")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public Collection<TeamMiniDTO> getMini(HttpServletRequest req) {
        User team = userService.whoami(req);
        return teamService.findByCompany(team.getCompany().getId()).stream().map(teamMapper::toMiniDto).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")

    public TeamShowDTO getById(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT) &&
                !user.getRole().getViewPermissions().contains(PermissionEntity.PEOPLE_AND_TEAMS)) {
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
        }
        Optional<Team> optionalTeam = user.getRole().getRoleType().equals(RoleType.ROLE_CLIENT)
                ? teamService.findByIdAndCompany(id, user.getCompany().getId())
                : teamService.findById(id);
        if (optionalTeam.isPresent()) {
            Team savedTeam = optionalTeam.get();
            return teamMapper.toShowDto(savedTeam);
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @PostMapping("")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    TeamShowDTO create(@Parameter(description = "Team data to create") @Valid @RequestBody Team teamReq,
                       HttpServletRequest req) {
        User user = userService.whoami(req);
        if (user.getRole().getCreatePermissions().contains(PermissionEntity.PEOPLE_AND_TEAMS)) {
            teamReq.setUsers(resolveMembers(teamReq.getUsers(), user));
            Team savedTeam = teamService.create(teamReq);
            teamService.notify(savedTeam, Helper.getLocale(user));
            return teamMapper.toShowDto(savedTeam);
        } else throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public TeamShowDTO patch(@Parameter(description = "Team fields to update") @Valid @RequestBody TeamPatchDTO team,
                             @PathVariable(
                                     "id") Long id,
                             HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Team> optionalTeam = teamService.findByIdAndCompany(id, user.getCompany().getId());
        if (optionalTeam.isPresent()) {
            Team savedTeam = optionalTeam.get();
            boolean canEdit = user.getId().equals(savedTeam.getCreatedBy()) ||
                    user.getRole().getEditOtherPermissions().contains(PermissionEntity.PEOPLE_AND_TEAMS);
            if (!canEdit) {
                throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
            }
            if (team.getUsers() != null) {
                team.setUsers(resolveMembers(team.getUsers(), user));
            }
            em.detach(savedTeam);
            Team patchTeam = teamService.update(id, team);
            teamService.patchNotify(savedTeam, patchTeam, Helper.getLocale(user));
            return teamMapper.toShowDto(patchTeam);
        } else throw new CustomException("Team not found", HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public ResponseEntity delete(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);

        Optional<Team> optionalTeam = teamService.findByIdAndCompany(id, user.getCompany().getId());
        if (optionalTeam.isPresent()) {
            Team savedTeam = optionalTeam.get();
            if (user.getId().equals(savedTeam.getCreatedBy()) || user.getRole().getDeleteOtherPermissions().contains(PermissionEntity.PEOPLE_AND_TEAMS)) {
                teamService.delete(id);
                return new ResponseEntity(new SuccessResponse(true, "Deleted successfully"),
                        HttpStatus.OK);
            } else throw new CustomException("Forbidden", HttpStatus.FORBIDDEN);
        } else throw new CustomException("Team not found", HttpStatus.NOT_FOUND);
    }

    /**
     * Resolve member references inside the requester's tenant instead of
     * trusting deserialized User entities supplied by the client. Team
     * membership grants operational access to assigned work orders, so a
     * foreign or disabled user must never be attached by raw ID.
     */
    private List<User> resolveMembers(Collection<User> memberReferences, User requester) {
        if (memberReferences == null) return new ArrayList<>();
        LinkedHashSet<Long> memberIds = new LinkedHashSet<>();
        for (User memberReference : memberReferences) {
            if (memberReference == null || memberReference.getId() == null) {
                throw new CustomException("Invalid team member", HttpStatus.NOT_ACCEPTABLE);
            }
            memberIds.add(memberReference.getId());
        }
        List<User> members = new ArrayList<>();
        for (Long memberId : memberIds) {
            User member = userService.findByIdAndCompany(memberId, requester.getCompany().getId())
                    .filter(User::isEnabled)
                    .orElseThrow(() -> new CustomException("Invalid team member", HttpStatus.NOT_ACCEPTABLE));
            members.add(member);
        }
        return members;
    }

}
