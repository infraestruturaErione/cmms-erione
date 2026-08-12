package com.grash.controller;

import com.grash.dto.RelationPatchDTO;
import com.grash.dto.RelationPostDTO;
import com.grash.dto.SuccessResponse;
import com.grash.exception.CustomException;
import com.grash.model.User;
import com.grash.model.Relation;
import com.grash.model.WorkOrder;
import com.grash.service.CustomerScopeService;
import com.grash.service.RelationService;
import com.grash.service.UserService;
import com.grash.service.WorkOrderService;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.Collection;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/relations")
@Tag(name = "Relations", description = "Operations on work order relations")
@RequiredArgsConstructor
public class RelationController {

    private final RelationService relationService;
    private final UserService userService;
    private final WorkOrderService workOrderService;
    private final CustomerScopeService customerScopeService;


    @GetMapping("")
    @PreAuthorize("permitAll()")

    public Collection<Relation> getAll(HttpServletRequest req) {
        User user = userService.whoami(req);
        Long companyId = user.getCompany().getId();
        Collection<Relation> relations = relationService.findByCompany(companyId);
        if (customerScopeService.isRequester(user)) {
            // Relation expoe os DOIS lados (parent/child) como WorkOrder
            // completo, nao so o ID - uma relacao cujo outro lado e' de fora
            // do escopo vazaria titulo/dados dessa WO so por estar na lista.
            return relations.stream()
                    .filter(relation -> isRelationSideAccessible(relation.getParent(), user)
                            && isRelationSideAccessible(relation.getChild(), user))
                    .collect(Collectors.toList());
        }
        return relations;
    }

    @GetMapping("/work-order/{id}")
    @PreAuthorize("permitAll()")

    public Collection<Relation> getByWorkOrder(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        workOrderService.checkAccessToWorkOrderId(id, user);
        Collection<Relation> relations = relationService.findByWorkOrder(id);
        if (customerScopeService.isRequester(user)) {
            // O check acima so garante acesso ao lado "id" da URL - o OUTRO
            // lado de cada Relation (parent ou child, dependendo da direcao)
            // pode ser uma WO fora do escopo, e viria completa no payload.
            return relations.stream()
                    .filter(relation -> isRelationSideAccessible(relation.getParent(), user)
                            && isRelationSideAccessible(relation.getChild(), user))
                    .collect(Collectors.toList());
        }
        return relations;
    }

    // Mesmas 3 checagens de checkAccessToWorkOrderId (Company + isAccessibleBy
    // + customer scope), so que como predicado que NAO lanca excecao - usado
    // pra FILTRAR listas (getAll/getByWorkOrder) em vez de bloquear uma
    // unica requisicao inteira.
    private boolean isRelationSideAccessible(WorkOrder workOrder, User user) {
        return workOrder != null
                && workOrder.getCompany().getId().equals(user.getCompany().getId())
                && workOrder.isAccessibleBy(user)
                && customerScopeService.canAccessWorkOrderBase(user, workOrder);
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")

    public Relation getById(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Relation> optionalRelation = relationService.findById(id);
        if (optionalRelation.isPresent()) {
            Relation savedRelation = optionalRelation.get();
            checkAccessToRelation(savedRelation, user);
            return savedRelation;
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    @PostMapping("")
    @PreAuthorize("hasRole('ROLE_CLIENT')")
    Relation create(@Parameter(description = "Work order relation to create") @Valid @RequestBody RelationPostDTO relationReq, HttpServletRequest req) {
        User user = userService.whoami(req);
        Long parentId = relationReq.getParent().getId();
        Long childId = relationReq.getChild().getId();
        // Uma Relation liga DUAS WorkOrders - precisa validar acesso as duas,
        // senao um Requester poderia usar o lado que ele acessa pra criar um
        // vinculo (e descobrir a existencia) de uma WO fora do escopo dele.
        // checkWriteAccessToWorkOrderId (nao so leitura): so ACOMPANHAR uma
        // WO (ex.: Requester dono da Request que a originou) nao autoriza
        // criar relacoes administrativas entre WorkOrders.
        workOrderService.checkWriteAccessToWorkOrderId(parentId, user);
        workOrderService.checkWriteAccessToWorkOrderId(childId, user);
        if (relationService.findByParentAndChild(parentId, childId).isEmpty() && relationService.findByParentAndChild(childId, parentId).isEmpty()) {
            return relationService.createPost(relationReq, user);
        } else
            throw new CustomException("There already is a relation between these 2 Work Orders",
                    HttpStatus.NOT_ACCEPTABLE);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public Relation patch(@Parameter(description = "Relation fields to update") @Valid @RequestBody RelationPatchDTO relation,
                          @PathVariable("id") Long id,
                          HttpServletRequest req) {
        User user = userService.whoami(req);
        Optional<Relation> optionalRelation = relationService.findById(id);

        if (optionalRelation.isPresent()) {
            Relation savedRelation = optionalRelation.get();
            checkWriteAccessToRelation(savedRelation, user);
            // O patch pode mudar parent e/ou child pra uma WO DIFERENTE da
            // que foi validada acima (savedRelation e' o estado ANTIGO) -
            // sem isso, um Requester com uma Relation valida (ambos os lados
            // no escopo) poderia repatch-ar pra apontar pra uma WO fora do
            // escopo, criando um vinculo nao autorizado.
            if (relation.getParent() != null) {
                workOrderService.checkWriteAccessToWorkOrderId(relation.getParent().getId(), user);
            }
            if (relation.getChild() != null) {
                workOrderService.checkWriteAccessToWorkOrderId(relation.getChild().getId(), user);
            }
            return relationService.update(id, relation);
        } else {
            return null;
        }


    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_CLIENT')")

    public ResponseEntity delete(@PathVariable("id") Long id, HttpServletRequest req) {
        User user = userService.whoami(req);

        Optional<Relation> optionalRelation = relationService.findById(id);
        if (optionalRelation.isPresent()) {
            checkWriteAccessToRelation(optionalRelation.get(), user);
            relationService.delete(id);
            return new ResponseEntity(new SuccessResponse(true, "Deleted successfully"),
                    HttpStatus.OK);
        } else throw new CustomException("Relation not found", HttpStatus.NOT_FOUND);
    }

    // Uma Relation expoe 2 WorkOrders (parent/child) - se qualquer um dos
    // lados estiver fora do escopo do usuario, negar o acesso a Relation
    // inteira (senao o ID/existencia do lado inacessivel vaza mesmo assim).
    private void checkAccessToRelation(Relation relation, User user) {
        workOrderService.checkAccessToWorkOrderId(relation.getParent().getId(), user);
        workOrderService.checkAccessToWorkOrderId(relation.getChild().getId(), user);
    }

    // Leitura dos dois lados (checkAccessToRelation) NAO autoriza
    // editar/apagar a Relation - ver checkWriteAccessToWorkOrderId.
    private void checkWriteAccessToRelation(Relation relation, User user) {
        workOrderService.checkWriteAccessToWorkOrderId(relation.getParent().getId(), user);
        workOrderService.checkWriteAccessToWorkOrderId(relation.getChild().getId(), user);
    }

}


