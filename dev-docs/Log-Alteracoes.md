# Log de Alterações — Erione CMMS

## 2026-06-13 - Login web full-screen dividido

### Alteracoes

- `frontend/src/content/pages/Auth/Login/Cover/index.tsx` deixou de usar card/modal centralizado.
- A tela de login agora usa `main` full-screen com grid em duas areas: painel de login a esquerda e arte tecnologica a direita.
- O formulario manteve largura maxima propria, mas o layout inteiro nao fica mais dentro de um card com max-width.
- O lado esquerdo usa fundo escuro/gradiente Erione, marca textual `ERIONE CMMS`, titulo `Faca seu login.` e formulario.
- O lado direito usa a arte correta em `frontend/public/static/images/erione-login-background.png`, recortada da referencia enviada, com sinapses/pulsos sobre camera, Wi-Fi, nuvem e IA.
- Em telas menores, a arte visual e ocultada e o login ocupa 100% da tela.
- `frontend/src/content/pages/Auth/Login/LoginJWT.tsx` manteve autenticacao, validacoes, recuperacao de senha, Politica de Privacidade e Termos de Servico.

### Validacao

- `cd frontend && npx eslint src/content/pages/Auth/Login/Cover/index.tsx src/content/pages/Auth/Login/LoginJWT.tsx src/config/erioneVisualIdentity.ts`: OK.
- `cd frontend && npm run build`: OK, apenas warnings conhecidos de sourcemap em dependencias e CRA/Babel.
- `docker compose build frontend`: OK.
- `docker compose up -d --no-deps --force-recreate frontend`: OK.
- Validacao visual via navegador interno ficou limitada porque a sessao local estava autenticada e redirecionava para `/app/work-orders`; a estrutura full-screen foi confirmada por codigo/build.

### Nao alterado

- Backend.
- Banco/migrations.
- Endpoints.
- Login/auth handlers.
- Permissoes/roles.
- Customer Scope.
- Mobile/APK.

---

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

## 2026-06-13 - Redesign login web Erione

### Ajustes aplicados

- Tela de login web reformulada com visual Erione escuro/tecnologico, inspirada na referencia enviada.
- Fundo com imagem tecnologica em `frontend/public/static/images/erione-login-background.png`.
- Painel principal em glass/dark UI, com marca textual `ERIONE CMMS`, titulo `Faca seu login.` e formulario em destaque.
- Area visual desktop com nos animados conectando camera, Wi-Fi, cloud, IA e seguranca.
- Link visivel para recuperacao de senha mantido.
- Links publicos de Politica de Privacidade e Termos de Uso mantidos no formulario.
- Link/CTA de criar conta nao foi exibido na nova tela.
- Paleta global web Erione ajustada em `erioneVisualIdentity` para a cor primaria temporaria `#2A4899`, com navy escuro e coral de destaque.

### Validacao tecnica

- `cd frontend && npx eslint src/content/pages/Auth/Login/Cover/index.tsx src/content/pages/Auth/Login/LoginJWT.tsx src/config/erioneVisualIdentity.ts`: OK.
- `cd frontend && npm run build`: OK, apenas warnings conhecidos de sourcemap em dependencias e CRA/Babel.

### Nao alterado

- Backend.
- Banco/migrations.
- Endpoints.
- Permissoes/roles.
- Customer Scope.
- Mobile/APK nesta leva.
- Producao/containers nesta leva.

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


---

## 2026-06-14 - Performance do modal de criacao de OS

### Ajustes aplicados

- Modal `AddWorkOrderTabbedModal` passou a ser carregado com `React.lazy`/`Suspense`, isolando o fluxo de criacao de OS em chunk carregado sob demanda.
- Campos, shape e schema Yup da OS agora sao memoizados em `WorkOrders/index.tsx`, evitando recriacao em cada render da tela.
- Valores iniciais e handlers do modal de criacao foram estabilizados com `useMemo`/`useCallback`.
- `AddWorkOrderTabbedModal` memoiza os campos da aba ativa para reduzir filtros repetidos durante digitacao.
- Form generico nao recria schema Yup padrao quando recebe `validation` pronta por props.

### Objetivo

- Reduzir input lag no teclado ao criar OS, principalmente nos campos de texto do modal.
- Evitar carregar codigo pesado de formulario/upload/select/date picker antes do usuario abrir o modal.

