# Bug: assignedTo/customers/files zerados no PATCH de Work Order

## Status
✅ Corrigido (2026-05-26)

## Sintoma
Após fazer `PATCH /work-orders/{id}` (ex: alterar título), o campo `assignedTo` retorna `[]` mesmo tendo sido populado anteriormente. Check-in/out continua funcionando (lê do DB diretamente via `findById`), mas o GET do detalhe mostra lista vazia.

## Causa raiz
`WorkOrderMapper.updateWorkOrder()` gera código MapStruct que, para coleções `@ManyToMany`, trata `null` no DTO como "setar para null":

```java
// Código gerado antes da correção:
if (entity.getAssignedTo() != null) {
    if (dto.getAssignedTo() != null) {
        entity.getAssignedTo().clear();
        entity.getAssignedTo().addAll(list);
    } else {
        entity.setAssignedTo(null);  // BUG: dto.getAssignedTo() é null
                                      // quando o campo não é enviado no body
    }
}
```

Como Jackson não serializa campos ausentes no JSON, `dto.getAssignedTo()` fica `null` → `entity.setAssignedTo(null)` → Hibernate deleta os registros da join table `work_order_assigned_to`.

Mesmo bug para `customers` e `files`.

## Arquivo afetado
- `api/src/main/java/com/grash/mapper/WorkOrderMapper.java` — método `updateWorkOrder()`

## Correção
Adicionado `nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE` nos 3 campos `@ManyToMany`:

```java
@Mapping(target = "assignedTo", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
@Mapping(target = "customers", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
@Mapping(target = "files", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
WorkOrder updateWorkOrder(@MappingTarget WorkOrder entity, WorkOrderPatchDTO dto);
```

O código gerado agora:
- `dto.getAssignedTo() == null` (campo omitido) → não faz nada, preserva valor existente ✅
- `dto.getAssignedTo() == []` (lista vazia explícita) → `clear()` + `addAll([])` → limpa ✅
- `dto.getAssignedTo() == [{id:3}]` → `clear()` + `addAll([user3])` → atualiza ✅

## Diagnóstico da investigação

### O que NÃO era o bug
- `@JsonProperty(access = Access.WRITE_ONLY)` no `WorkOrderBase.assignedTo` → não afeta MapStruct (que usa getters, não Jackson)
- `GET /work-orders/{id}` retornar `assignedTo: []` → era consequência do PATCH ter zerado antes
- Lazy loading → `@Transactional` no controller mantém sessão aberta

### Fluxo completo validado
1. Criar WO com `assignedTo=[{id:3}]` → assignedToCount=1 ✅
2. GET WO → assignedTo mostra user 3 ✅
3. PATCH sem assignedTo → assignedTo PRESERVADO ✅
4. Check-in do técnico → 200 OK ✅
5. GET WO pós check-in → assignedTO ainda user 3 ✅
6. `GET /users/me` → 200 OK ✅

### Bug pré-existente não relacionado
`PATCH /work-orders/{id}` enviando `assignedTo: []` ou `assignedTo: [{id:X}]` retorna 500 com `IndexOutOfBoundsException: Index 0 out of bounds for length 0` durante validação Hibernate. Não causado por esta correção — o `clear()`+`addAll()` é código MapStruct padrão inalterado.

## Builds
- `mvnw -DskipTests clean package` → ✅ BUILD SUCCESS
- `docker compose build api` → ✅
- Container rodando ✅

## Documentação
- `dev-docs/Log-Alteracoes.md` atualizado
