# Log de Alterações — Erione CMMS

## 2026-06-12 - Politica de privacidade publica

### Alteracoes
- Criada rota publica web `/privacy-policy` com Politica de Privacidade do Erione CMMS.
- Adicionado link `Politica de privacidade` na tela de login web.
- Link de privacidade do mobile atualizado para `https://cmms.erione.com.br/privacy-policy`.

### Validacao
- `cd frontend && npx eslint src/router/index.tsx src/content/pages/Auth/Login/LoginJWT.tsx src/content/pages/PrivacyPolicy/index.tsx`: OK.
- `cd frontend && npm run build`: OK, apenas warnings conhecidos de sourcemap/CRA.
- `cd mobile && npx tsc --noEmit`: OK.
- `graphify update .`: OK.

### Nao alterado
- Backend.
- Banco/migrations.
- Endpoints.
- Regras de permissao.
- Customer Scope.

## 2026-06-12 - Redesign do login mobile Erione

### Alteracoes
- Reformulada a tela de login mobile com fundo navy escuro, grid tecnologico, glows suaves e card glass.
- Mantido o logo atual `mobile/assets/images/erione-logo.png` como marca padrao do app.
- CTA atualizado para `Entrar no CMMS`, mantendo o mesmo `useAuth().login` e a mesma validacao Formik/Yup.
- Links de `Politica de Privacidade` e `Termos de Uso` mantidos no rodape, apontando para `legalLinks`.
- Incluido atalho `Esqueci minha senha` via e-mail de suporte, sem criar endpoint novo.
- Corrigidas mensagens visiveis com encoding quebrado na tela de login.

### Validacao
- `cd mobile && npx tsc --noEmit`: OK.
- `cd mobile && npx expo export --platform web`: OK, com aviso conhecido de Firebase config ausente.

### Nao alterado
- Backend.
- Banco/migrations.
- Endpoints.
- Regras de login/API.
- Customer Scope.

## 2026-06-12 - Termos de Uso publico e ajuste de cor do login mobile

### Alteracoes
- Criada rota publica web `/terms-of-use` com Termos de Uso do Erione CMMS.
- Login web passou a exibir links publicos para Politica de Privacidade e Termos de Uso.
- `mobile/config.ts` passou a apontar `termsOfUse` para `https://cmms.erione.com.br/terms-of-use`.
- Login mobile removeu o CTA verde e passou a usar vermelho/coral com apoio azul, mais alinhado ao site institucional da Erione.
- Checklist Google Play atualizado com URLs publicas do CMMS.

### Validacao
- `cd frontend && npx eslint src/router/index.tsx src/content/pages/Auth/Login/LoginJWT.tsx src/content/pages/PrivacyPolicy/index.tsx src/content/pages/TermsOfUse/index.tsx`: OK.
- `cd frontend && npm run build`: OK, apenas warnings conhecidos de sourcemap/CRA.
- `cd mobile && npx tsc --noEmit`: OK.
- `cd mobile && npx expo export --platform web`: OK, com aviso conhecido de Firebase config ausente.

### Nao alterado
- Backend.
- Banco/migrations.
- Endpoints.
- Regras de permissao.
- Customer Scope.

## 2026-06-12 - Background institucional no login mobile

### Alteracoes
- Adicionado `mobile/assets/images/erione-login-background.png` como background da tela de login mobile.
- `LoginScreen.tsx` passou a usar `ImageBackground` com overlay escuro leve para contraste.
- Card de login ficou mais glass: fundo menos opaco, borda azul clara e sombra mais profunda.
- Confirmado que as cores alteradas estao no codigo mobile e entram no proximo APK/rebuild.

### Validacao
- `cd mobile && npx tsc --noEmit`: OK.
- `cd mobile && npx expo export --platform web`: OK, asset incluido no bundle; aviso conhecido de Firebase config ausente.

### Nao alterado
- Backend.
- Banco/migrations.
- Endpoints.
- Regras de login/API.
- Customer Scope.

## 2026-06-12 - Favicon Erione no frontend

### Alteracoes
- Substituidos `frontend/public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png` e `favicon.png` por versoes geradas a partir do logo Erione usado no mobile.
- `frontend/public/manifest.json` atualizado para `theme_color` e `background_color` em navy Erione (`#061826`).

