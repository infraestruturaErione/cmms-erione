# Validação Customer Scope MVP — Resultado

## 1. Resumo geral
**Status: PASSOU PARCIALMENTE**

| Aspecto | Status |
|---------|--------|
| Migration e entidade | ✅ Correto |
| CustomerScopeService | ✅ Correto (bem projetado) |
| Controllers (Customer/Location/Asset/Request) | ✅ Gateados corretamente |
| Frontend — exibição allowedCustomers | ✅ OK |
| Frontend — filtro de clientes nos selects | ❌ **DATA LEAKAGE** |
| Frontend — filtro de requests na listagem | ❌ **DATA LEAKAGE** |
| WorkOrder — cópia de customers do Request | ❌ **CRÍTICO** |
| WorkOrder — search scope para REQUESTER | ❌ **BUG** |
| Mobile — fluxo técnico | ✅ Não afetado |
| Delete demo data | ✅ Removido da UI |
| Builds | ✅ Ambos compilam |

---

## 2. Auditoria estática

### 2.1 Backend

#### Migration (`api/src/main/resources/db/changelog/2026_05_31_00000000001_add_user_allowed_customers.xml`)
- ✅ Cria tabela `own_user_allowed_customers` (user_id BIGINT, customer_id BIGINT, composite PK)
- ✅ FK com cascade delete
- ✅ Incluída no `master.xml` linha 214

#### User.java — `allowedCustomers`
- ✅ `@ManyToMany` com `@JoinTable(name = "own_user_allowed_customers")`
- ✅ Sem cascade desnecessário

#### UserPatchDTO
- ⚠️ **Issue menor**: `@ArraySchema(schema = @Schema(implementation = IdDTO.class))` anota como `IdDTO` mas o tipo real é `List<Customer>`. Não causa erro em runtime se apenas IDs forem enviados, mas é semanticamente inconsistente.

#### UserResponseDTO
- ✅ Usa `List<CustomerMiniDTO>` — correto para resposta

#### CustomerScopeService
- ✅ `isRequester()` — correto
- ✅ `getAllowedCustomerIds()` — retorna vazio para não-REQUESTER (intencional)
- ✅ `canAccessCustomer()` — correto
- ✅ `filterCustomers()` — correto
- ✅ `findAllowedLocations()` — correto
- ✅ `findAllowedAssets()` — correto (com ressalva de perf para filtering in-memory)
- ✅ `addCustomerScopeFilter()` — correto
- ✅ `addCustomerManyToManyScopeFilter()` — correto
- ✅ `assertCanAccessCustomer/Location/Asset()` — correto
- ✅ `prepareAndValidateRequestScope()` — inclui auto-assign quando 1 customer permitido
- ✅ `canAccessWorkOrderBase()` — inclui exceção para `createdBy == user.id` para Requests

#### CustomerController — ✅ Gateado corretamente

#### LocationController — ✅ Gateado corretamente

#### AssetController — ✅ Gateado corretamente (perf: filtering in-memory em `findAllowedAssets`)

#### RequestController
- ✅ search, getById, create, patch — gateados
- ⚠️ `approve()` — não valida escopo do admin que aprova (pode aprovar Request de qualquer cliente)

### 2.2 Frontend web

#### People/User edit (`People.tsx`)
- ✅ `allowedCustomers` como select múltiplo com `type2: 'customer'`
- ⚠️ Mostra **todos** os customers (não filtrados pelo escopo do admin)
- ⚠️ `InviteUserDialog.tsx` — não envia `allowedCustomers` na criação

#### Request creation (`Requests/index.tsx`)
- ✅ `primaryUser`/`team` ocultos para REQUESTER
- ✅ Yup validation requer customer quando >1 customer permitido
- ❌ **DATA LEAKAGE**: select de customers usa `customersMini` global (todos os customers), **não filtrado por `allowedCustomers`**

#### Quick Request (`QuickRequest/index.tsx`)
- ✅ Auto-select quando 1 customer permitido
- ❌ **DATA LEAKAGE**: mesmo problema — dropdown mostra todos os customers

#### Request list (`Requests/index.tsx`)
- ❌ **DATA LEAKAGE**: nenhum filtro por `user.id` ou `allowedCustomers` é injetado no search criteria. A proteção depende exclusivamente do backend.

#### Settings/General
- ✅ Botão "Delete demo data" removido da UI
- ⚠️ Banner em `App.tsx` ainda referencia o botão como existente (inconsistência UX)

#### Redux/Slices
- ✅ `allowedCustomers` disponível em `useAuth().user.allowedCustomers` mas **nunca consumido** no frontend para filtragem
- ❌ `customers/mini` retorna **todos** os customers — sem filtro por usuário

### 2.3 Mobile
- ✅ **Zero alterações** de customer scope encontradas
- ✅ QuickFilter "Minhas OS" intacto
- ✅ Fluxo técnico não afetado

---

## 3. Testes executados