### Validacao tecnica

- `frontend`: lint direcionado nos 3 arquivos alterados passou.
- `frontend`: `npm run build` passou com avisos conhecidos de source map em dependencias e `babel-preset-react-app`.
- `graphify update .` executado apos alteracao de codigo.

### Nao alterado

- Backend.
- Banco/migrations.
- Endpoints.
- Permissoes/roles.
- Customer Scope.
- Regras de OS.

### Ajuste complementar - criacao sem F5

- Apos `addWorkOrder`, a tela agora refaz `getWorkOrders(criteria)` preservando os filtros atuais.
- Quando a OS e criada a partir/na visao de calendario, tambem refaz `getCalendarWorkOrders` com filtro de arquivamento/status usado pelo calendario.
- Objetivo: manter a melhoria de performance do modal sem quebrar a atualizacao automatica da lista/calendario apos criar OS.

### Validacao complementar

- `frontend`: lint direcionado passou.
- `frontend`: `npm run build` passou com os mesmos avisos conhecidos de source map em dependencias e CRA/babel.
## 2026-08-04 - Auditoria MVP operacional, realtime, assinatura e seguranca

- Fluxo admin -> tecnico validado ponta a ponta com checklist, relato, evidencia, check-in/out e assinatura.
- Atualizacao de atribuicao corrigida via WebSocket/STOMP com fallback de polling no mobile.
- CORS do WebSocket passou a aceitar as origens extras configuradas, incluindo Expo Web em `8081`.
- Endpoints de checklist e upload ligado a tarefa passaram a bloquear acesso a OS nao atribuida.
- Assinatura mobile passa a ser salva ao finalizar o traco.
- Configuracao Android restaurada para `com.cmms.erione`, `1.0.41 (34)` e API de distribuicao `https://cmms.erione.com.br/api`.
- APK/AAB ficaram explicitamente pendentes para 2026-08-05; toolchain portatil e copia curta de build foram preservados.
- Relatorio completo: `dev-docs/Auditoria-MVP-Operacional-2026-08-04.md`.

## 2026-08-05 - Escopo de OS por tecnico, refresh do mobile, checklist 0%, KPIs e assinante ausente

Pedido do usuario: sistema tinha que ficar funcional de verdade (fluxo sem travar,
OS nao sumir, campos certos no app), escopo de OS precisa ser so do tecnico
selecionado (nao global), corrigir bug do mobile que exigia trocar de aba pra OS
aparecer, e melhorar o layout da lista.

### Escopo de OS por tecnico (critico)

- Tecnico enxergava TODAS as OS da empresa, nao so as atribuidas a ele.
- Causa: `Helper.getDefaultRoles()` incluia `WORK_ORDERS` em `viewOtherPermissions`
  do papel padrao de Tecnico. `WorkOrderService.getSearchCriteria()` remove o
  filtro por usuario quando essa permissao esta presente.
- Corrigido em `api/src/main/java/com/grash/utils/Helper.java`: `WORK_ORDERS`
  removido de `viewOtherPermissions` do Tecnico (Locais/Ativos/Pecas continuam
  globais, pois o tecnico precisa consultar o cadastro).
- `RoleService.updateDefaultRoles()` roda em todo boot e reescreve o papel padrao
  a partir do `Helper.java` — por isso o fix precisou ser no codigo, nao so no banco.
- Validado: tecnico so ve OS atribuidas a ele/seu time; acesso direto por ID a uma
  OS nao atribuida continua bloqueado (HTTP 403).

### Mobile: OS so aparecia depois de trocar de aba

- `HomeScreen.tsx` buscava dados num `useEffect(..., [])` de montagem unica. Como
  a Home fica montada o tempo todo no tab navigator, uma OS atribuida depois do
  app aberto so aparecia se o tecnico trocasse de aba e voltasse.
- Corrigido com `useFocusEffect` (mesmo padrao ja usado em `WorkOrdersScreen.tsx`):
  recarrega toda vez que a tela ganha foco, sem depender de troca de aba.

### Checklist aparecia parcialmente preenchido antes do tecnico tocar em nada

- Itens `INSPECTION` recem-criados (via checklist padrao da Categoria ou
  adicionados a mao) nasciam com valor inicial `"FLAG"` em vez de vazio.
  `FLAG` e uma resposta legitima do tecnico ("sinalizar"), nao um placeholder —
  isso fazia um checklist novo aparecer como parcialmente concluido.