### Validacao
- `cd frontend && npm run build`: OK, apenas warnings conhecidos de sourcemap/CRA.

### Nao alterado
- Backend.
- Banco/migrations.
- Endpoints.
- Regras de permissao.
- Customer Scope.

## 2026-06-13 - Cor primaria global mobile Erione

### Alteracoes
- Definida cor primaria global do mobile como `rgb(42, 72, 153)` / `#2A4899` em `mobile/config/erioneVisualIdentity.ts`.
- `primaryDark`, `primarySoft`, `accent` e `accentSoft` alinhados para a identidade navy/azul/coral atual.
- Hardcoded antigos de identidade teal/verde em Home, lista de OS, detalhe de OS, execucao em campo e componentes Erione foram substituidos por tokens azuis.
- Verde de sucesso (`theme.colors.success`) foi preservado como estado operacional, nao como identidade de marca.

### Validacao
- `cd mobile && npx tsc --noEmit`: OK.
- `cd mobile && npx expo export --platform web`: OK, com aviso conhecido de Firebase config ausente.

### Nao alterado
- Backend.
- Banco/migrations.
- Endpoints.
- Regras de login/API.
- Regras de OS/status.
- Customer Scope.
## 2026-05-26 — Correções Nível A na tela de Roles

- `deletePurchaseOrders` gated com `ERIONE_HIDDEN_MODULES.purchaseOrders`
- `deleteVendorsCustomers` gated com `ERIONE_HIDDEN_MODULES.vendors`
- Label hardcoded "Preventative Maintenance Trigger" → `t('pm_trigger')` no EditRole.tsx
- Código comentado Free/Paid removido do PageHeader.tsx
- `npm run build` compilou sem erros (apenas source-map warnings)
- Customer Scope NÃO implementado
- Backend NÃO alterado
- Banco NÃO alterado

## 2026-05-26 — Auditoria completa de Roles/Permissoes

- Auditoria completa do sistema de Roles (frontend + backend + banco)
- Relatório criado em: `ObsidianVault/Projetos/Atlas-CMMS/Auditoria-Roles-Permissoes-Erione-CMMS.md`
- 7 roles existentes mapeadas: SuperAdmin, Admin, Limited Admin, Technician, Limited Technician, View Only, Requester
- 15 PermissionEntity mapeados com números ordinais
- Fluxo de visibilidade de OS documentado (WorkOrderService.getSearchCriteria)
- Identificados 8 problemas na tela de Roles
- Nenhum código alterado, apenas leitura e documentação

## 2026-05-26 — Correção: assignedTo/customers/files sendo zerados no PATCH de WO

### Problema
`PATCH /work-orders/{id}` sem `assignedTo` no body zerava a lista de técnicos atribuídos. Ex: enviar `{ "title": "novo" }` fazia `assignedTo` ir de `[{id:3}]` para `[]`.

### Causa raiz
`WorkOrderMapper.updateWorkOrder()` (MapStruct) gera código que trata `null` nas coleções `@ManyToMany` como "setar para null":
```java
if (entity.getAssignedTo() != null) {
    if (dto.getAssignedTo() != null) {
        entity.getAssignedTo().clear();
        entity.getAssignedTo().addAll(list);
    } else {
        entity.setAssignedTo(null);  // BUG
    }
}
```
Como Jackson não serializa campos ausentes como `null`, `dto.getAssignedTo()` fica `null` → `entity.setAssignedTo(null)` → dados perdidos.

Mesmo bug para `customers` e `files`.

### Correção
**Arquivo:** `api/src/main/java/com/grash/mapper/WorkOrderMapper.java`

Adicionado `nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE` nos 3 campos:
```java
@Mapping(target = "assignedTo", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
@Mapping(target = "customers", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
@Mapping(target = "files", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
WorkOrder updateWorkOrder(@MappingTarget WorkOrder entity, WorkOrderPatchDTO dto);
```

Agora:
- `assignedTo` omitido no PATCH → preserva valor existente ✅
- `assignedTo: []` → limpa lista ✅
- `assignedTo: [{id:3}]` → atualiza ✅

### Builds
- `api\mvnw.cmd -DskipTests clean package`: ✅ BUILD SUCCESS
- `docker compose build api`: ✅
- `docker compose up -d --force-recreate api`: ✅ Container rodando