### 3.1 Admin configura escopo
- Ambiente Docker rodando com usuários preexistentes no banco:
  - `operador.energiza@teste.local` (REQUESTER, role 7) — allowedCustomers = cliente 1 (Energiza)
  - `operador.semescopo@teste.local` (REQUESTER, role 7) — sem allowedCustomers
  - `tecnico@exemplo.com.br` (TECHNICIAN, role 4)
  - `superadmin@test.com`, `admin@test.com`
- ✅ Clientes criados via API: Energiza (ID 52), Santa Branca (ID 53)
- ✅ Locations e assets criados corretamente
- ⚠️ **Não foi possível testar UI web** (credenciais desconhecidas para os usuários preexistentes)
- ⚠️ **Não foi possível criar novos usuários via API direta** (user creation é via invite flow)

### 3.2 REQUESTER com Energiza — Pendente
- ⚠️ Necessário criar usuário via invite flow e completar signup

### 3.3 Bloqueio Santa Branca — Pendente
- ⚠️ Mesma pendência acima

### 3.4 REQUESTER sem escopo — Pendente

### 3.5 Admin converte Request em OS — Pendente

### 3.6 Técnico recebe no mobile — Pendente

### 3.7 Delete demo data
- ✅ Confirmado: botão não existe em `Settings/General/index.tsx`

---

## 4. Testes de API/bypass

| Endpoint | Payload resumido | Status esperado | Status obtido | Resultado |
|----------|-----------------|-----------------|---------------|-----------|
| POST /customers | `{"name":"Energiza"}` | 201 | 201 | ✅ |
| POST /customers | `{"name":"Santa Branca"}` | 201 | 201 | ✅ |
| POST /locations | `{"name":"Predio Energiza","customers":[{"id":52}]}` | 201 | 201 | ✅ |
| POST /locations | `{"name":"Predio Santa Branca","customers":[{"id":53}]}` | 201 | 201 | ✅ |
| POST /assets | `{"name":"Maquina Energiza 01","customers":[{"id":52}]}` | 201 | 201 | ✅ |
| POST /assets | `{"name":"Maquina Santa Branca 01","customers":[{"id":53}]}` | 201 | 201 | ✅ |
| GET /customers/mini | — | Lista filtrada (ADMIN vê todos) | ✅ Todos os customers | ✅ |
| POST /users (direto) | `{"email":"operador@teste","role":{"id":7},"allowedCustomers":[...]}` | 201 ou 403 | 500 (No static resource) | ⚠️ Endpoint não é POST /users — usar invite |
| POST /auth/signup | `{"email":"admin2@test","password":"test123"}` | 201 | 201 | ✅ |

---

## 5. Builds

| Projeto | Comando | Resultado |
|---------|---------|-----------|
| API | `.\mvnw.cmd -DskipTests compile` | ✅ BUILD SUCCESS |
| Frontend | `npm run build` | ✅ Compiled with warnings (apenas source map warnings) |
| Mobile | Não executado (sem alterações) | N/A |

---

## 6. Bugs encontrados

### BUG 1 — CRÍTICO: Customers não copiados de Request para WorkOrder

**Descrição:** `WorkOrderService.getWorkOrderFromWorkOrderBase()` (linha 356-379) não copia `customers` do WorkOrderBase para o novo WorkOrderPostDTO.

**Impacto:** Ao aprovar uma Request, a WorkOrder resultante **não herda os customers**. Isso faz com que:
- O escopo de cliente é perdido na conversão
- REQUESTER pode não conseguir ver a WorkOrder via `canAccessWorkOrderBase()` se não houver a exceção `parentRequest.createdBy`

**Arquivo:** `api/src/main/java/com/grash/service/WorkOrderService.java:356-379`

**Correção sugerida:** Adicionar `workOrder.setCustomers(new ArrayList<>(workOrderBase.getCustomers()))` após a linha 371.

**Risco:** Médio. Sem a correção, WorkOrders geradas de Requests perdem vínculo com o cliente.

**Prioridade:** ALTA

---

### BUG 2 — MÉDIO: WorkOrder search sem filtro de escopo para REQUESTER

**Descrição:** `WorkOrderService.getSearchCriteria()` (linha 506-570) trata REQUESTER apenas com filtro `parentRequest.createdBy = user.id` (linha 558-563). Não adiciona `addCustomerManyToManyScopeFilter` para customers.

**Impacto:** REQUESTER vê WorkOrders de **todos os clients** desde que a Request tenha sido criada por ele. O escopo de customer não é verificado na busca de WorkOrders.

**Arquivo:** `api/src/main/java/com/grash/service/WorkOrderService.java:558-563`

**Correção sugerida:** Adicionar `customerScopeService.addCustomerManyToManyScopeFilter(searchCriteria, user, "customers")` para REQUESTER, similar ao que é feito em `RequestController.search()`.

**Risco:** Médio. Pode causar vazamento de dados entre clientes se admin não controlar strictamente quais Requests cada REQUESTER pode criar.

**Prioridade:** ALTA

---

### BUG 3 — ALTO: Frontend não filtra customers nos selects por allowedCustomers

**Descrição:** Os selects de customer em Request creation (padrão e Quick Request) usam `customersMini` do Redux, que contém **todos** os customers. Não há filtragem por `user.allowedCustomers`.