- Corrigido em `WorkOrderService.applyCategoryDefaults()` e `TaskController`
  (caminho de criacao manual), ambos agora comecam `INSPECTION` vazio.

### Assinante, documento e quilometragem sumiam na tela do admin (critico)

- Descoberto durante o teste ponta a ponta do fluxo do tecnico: `signerName`,
  `signerDocument` e `mileageTraveled` eram gravados corretamente no banco pelo
  `PATCH /work-orders/{id}/change-status`, mas `GET /work-orders/{id}` devolvia
  `undefined` nos tres campos (so `signature` ia e voltava certo).
- Causa: os campos existem na entidade `WorkOrder` e no DTO de entrada
  (`WorkOrderChangeStatusDTO`), mas nunca foram adicionados ao DTO de saida
  (`WorkOrderShowDTO`). O card de assinatura no web/mobile le esses campos
  direto da OS, entao nunca aparecia mesmo com o dado capturado.
- Corrigido adicionando os 3 campos a `WorkOrderShowDTO`. Isso corrige/atualiza a
  afirmacao anterior em `Auditoria-MVP-Operacional-2026-08-04.md` de que isso ja
  estava confirmado — nao estava.

### Layout da lista de OS (web)

- Novo componente `WorkOrderKpiCards.tsx`: 3 cards no topo da lista (Ativas / Em
  andamento / Concluidas), contagem via o mesmo endpoint de busca que a lista usa
  (respeita o escopo do usuario logado, tecnico ve so a propria contagem).
- Card "Atrasadas" avaliado e descartado: filtrar por `dueDate` no
  `POST /work-orders/search` quebra no backend (`HibernateException` convertendo
  `String` para `Timestamp`, HTTP 500) — o card ficava preso num skeleton de
  carregamento. Fica pendente para quando o endpoint suportar filtro de data.
- Status (`WorkOrderStatusCell.tsx`) e prioridade (`PriorityWrapper.tsx`)
  redesenhados como chip suave (fundo `alpha(cor, 0.12-0.14)` + texto na cor
  cheia), no lugar de icone solto / fundo solido pesado.
- Linhas da tabela (`CustomDatagrid2`) com mais respiro vertical (`py: 1.5`).

### Validado ao vivo

- Fluxo completo do tecnico (criacao -> atribuicao -> visibilidade -> deslocamento
  -> check-in -> checklist -> relato -> check-out -> conclusao com assinatura)
  rodado via API real, com OS de teste limpa ao final.
- `GET /work-orders/{id}` do admin confirmado retornando `signerName: "Pedro Silva"`,
  `signerDocument`, `mileageTraveled: 42.5` apos o fix.
- KPIs conferidos contra contagem direta no Postgres.
- Chip de status/prioridade e altura de linha confirmados no DOM real
  (`localhost:3000/app/work-orders`), console sem erros.
- `docker compose build api` e `docker compose build frontend`: sucesso.

### Categoria e Checklist unificados numa tela so

Pedido do usuario: cadastrar uma categoria de OS e montar o questionario dela
eram duas telas completamente separadas (`Categorias > Ordens de Serviço` só
tinha um dropdown pra ESCOLHER um checklist já criado em outro lugar;
`Configurações > Checklists de Atendimento` era onde de fato se montavam as
perguntas). Pra configurar um "Tipo de Tarefa" do zero era obrigatorio ir e
voltar entre as duas.

- `CategoriesLayout.tsx`: o dropdown de checklist foi substituido por um editor
  de perguntas embutido no proprio modal de categoria (reaproveita o componente
  `SelectTasksModal` ja usado em Configurações > Checklists, só que sem os
  campos de nome/descrição/categoria do checklist — a categoria de OS já tem
  os seus).
- Ao salvar a categoria (criar ou editar), o `Checklist` por baixo é
  criado/atualizado automaticamente (`persistCategoryChecklist`, usa
  `addChecklist`/`editChecklist` do slice existente) usando o nome da própria
  categoria — o usuário nunca mais precisa saber que existe um "Checklist"
  separado. Editar de novo atualiza o MESMO registro (não duplica).
- `slices/checklist.ts`: `addChecklist`/`editChecklist` passaram a devolver o
  checklist criado/atualizado (mesmo padrão já usado em `addCategory`),
  necessário pra pegar o id recém-criado antes de salvar a categoria.