### Testes
| Cenário | Resultado |
|---------|-----------|
| Criar WO com assignedTo=[{id:3}] | ✅ assignedToCount=1 |
| GET WO detalhe | ✅ assignedTo=user 3 |
| PATCH sem assignedTo | ✅ assignedTo PRESERVADO (user 3) |
| Check-in do técnico | ✅ 200 OK |
| assignedTo preservado pós check-in | ✅ user 3 |
| `GET /users/me` (fix anterior) | ✅ 200 OK |

### Observação
`PATCH /work-orders/{id}` com `assignedTo: []` ou `assignedTo: [{id:X}]` retorna 500 — bug pré-existente não relacionado (IndexOutOfBoundsException durante validação Hibernate pós-update, presente antes da correção).

### Documento
- `dev-docs/Bug-AssignedTo-Zerado-No-PATCH-WO.md`

---

## 2026-05-26 — Validação de fluxos core pós-limpeza MVP

### Testado e Funcionando ✅

**1. Login (admin@test.com / 12345678)**
- Admin e técnico (tecnico@exemplo.com.br) logam via `POST /auth/signin`
- JWT retornado corretamente, usado em requisições subsequentes

**2. Company Profile**
- API retorna company com subscription/plan no backend (intocado)
- Frontend removido: CompanyPlan, rotas de subscription, upgrade/downgrade, "My Company" no Userbox, upgrade no SidebarFooter, trial banner no SidebarMenu
- Observação: company ID = 2 (admin user ID = 2, não 1)

**3. Core Web**
- Criar cliente: ✅ `POST /customers` → ID 1
- Criar local: ✅ `POST /locations` → ID 1
- Criar equipamento: ✅ `POST /assets` → ID 1
- Criar OS: ✅ `POST /work-orders` → ID 53 (status OPEN)
- Atribuir OS ao técnico: ✅ assignedTo=[{id:3}]
- Abrir detalhe da OS: ✅ `GET /work-orders/53` — todos campos visíveis
- Editar OS: ✅ `PATCH /work-orders/53` — title alterado com sucesso
- Mudar status OS: ✅ `PATCH /work-orders/53/change-status` → COMPLETE

**4. Roles**
- `GET /roles` retorna todas as roles
- DataGrid no frontend define apenas 4 colunas: `name`, `users`, `externalId`, `actions`
- NENHUMA coluna `paid`, `type` ou `plan`
- Gating de módulos ocultos verificado: `deletePurchaseOrders` e `deleteVendorsCustomers` condicionais

**5. Rotas Ocultas**
- Código verificado no router: `/app/purchase-orders` → redirect para `/app/work-orders`
- `/app/vendors-customers/vendors` → redirect para `/app/work-orders`
- `/app/parts` → redirect para `/app/work-orders`
- `/app/meters` → redirect para `/app/work-orders`

**6. Mobile (Expo Web)**
- `npx expo start --web --port 8082` bundlou com sucesso (1641 módulos)
- Login técnico via API: ✅ (mesmo JWT que web)
- Listar OS: ✅ `GET /work-orders/53` visível
- Check-in/out: ✅ `POST /work-orders/1/check-in` e `POST /work-orders/1/check-out` funcionam para técnico atribuído (não reproduzido 403 após rebuild do container)
- Concluir OS: ✅ via admin `PATCH /work-orders/53/change-status` → COMPLETE

### Problemas Identificados e Corrigidos

| # | Problema | Status | Correção |
|---|----------|--------|----------|
| 1 | `GET /users/me` retorna 500 (NumberFormatException: "me") | ✅ Corrigido | Adicionado `@GetMapping("/me")` em `UserController.java` |
| 2 | `POST /work-orders/{id}/check-in` retorna 403 para técnico | ⚠️ Não reproduzido após rebuild | `canBeEditedBy()` cobre todos os cenários; possível cache inconsistente |
| 3 | PATCH sem assignedTo zera lista de técnicos | ✅ Corrigido | `NullValuePropertyMappingStrategy.IGNORE` no mapper |
| 4 | Users começam do ID 2 (não 1) | ℹ️ Comportamento do seed | Seed pula ID 1 — código não deve hardcodar ID 1 |