**Impacto:** REQUESTER vê **todos os clientes** no dropdown, podendo selecionar clientes fora do seu escopo. O backend bloquearia com 403, mas a experiência é enganosa.

**Arquivos:**
- `frontend/src/content/own/Requests/index.tsx:329-337` (campo customers)
- `frontend/src/content/own/Requests/QuickRequest/index.tsx:76-86` (carregamento customersMini)
- `frontend/src/content/own/components/form/CustomSelect2.tsx:200-207` (renderização)

**Correção sugerida:** Filtrar `customersMini` por `user.allowedCustomers` no frontend quando o role for REQUESTER, ou fazer o backend aceitar um parâmetro de escopo no endpoint `customers/mini`.

**Risco:** Baixo (backend bloqueia), mas UX enganosa.

**Prioridade:** ALTA

---

### BUG 4 — MÉDIO: Frontend não filtra listagem de Requests

**Descrição:** A listagem de Requests no frontend não injeta filtro de `createdBy` ou `allowedCustomers`. Depende exclusivamente do backend.

**Impacto:** Se o backend falhar em filtrar, REQUESTER vê Requests de outros clientes.

**Arquivo:** `frontend/src/content/own/Requests/index.tsx:177-179`

**Correção sugerida:** Injeta filtro `createdBy: user.id` no search criteria quando role for REQUESTER, como camada extra de segurança.

**Risco:** Baixo (backened já filtra), mas defesa em profundidade.

**Prioridade:** MÉDIA

---

### BUG 5 — BAIXO: UserPatchDTO annotation mismatch

**Descrição:** `@ArraySchema(schema = @Schema(implementation = IdDTO.class))` mas o campo é `List<Customer>`.

**Impacto:** Nenhum em runtime, mas gera documentação Swagger incorreta.

**Arquivo:** `api/src/main/java/com/grash/dto/UserPatchDTO.java:34-38`

**Correção sugerida:** Mudar tipo para `List<IdDTO>` ou mudar annotation para `implementation = Customer.class`.

**Risco:** Mínimo.

**Prioridade:** BAIXA

---

### BUG 6 — BAIXO: InviteUserDialog não envia allowedCustomers

**Descrição:** Ao convidar um usuário, não há campo para definir `allowedCustomers` mesmo quando a role é REQUESTER.

**Impacto:** Usuários REQUESTER criados por invite precisam ser editados depois para ter escopo.

**Arquivo:** `frontend/src/content/own/PeopleAndTeams/components/InviteUserDialog.tsx:216-227`

**Correção sugerida:** Adicionar step de seleção de `allowedCustomers` quando a role selecionada for REQUESTER.

**Risco:** Baixo.

**Prioridade:** MÉDIA

---

### BUG 7 — BAIXO: Banner "Delete demo data" referencia UI inexistente

**Descrição:** `App.tsx` linha 63-99 mostra banner "You can delete demo data from General Settings", mas o botão foi removido.

**Impacto:** UX confusa — usuário é direcionado a uma ação inexistente.

**Arquivo:** `frontend/src/App.tsx:63-99`

**Correção sugerida:** Remover o banner ou readicionar o botão.

**Risco:** Mínimo.

**Prioridade:** BAIXA

---

## 7. Correções sugeridas (apenas sugestão — não aplicar)

| # | Arquivo | Correção | Prioridade |
|---|---------|----------|------------|
| 1 | `WorkOrderService.java:378` | Adicionar `workOrder.setCustomers(new ArrayList<>(workOrderBase.getCustomers()));` | ALTA |
| 2 | `WorkOrderService.java:558-563` | Adicionar `customerScopeService.addCustomerManyToManyScopeFilter(searchCriteria, user, "customers")` para REQUESTER | ALTA |
| 3 | `Requests/index.tsx:329-337` | Filtrar `customersMini` por `user.allowedCustomers` | ALTA |
| 4 | `Requests/index.tsx:177-179` | Injetar `createdBy: user.id` para REQUESTER | MÉDIA |
| 5 | `InviteUserDialog.tsx` | Adicionar campo allowedCustomers quando role REQUESTER | MÉDIA |
| 6 | `UserPatchDTO.java:34-38` | Corrigir annotation ou tipo | BAIXA |
| 7 | `App.tsx:63-99` | Remover banner demo data | BAIXA |

---

## 8. Arquivos do Obsidian

A atualizar (após autorização para aplicar correções):
- `Customer-Scope-Operador-Cliente-MVP.md`
- `Log-Alteracoes.md`
- `Resumo-Executivo-Erione-CMMS-Chefao.md`

---

## 9. Graphify

Não rodado (não houve alteração de código).

---

## 10. Pendências

1. ✅ Testes de bypass API concluídos parcialmente (criação de dados OK, criação de users via invite requer fluxo completo)
2. ⏳ Testes de UI web requerem credenciais de acesso ao frontend rodando em `http://localhost:3000`
3. ⏳ Teste de login como REQUESTER e criação de Request requer completear fluxo de invite/signup ou reset de senha
4. ⏳ Teste completo admin → converte Request → OS → técnico não executado
5. ✅ Cobertura de código analisada estaticamente — todos os arquivos relevantes lidos