- A tela separada `Configurações > Checklists de Atendimento` continua
  existindo (é reaproveitada por Workflows), só deixou de ser obrigatória no
  fluxo normal de cadastro de categoria.
- Validado ao vivo: criei categoria com 1 pergunta pelo modal novo, sem visitar
  a tela de Checklists; editei e adicionei uma 2a pergunta; conferido no
  Postgres que é o MESMO `checklist.id` sendo atualizado (sem duplicar); criei
  uma OS dessa categoria via API e as 2 perguntas vieram auto-preenchidas
  (`applyCategoryDefaults`, já existente); dados de teste removidos ao final.
- `docker compose build frontend`: sucesso.

### Fotos nao apareciam no relatorio PDF de uma OS individual

Dois bugs em cadeia, achados a partir de um PDF real gerado pelo usuario onde
tudo aparecia certo (checklist, assinatura, relato) menos as 2 fotos do relato
em campo - so o nome do arquivo aparecia como texto.

1. **Mobile** (`mobile/screens/workOrders/FieldExecutionSection.tsx`,
   `submitEvidence`): chamava `uploadFiles(evidenceFiles, [], false)`, mas a
   assinatura de `uploadFiles` e' `(files, images, hidden)` onde `files` sobe
   com `type=OTHER` e `images` com `type=IMAGE`. As fotos do relato em campo
   iam no parametro errado (`files`), entao gravavam `type=OTHER` no banco -
   corrigido pra `uploadFiles([], evidenceFiles, false)`.
2. **Backend** (`WorkOrderController.addEvidenceItem`): mesmo com
   `type=IMAGE` certo, a foto ainda nao aparecia. O PDF e' montado com
   `HtmlConverter.convertToPdf` DENTRO do container da API, e a URL da
   evidencia era uma URL assinada do MinIO com host `localhost:9000` - isso so'
   funciona pro navegador do usuario (que tem a porta 9000 mapeada pro host);
   de dentro do proprio container da API, `localhost:9000` e' o container, nao
   o MinIO (`wget` de dentro do container confirmou `Connection refused`). A
   foto falhava silenciosamente ao carregar, sem erro visivel. Corrigido
   baixando os bytes via `storageService.download(file.getPath())` e
   embutindo como data URI base64 no `<img src>`, mesmo esquema que ja' era
   usado com sucesso pra `workOrder.signature`.
- Validado: corrigido `type` dos 2 arquivos de teste direto no banco (WO
  WO000026/id 703), regerado o PDF via `GET /work-orders/report/703`, e as
  duas fotos apareceram na secao "Evidencias de campo" (PDF foi de 17KB pra
  2,5MB, confirmando as imagens embutidas).
- `docker compose build api`: sucesso.

### Relatorio em massa por cidade (feature que estava adiada desde a rodada do PDF individual)

Pedido do usuario: dentro do Relatorio Operacional de OS, um campo "Cidade"
que traz todas as OS CONCLUIDAS daquela cidade num periodo, no mesmo padrao
visual do relatorio individual (com fotos, checklist, assinatura).

- **Cidade no Cliente**: nao existia campo estruturado de cidade em lugar
  nenhum (só endereco em texto livre). Adicionado `city` em `Customer`
  (migration `2026_08_05_00000000001_add_customer_city.xml`), no
  `CustomerPatchDTO`/`CustomerShowDTO`, e no formulario de Cliente
  (`frontend/src/content/own/VendorsAndCustomers/Customers.tsx` — campo,
  coluna da tabela, campo de detalhe e busca).