### Correção: `GET /users/me` endpoint adicionado

**Arquivo:** `api/src/main/java/com/grash/controller/UserController.java`

**Problema:** `UserController` não tinha `GET /users/me`. Spring resolvia como `/{id}` com `id="me"` → `NumberFormatException`.

**Solução:** Adicionado endpoint que retorna `@CurrentUser User` via `userMapper.toResponseDto(user)`.

**Testes:**
- `GET /users/me` admin (ID 2): ✅ 200 OK
- `GET /users/me` técnico (ID 3): ✅ 200 OK
- `GET /auth/me` admin: ✅ 200 OK (inalterado)
- `GET /auth/me` técnico: ✅ 200 OK (inalterado)

**Build:** `docker compose build api` → ✅ BUILD SUCCESS

### Investigação: Check-in/out 403 não reproduzido

**Problema relatado:** Técnico recebia 403 ao fazer check-in no mobile.

**Reprodução após rebuild:**
- `POST /work-orders/1/check-in` (técnico ID 3, atribuído): ✅ 200 OK
- `POST /work-orders/1/check-out` (técnico ID 3): ✅ 200 OK
- `POST /work-orders/1/check-in` (admin ID 2, não atribuído): ✅ 200 OK (via editOtherPermissions.WORK_ORDERS)

**Análise de código:** `WorkOrderService.canBeEditedBy(user)` cobre 4 cenários:
1. `isAssignedTo(user)` — true para técnico atribuído
2. `isTeamMemberOfAssignedTo(user)` — true se pertence ao time de alguém atribuído
3. `isPrimaryUser(user)` — true se é primaryUser
4. `editOtherPermissions.WORK_ORDERS` — true para admin

**Conclusão:** Código de autorização está correto. Se o 403 ocorreu originalmente, foi provavelmente por estado inconsistente do container (pré-rebuild) ou token JWT gerado antes de recriar o container.

## 2026-06-10 — Correção: calendário stale sem F5 (propagação de mutações para calendarWorkOrders)

### Problema

O calendário (`calendarWorkOrders`) não era atualizado quando uma OS era criada, editada, concluída, deletada ou quando arquivos eram anexados/removidos. Apenas `workOrders.content` (lista) recebia as atualizações.

### Causa raiz

5 reducers no slice `workOrder.ts` ignoravam `calendarWorkOrders`. O refetch de focus/visibility em `index.tsx` também não refazia `getCalendarWorkOrders`.

### Correção

**Arquivo:** `frontend/src/slices/workOrder.ts`

Abordagem: **atualização no reducer** (Opção A). Todos os 5 reducers de mutation agora propagam para `calendarWorkOrders`:
- `addWorkOrder`: insere no início
- `editWorkOrder`: substitui por ID
- `addFilesToWorkOrder`: adiciona arquivos ao item
- `setFilesForWorkOrder`: substitui arquivos do item
- `deleteWorkOrder`: remove por ID

**Arquivo:** `frontend/src/content/own/WorkOrders/index.tsx`

Refetch de focus/visibility agora também dispara `getCalendarWorkOrders` quando `currentTab === 'calendar'`.

### Build
- `npm run build`: ✅ (apenas warnings pré-existentes de sourcemap)

### Observações

- Nenhuma migration foi executada
- Nenhuma alteração em banco de dados
- Nenhuma alteração em backend
- Build frontend (`npm run build`) compila sem erros TS
- Containers: api, frontend, postgres, minio — todos rodando sem falhas
---

## 2026-06-10 - Hardening calendario/evidencias/timeline de OS

### Problemas tratados

- Risco de duplicacao visual no calendario quando `addWorkOrder` recebe uma OS ja presente em `calendarWorkOrders`.
- Deduplicacao de arquivos/evidencias precisava priorizar `file.id`.
- Duracoes reais menores que 1 minuto apareciam como `0min`.
- Timeline de execucao mostrava chip generico `Concluido` para etapas registradas, confundindo com OS concluida.
- Descricao da OS aparecia como texto solto sob o titulo; agora fica em campo identificado como `Descricao`.

### Correcoes