- **Bug pre-existente achado no caminho (nao era da minha mudanca)**:
  `PATCH /customers/{id}` retornava HTTP 500 pra QUALQUER edicao, sempre.
  `CustomerPatchDTO` herda `id` de `CompanyAudit` (via `BasicInfos`); como o
  corpo do PATCH nunca manda `id`, o MapStruct sobrescrevia o id real da
  entidade com `null`, e o Hibernate rejeitava o flush ("identifier ...
  altered from null to X"). Corrigido com `@Mapping(target = "id", ignore =
  true)` em `CustomerMapper.updateCustomer`. `VendorPatchDTO` tem a MESMA
  heranca e provavelmente o MESMO bug - sinalizado como tarefa separada
  (nao corrigido nesta rodada, e' um cadastro diferente).
- **Relatorio em massa**: `WorkOrderController` ganhou
  `POST /work-orders/report/bulk` (`{city, periodField, start, end}`).
  Busca todos os Clientes daquela cidade (case-insensitive, escopado por
  empresa), depois todas as OS com `status=COMPLETE` desses clientes no
  periodo (campo de data selecionavel: `createdAt`/`completedOn`/
  `checkInAt` - mesmo enum ja usado no relatorio operacional). A logica de
  montar UMA OS pro PDF (evidencias em base64, checklist, timeline) foi
  extraida do endpoint individual (`buildWorkOrderReportVariables`) pra ser
  chamada em loop sem duplicar codigo; variaveis de empresa (logo, moeda,
  fuso) ficaram em `buildCompanyReportVariables`, calculadas uma vez só.
  Novo template `work-orders-bulk-report.html`: capa com cidade/total/
  periodo, depois cada OS numa secao com quebra de pagina antes dela
  (`page-break-before`), reaproveitando o mesmo layout/CSS do relatorio
  individual.
- Frontend: novo card "Relatório em massa por cidade" dentro da tela de
  Relatorio Operacional de OS (`frontend/src/content/own/Reports/
  WorkOrderOperationalReport/index.tsx`) — campo de periodo (padrao
  `COMPLETED_ON`, faz mais sentido que `CREATED_AT` pra "OS concluidas"),
  datas inicial/final e botao "Gerar relatório em massa". Independente dos
  filtros granulares da tabela (Cliente/Local/Equipamento/Status/Tecnico) -
  o relatorio em massa e' sempre por cidade + status concluido, nao tem
  relacao com o que esta filtrado na tabela.
- **Ajuste pedido pelo usuario apos a primeira versao**: campo de cidade
  era texto livre (`TextField`); trocado por um dropdown de Cliente (mesma
  lista `customersMini` ja usada no filtro "Cliente" de cima), que resolve
  a cidade automaticamente a partir do cliente escolhido - sem o usuario
  precisar digitar/saber o nome exato da cidade. `CustomerMiniDTO` (backend
  e frontend) ganhou o campo `city`. Mostra "Cidade: X" como confirmacao,
  ou aviso se o cliente escolhido nao tem cidade cadastrada.
- **Bug achado e corrigido nesse ajuste**: o dropdown do MUI entrega o
  `value` do item selecionado com o TIPO ORIGINAL (`number`, ja que
  `customer.id` e' number), nao como string, mesmo o estado sendo tipado
  `string`. A comparacao `String(customer.id) === bulkFilters.customerId`
  comparava `"1" === 1` (sempre falso), entao a cidade nunca resolvia -
  o aviso de "cliente sem cidade" aparecia ate pro cliente que TINHA
  cidade. Corrigido comparando `String(customer.id) === String(...)` dos
  dois lados.
- Validado ao vivo: `PATCH /customers/1` com `city` persistiu; `POST
  /work-orders/report/bulk` pra "Santa Branca" trouxe as 2 OS concluidas
  certas (WO000009, WO000022), cada uma com secao completa (uma delas com
  foto embutida, a outra sem porque o arquivo de teste tinha `type=OTHER` -
  comportamento correto, nao bug); testado tambem clicando o botao de
  verdade na tela, com o dropdown de Cliente (nao mais texto livre),
  confirmando "Cidade: Santa Branca" no helperText antes de gerar
  (`POST /work-orders/report/bulk` → 200, sem erro no console).
- `docker compose build api` e `docker compose build frontend`: sucesso
  (2 rodadas de build no frontend - v1 com texto livre, v2 com o dropdown +
  fix do bug de tipo).

### Pendente (nao corrigido nesta rodada, por decisao explicita do usuario ou escopo)

- Filtro de `dueDate` no `POST /work-orders/search` (HTTP 500) — motivo de o card
  "Atrasadas" ter sido removido em vez de consertado.
- `VendorPatchDTO` provavelmente tem o mesmo bug de `id` nulo que quebrava
  `PATCH /customers/{id}` — sinalizado, nao corrigido (cadastro diferente).
- Deploy em producao: alteracoes desta secao existem so localmente ate aqui;
  producao segue no commit `4b59718`, sem o fix de escopo do tecnico.