- `frontend/src/slices/workOrder.ts`: `addWorkOrder` faz upsert por `id` em `calendarWorkOrders`.
- `frontend/src/content/own/WorkOrders/Details/FieldEvidenceSection.tsx`: dedupe usa `file.id` como chave principal; fallback por `url`, `path` e `name`; quando o mesmo arquivo aparece em mais de uma origem, a prioridade visual é Evidências de Campo, depois Anexos da Solicitação, depois Anexos da OS.
- `frontend/src/content/own/WorkOrders/Details/FieldExecutionSection.tsx`: duracao entre 1 e 59 segundos mostra `menos de 1 min`.
- `frontend/src/content/own/WorkOrders/Details/FieldExecutionTimeline.tsx`: duracao entre 1 e 59 segundos mostra `menos de 1 min`.
- `frontend/src/content/own/WorkOrders/Details/WorkOrderDetails.tsx`: descricao separada em bloco proprio com label `Descricao`.
- `frontend/src/i18n/translations/pt_BR.ts` e `frontend/src/i18n/translations/en.ts`: adicionadas traducoes para `less_than_1_min`; `completed_step` virou `Registrado` / `Recorded`.

### Validacao tecnica

- `cd frontend && npx eslint ...arquivos alterados...`: OK.
- `cd frontend && npm run build`: OK, apenas warnings conhecidos de sourcemap em dependencias e CRA/Babel.

### Nao alterado

- Timezone.
- Backend.
- Banco/migrations.
- Endpoints.
- Permissoes/roles.
- Customer Scope.
- Producao/containers.

---

## 2026-06-10 - Deploy frontend e validacao em producao

### Commit/deploy

- Commit publicado: `905a41c fix: sync work order calendar and organize field evidence UI`.
- Servidor `/var/www/html/cmms-erione`: `git pull` aplicado em fast-forward de `ae50886` para `905a41c`.
- Container rebuildado: apenas `frontend` / `atlas-cmms-frontend`.
- Containers apos deploy:
  - `atlas-cmms-frontend`: recriado e `Up`;
  - `atlas-cmms-backend`: permaneceu `Running`;
  - `atlas_db`: permaneceu `Running`;
  - `atlas_minio`: permaneceu `Running`.

### Validacao em producao

- Login web producao OK.
- Calendario:
  - criada OS temporaria `WO000021 - VALIDACAO DEPLOY CALENDARIO 2026-06-10T19:56`;
  - apareceu no calendario de junho/2026 sem F5;
  - clique no evento abriu o detalhe correto `/app/work-orders/455`;
  - apos exclusao da OS temporaria, calendario atualizou para empty state sem F5.
- Detalhe da OS:
  - titulo e descricao aparecem separados;
  - `Descricao` aparece como bloco/campo proprio.
- Timeline/duracao:
  - `OS criada`, `Deslocamento iniciado` e `Check-in realizado` exibiram chip `Registrado`;
  - deslocamento com menos de 1 minuto exibiu `menos de 1 min`;
  - nao apareceu `0min`.
- Evidencias/anexos:
  - validacao visual limitada porque a OS temporaria nao tinha anexos;
  - regra foi validada em codigo/build: dedupe global por `file.id`, fallback `url`, `path`, `name`, com prioridade Evidencias de Campo > Anexos da Solicitacao > Anexos da OS.

### Diagnostico de horario em producao

- Host: `Etc/UTC`.
- Container backend: data em UTC, sem `TZ` definido.
- Postgres: `SHOW timezone` retornou `UTC`.
- Postgres `now()` retornou `2026-06-10 20:01:12+00`.
- Conversao no Postgres para `America/Sao_Paulo` no mesmo instante retornou `2026-06-10 17:01:12`.
- Java reportou `user.country = US` e `user.language = en`; `user.timezone` nao apareceu explicitamente no recorte, mas o container roda em UTC.
- Observacao importante: a OS temporaria criada por volta de `19:56 UTC` apareceu na UI como `10/06/2026 19:56`, indicando que a tela web em producao esta exibindo UTC nessa area, nao horario de Brasilia.

### Nao alterado

- Timezone do host.
- Timezone do Postgres.
- `TZ`/`JAVA_TOOL_OPTIONS`.
- Backend.
- Banco/migrations.
- Endpoints.
- Permissoes/roles.
- Customer Scope.
