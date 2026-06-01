# Auditoria MVP/P0 — Erione CMMS

**Data:** 2026-06-01
**Commit:** `1475e2d`
**Escopo:** Apenas código-fonte, sem alterações. Auditoria baseada em leitura de controllers, services, models, Docker, env e Obsidian vault.

---

## 1. Status geral

**Pronto com ressalvas.** O MVP está operacional — fluxo Request → WorkOrder → Mobile técnico funciona. Existem **3 bugs P0 que devem ser corrigidos antes de expor a usuários reais** e **4 riscos P1 que podem afetar a experiência**, mas não bloqueiam o teste controlado.

---

## 2. Achados críticos P0

### P0.1 — `PATCH /work-orders/{id}` sem `title` retorna HTTP 500

| Campo | Valor |
|---|---|
| **Descrição** | `WorkOrderPatchDTO` tem `title @NotNull`. Ao fazer PATCH sem title, MapStruct mapeia `null` para o campo, Hibernate rejeita com `ConstraintViolationException`, o controller não trata → HTTP 500. |
| **Impacto** | Queda de servidor aparente para o cliente. Usuário (admin ou técnico) faz PATCH em OS, não envia `title`, recebe 500. |
| **Arquivo** | `WorkOrderPatchDTO.java`, `WorkOrderController.java:244` (`patch()`) |
| **Como reproduzir** | `curl -X PATCH -H "Content-Type: application/json" -d '{"status": "COMPLETE"}' http://localhost:8080/work-orders/{id}` → 500 |
| **Correção sugerida** | Remover `@NotNull` do title no PatchDTO, ou tratar `null` no mapper, ou adicionar `@ExceptionHandler` global. |
| **Risco** | Médio — não afeta segurança, mas causa UX negativa |
| **Prioridade** | **P0 — Bloqueante para teste** |

### P0.2 — `DELETE /requests/{id}` com ownership check errado

| Campo | Valor |
|---|---|
| **Descrição** | `RequestController.delete()` linha ~367: `user.getId().equals(savedRequest.getId())`. O ID do usuário está sendo comparado com o ID da request — comparação semântica errada. Deveria ser `savedRequest.getCreatedBy()`. |
| **Impacto** | Nenhum usuário consegue deletar request própria por ownership (user ID ≠ request ID). O único caminho é ter `DELETE_OTHER_PERMISSIONS`. |
| **Arquivo** | `api/src/main/java/com/grash/controller/RequestController.java:367` |
| **Como reproduzir** | Logar como REQUESTER, criar request, tentar `DELETE /requests/{id}` → 403 Forbidden (mesmo sendo o criador) |
| **Correção sugerida** | `user.getId().equals(savedRequest.getCreatedBy())` |
| **Risco** | Alto — bug lógico que impede deleção por owner |
| **Prioridade** | **P0 — Bloqueante para teste** |

### P0.3 — `GET /work-orders/asset/{id}` e `GET /work-orders/location/{id}` sem Customer Scope

| Campo | Valor |
|---|---|
| **Descrição** | Os endpoints `GET /work-orders/asset/{id}` e `GET /work-orders/location/{id}` no `WorkOrderController` não validam Customer Scope. Um REQUESTER pode listar OS de qualquer asset/location, mesmo fora do escopo permitido. |
| **Impacto** | Vazamento de dados entre clientes. REQUESTER do Cliente A pode ver OS do Cliente B se souber o ID do asset. |
| **Arquivo** | `api/src/main/java/com/grash/controller/WorkOrderController.java:168-192` |
| **Como reproduzir** | REQUESTER com allowedCustomers=[Cliente A] → `GET /work-orders/asset/{asset-do-cliente-B}` → retorna OS sem filtrar |
| **Correção sugerida** | Adicionar `customerScopeService.addCustomerManyToManyScopeFilter(searchCriteria, user, "customers")` ou validar cada WO retornada com `canAccessWorkOrderBase()` |
| **Risco** | Alto — vazamento de dados entre clientes |
| **Prioridade** | **P0 — Bloqueante para teste** |

---

## 3. Achados altos P1

### P1.1 — WorkOrder depart/check-in/check-out sem Customer Scope

| Campo | Valor |
|---|---|
| **Descrição** | `POST /work-orders/{id}/depart`, `/check-in`, `/check-out` usam `canBeEditedBy(user)` que verifica assignment/ownership mas **não** Customer Scope. REQUESTER atribuído a uma OS pode executar ações mesmo que a OS esteja em cliente fora do escopo. |
| **Arquivo** | `api/src/main/java/com/grash/controller/WorkOrderController.java:343-440` |
| **Impacto** | Médio — técnico só atua em OS atribuídas a ele, mas se uma OS estiver atribuída erroneamente, não há barreira de customer scope |
| **Correção sugerida** | Adicionar `customerScopeService.canAccessWorkOrderBase(user, workOrder)` nos endpoints |
| **Prioridade** | **P1** |

### P1.2 — `POST /work-orders/events` sem Customer Scope para REQUESTER

| Campo | Valor |
|---|---|
| **Descrição** | O endpoint de calendário usa `canViewWorkOrderBase()` inline que não considera Customer Scope. REQUESTER vê eventos de OS fora do escopo no calendário. |
| **Arquivo** | `api/src/main/java/com/grash/controller/WorkOrderController.java:134-155` (`getEvents`) |
| **Impacto** | Vazamento de dados no calendário |
| **Correção sugerida** | Adicionar `customerScopeService.canAccessWorkOrderBase(user, workOrder)` a cada evento |
| **Prioridade** | **P1** |

### P1.3 — Request approve/cancel/delete sem Customer Scope

| Campo | Valor |
|---|---|
| **Descrição** | `PATCH /requests/{id}/approve`, `/cancel` e `DELETE /requests/{id}` não validam se o admin tem acesso customer scope à request. Embora gated por role SETTINGS/LIMITED_ADMIN, isso permite que um admin de empresa com múltiplos clientes atue em requests de clientes que talvez não devesse. |
| **Arquivo** | `api/src/main/java/com/grash/controller/RequestController.java:219-376` |
| **Impacto** | Baixo no MVP (admin vê tudo), mas relevante para evolução futura com customer scope por admin |
| **Correção sugerida** | Adicionar `customerScopeService.canAccessWorkOrderBase(user, request)` nos endpoints |
| **Prioridade** | **P1** |

### P1.4 — Swagger/API docs publicamente expostos

| Campo | Valor |
|---|---|
| **Descrição** | `SwaggerSecurityConfig.java` permite `permitAll()` para `/swagger-ui/**`, `/v3/api-docs/**`. Qualquer pessoa sem autenticação pode ver todos os endpoints, schemas, exemplos. |
| **Arquivo** | `api/src/main/java/com/grash/configuration/SwaggerSecurityConfig.java` |
| **Impacto** | Exposição da superfície de ataque completa da API |
| **Correção sugerida** | Restringir swagger a perfil dev ou adicionar autenticação básica |
| **Prioridade** | **P1** |

### P1.5 — `GET /requests/pending` sem Customer Scope

| Campo | Valor |
|---|---|
| **Descrição** | `GET /requests/pending` retorna contagem global da empresa sem filtrar por customer scope do REQUESTER |
| **Arquivo** | `api/src/main/java/com/grash/controller/RequestController.java:96-100` |
| **Impacto** | REQUESTER vê contagem total de requests pendentes da empresa, não apenas as suas |
| **Correção sugerida** | Adicionar customer scope filter |
| **Prioridade** | **P1** |

---

## 4. Achados médios P2

### P2.1 — JWT secret key fraca/override padrão
`.env` contém `JWT_SECRET_KEY=ZGV2LWxvY2FsLWp3dC1zZWNyZXQta2V5LWZvci1hdGxhcy1jbW1zLWFwcA==` (decodifica para `dev-local-jwt-secret-key-for-atlas-cmms-app`). Em produção, o default hardcoded é `secret-key`. **Risco alto se deployed sem override.**

### P2.2 — Docker build API usa cache
`docker compose build api` usa cache Maven. Como descoberto na validação de 31/05, o bug de cópia de customers da Request para WorkOrder só foi ativo com `--no-cache`. **Necessário `--no-cache` ou `docker compose build --no-cache api` para garantir compilação fresca.**

### P2.3 — Frontend Docker usa node:21.6.1
Versão 21 do Node.js pode ter incompatibilidades com dependências legacy do projeto (TypeScript 4.7.3). Recomendado node:20 LTS.

### P2.4 — frontend/.env não existe
Apenas `frontend/.env.example`. A build usa `runtime-env-cra` que lê de variáveis de ambiente do container, mas `.env.example` pode estar desatualizado em relação às variáveis reais usadas.

### P2.5 — Mobile: assinatura não renderiza no Expo Web
Componente de assinatura baseado em WebView não funciona no Expo Web (`React Native WebView does not support this platform`). **Não é blocker para teste controlado** (teste é em celular físico), mas precisa ser documentado.

### P2.6 — Mobile: câmera/galeria e upload não validados em dispositivo real
Todos os testes até agora foram em Expo Web. Câmera, galeria, upload de arquivo e assinatura em canvas precisam de validação em Android/iOS físico.

### P2.7 — Google Maps sem chave
`GOOGLE_KEY` vazia no `.env`. Botão "Abrir no Google Maps" só funciona se o mapa estiver configurado. Coordenadas manuais funcionam.

---

## 5. Achados baixos P3

### P3.1 — Firebase config warnings no mobile
`npx expo export --platform web` exibe warnings de Firebase config ausente (`android.googleServicesFile` e `ios.googleServicesFile`). Não bloqueiam, mas poluem log.

### P3.2 — i18n pode conter resquícios "Atlas CMMS"
A auditoria de branding identificou que traduções podem conter "Atlas CMMS" e "Grash" em alguns pontos. Não verificado exaustivamente.

### P3.3 — Storybook artifacts no build
Storybook (`frontend/.storybook/`, `frontend/src/stories/`) está presente no workspace. Não entra em produção (build separado), mas pode causar confusão.

### P3.4 — DemoCleaningAlert retorna null
Componente `DemoCleaningAlert` em `App.tsx` foi substituído por `return null`. Pode ser removido completamente.

---

## 6. Customer Scope — Status por entidade

| Entidade | Endpoint | REQUESTER com escopo | REQUESTER sem escopo | Admin | Técnico |
|---|---|---|---|---|---|
| **Customers** | search | ✅ `addCustomerScopeFilter("id")` | ✅ `-1` → vazio | ✅ vê tudo | ✅ vê tudo |
| | mini | ✅ `filterCustomers()` | ✅ 0 itens | ✅ vê tudo | ✅ vê tudo |
| | getById | ✅ `assertCanAccessCustomer()` | ✅ 403 | ✅ vê tudo | ✅ vê tudo |
| **Locations** | search | ✅ `addCustomerManyToManyScopeFilter("customers")` | ✅ `-1` → vazio | ✅ vê tudo | ✅ vê tudo |
| | mini | ✅ `findAllowedLocations()` | ✅ 0 itens | ✅ vê tudo | ✅ vê tudo |
| | getById | ✅ `assertCanAccessLocation()` | ✅ 403 | ✅ vê tudo | ✅ vê tudo |
| | getAll | ✅ `findAllowedLocations()` | ✅ 0 itens | ✅ vê tudo | ✅ vê tudo |
| **Assets** | search | ✅ `addCustomerManyToManyScopeFilter("customers")` | ✅ `-1` → vazio | ✅ vê tudo | ✅ vê tudo |
| | mini | ✅ `findAllowedAssets()` | ✅ 0 itens | ✅ vê tudo | ✅ vê tudo |
| | getById | ✅ `assertCanAccessAsset()` | ✅ 403 | ✅ vê tudo | ✅ vê tudo |
| | getByLocation | ✅ `assertCanAccessLocation()` + `findAllowedAssets()` | ✅ 0 itens | ✅ vê tudo | ✅ vê tudo |
| | children | ✅ `findAllowedAssets()` + `assertCanAccessAsset()` | ✅ 0 itens | ✅ vê tudo | ✅ vê tudo |
| **Requests** | search | ✅ `addCustomerManyToManyScopeFilter("customers")` | ✅ `-1` → vazio | ✅ vê tudo | N/A |
| | getById | ✅ `canAccessWorkOrderBase()` | ✅ 403 | ✅ vê tudo | N/A |
| | create | ✅ `prepareAndValidateRequestScope()` | ✅ 403 | ✅ cria | N/A |
| | patch | ✅ `prepareAndValidateRequestScope()` | ✅ 403 | ✅ edita | N/A |
| | approve | ❌ sem escopo (gated role) | ❌ sem escopo | ✅ apenas por role | N/A |
| | cancel | ❌ sem escopo (gated role) | ❌ sem escopo | ✅ apenas por role | N/A |
| | delete | ❌ sem escopo + **bug** | ❌ sem escopo + **bug** | ✅ apenas por role | N/A |
| | pending | ❌ contagem global | ❌ contagem global | ✅ total | N/A |
| **WorkOrders** | search | ✅ `addCustomerManyToManyScopeFilter("customers")` (Bug 2 corrigido) | ✅ `-1` → vazio | ✅ vê tudo | ✅ vê atribuídas |
| | getById | ✅ `isAccessibleBy()` (verifica role + assignment + parentRequest.createdBy) | ✅ 403 (sem permissão) | ✅ vê tudo | ✅ vê atribuídas |
| | getByAsset | **❌ sem Customer Scope** | **❌ sem Customer Scope** | ✅ vê tudo | ✅ vê tudo (risco) |
| | getByLocation | **❌ sem Customer Scope** | **❌ sem Customer Scope** | ✅ vê tudo | ✅ vê tudo (risco) |
| | depart | ❌ só `canBeEditedBy()` | ❌ só `canBeEditedBy()` | ✅ | ✅ se atribuído (sem scope) |
| | check-in | ❌ só `canBeEditedBy()` | ❌ só `canBeEditedBy()` | ✅ | ✅ se atribuído (sem scope) |
| | check-out | ❌ só `canBeEditedBy()` | ❌ só `canBeEditedBy()` | ✅ | ✅ se atribuído (sem scope) |
| | change-status | ❌ só `canBeEditedBy()` | ❌ só `canBeEditedBy()` | ✅ | ✅ se atribuído (sem scope) |
| | patch | ❌ só `canBeEditedBy()` | ❌ só `canBeEditedBy()` | ✅ | ✅ se atribuído (sem scope) |
| | events | ❌ só `canViewWorkOrderBase()` inline | ❌ só inline | ✅ | ✅ se visível (sem scope) |
| | report PDF | ❌ só `canViewWorkOrderBase()` inline | ❌ só inline | ✅ | ✅ se visível (sem scope) |
| **Files** | add/remove | ❌ só `canBeEditedBy(user)` | ❌ só `canBeEditedBy(user)` | ✅ | ✅ se atribuído |

---

## 7. Fluxo operacional

| Etapa | Status | Detalhes |
|---|---|---|
| Requester cria Request | ✅ OK | Customer scope validado, auto-select se 1 customer, bloqueio se 0 |
| Admin aprova/converte em OS | ✅ OK | Customers copiados (Bug 1 corrigido). Requer role SETTINGS/LIMITED_ADMIN |
| Admin atribui técnico | ✅ OK | Fluxo web normal |
| Técnico vê OS no mobile | ✅ OK | Search filtra por assignedTo + customer scope. QuickFilter "Minhas OS" default ON |
| Técnico executa depart/check-in/check-out | ⚠️ OK funcional, sem customer scope | `canBeEditedBy` funciona, mas sem barreira de customer scope |
| Técnico faz relato/evidência | ✅ OK | Fluxo separado, double-submit prevention |
| Técnico conclui OS | ✅ OK | `canComplete` exige relato textual real |
| Web/admin acompanha | ✅ OK | Evidências de campo, relato, assinatura, status COMPLETE |
| PDF/relatório | ✅ OK | Gera PDF com assinatura e evidências |
| Comentários/evidências | ✅ OK | Prefixo `[Relato em campo]`, upload via `/files/upload` |

---

## 8. Mobile técnico — Riscos restantes

| Risco | Impacto | Observação |
|---|---|---|
| Câmera/galeria em dispositivo real | Não testado | Expo Web usou file picker alternativo. Precisa validar em Android/iOS |
| Assinatura em celular físico | Não testado | Expo Web não renderiza canvas. Envio por API OK |
| Sessão expirada | Não validado | Token JWT expira em 1h. Mobile não tem refresh token explícito |
| Offline/retry | Não implementado | Sem suporte offline. Se perder rede, perde dados |
| Upload em campo | Parcial | Upload funciona via `/files/upload`. Rede 3G/4G não testado |
| Tratamento de erro | Parcial | Erros de rede mostram "Servidor inacessível". Erros HTTP não mapeados exaustivamente |

---

## 9. Deploy/build — Checklist pré-teste

- [ ] **API**: `docker compose build --no-cache api` (garantir compilação fresca)
- [ ] **Frontend**: `docker compose build --no-cache frontend`
- [ ] **CORS**: `EXTRA_CORS_ORIGINS` no `.env` deve incluir URLs de exposição (localhost:8081, IP do servidor, domínio)
- [ ] **Variáveis de ambiente**: Verificar `.env` completo (JWT_SECRET_KEY, POSTGRES_PWD, MINIO_PASSWORD)
- [ ] **JWT**: Trocar secret key para produção
- [ ] **Swagger**: Desabilitar ou restringir em produção
- [ ] **docker compose up -d**: Validar containers sobem sem erro
- [ ] **docker compose logs**: Verificar logs de startup
- [ ] **Mobile**: `npx expo start` ou `eas build` para dispositivo físico

---

## 10. npm audit

**Recomendação:** Rodar `npm audit` apenas depois do teste controlado com usuários. Não bloquear o MVP por auditoria de dependências agora. O projeto usa React 17 + CRA com TypeScript 4.7.3 — versões antigas que inevitavelmente terão vulnerabilidades reportadas, mas que não impactam o MVP operacional.

- **Não rodar `npm audit fix` agora** — pode introduzir breaking changes em dependências.
- **Após teste controlado**, avaliar upgrade para React 18 e TypeScript 5.x.

---

## 11. Checklist final antes do teste com usuários

### Admin
- [ ] Criar cliente, local, equipamento
- [ ] Configurar `allowedCustomers` para REQUESTER
- [ ] Criar OS e atribuir técnico
- [ ] Aprovar Request e converter em OS
- [ ] Acompanhar execução no web
- [ ] Ver relato, evidências, assinatura no detalhe da OS
- [ ] Gerar PDF/relatório

### REQUESTER (Operador do Cliente)
- [ ] Login como REQUESTER com 1 cliente permitido
- [ ] Ver apenas clientes/locations/assets permitidos
- [ ] Criar Request com auto-select de customer
- [ ] Ver Request criada na listagem
- [ ] Ver OS gerada após aprovação
- [ ] Confirmar que NÃO vê OS de outros clientes
- [ ] Confirmar que NÃO vê técnico/equipe na UI
- [ ] Confirmar que NÃO cria OS direta

### Técnico (Mobile)
- [ ] Login no app mobile
- [ ] Ver lista "Minhas OS"
- [ ] Abrir detalhe da OS
- [ ] Executar depart/check-in/check-out
- [ ] Adicionar relato textual
- [ ] Adicionar evidência (foto)
- [ ] Verificar que foto sem relato não libera conclusão
- [ ] Concluir OS (com/sem assinatura conforme config)
- [ ] Verificar que OS aparece como COMPLETE no web

### Técnico (Web)
- [ ] Login como técnico no web
- [ ] Ver apenas OS atribuídas
- [ ] Ver detalhe, relato, evidências

### Infra
- [ ] CORS configurado
- [ ] Build sem cache
- [ ] JWT secret trocado
- [ ] Swagger restrito
- [ ] API health check (`GET /actuator/health` ou similar)
- [ ] MinIO acessível
- [ ] Banco de dados conectado

---

## 12. Recomendações finais

### 🔴 Corrigir ANTES do teste controlado

1. **P0.1** — `PATCH /work-orders/{id}` sem title → 500 (remover `@NotNull` do PatchDTO ou adicionar exception handler)
2. **P0.2** — `DELETE /requests/{id}` ownership check errado (`savedRequest.getId()` → `savedRequest.getCreatedBy()`)
3. **P0.3** — `GET /work-orders/asset/{id}` e `/location/{id}` sem Customer Scope (adicionar filtro de customer)

### 🟡 Corrigir IDEALMENTE antes, mas não bloqueia

4. **P1.1** — depart/check-in/check-out sem Customer Scope
5. **P1.4** — Swagger público (desabilitar ou restringir)
6. **P1.5** — `GET /requests/pending` sem Customer Scope
7. **Docker**: `--no-cache` no build da API

### ⚪ Pode ficar para depois do teste

8. **P1.2/P1.3** — Events e approve/cancel/delete sem Customer Scope (role-gated)
9. **P2.x** — JWT secret, Node version, .env.example, assinatura Expo Web, câmera física
10. **P3.x** — i18n, Storybook, Firebase warnings
11. **npm audit** — depois do MVP

### 🚫 Não mexer agora

- CORS (configurado no `.env`)
- Módulos ocultos (`ERIONE_HIDDEN_MODULES` — OK)
- Migrations/banco
- Backend de Parts/Meters/PurchaseOrders/Vendors
- Storybook
- Regras de status/fluxo de OS

---

## 13. Atualizacao em 2026-06-01 - P0 corrigidos

### Resultado

Os 3 P0 da auditoria foram corrigidos de forma cirurgica, sem alterar banco, migrations, endpoints, permissoes, Customer Scope estrutural ou regras de status.

### P0.1 - PATCH `/work-orders/{id}` sem `title`

Corrigido no mapper da OS.

- `WorkOrderMapper.updateWorkOrder()` agora usa `@BeanMapping(nullValuePropertyMappingStrategy = IGNORE)`.
- Campos omitidos no PATCH nao sobrescrevem valores existentes com `null`.
- `title` existente permanece no registro quando o payload parcial nao envia `title`.
- Criacao de OS continua usando o modelo/validacao atual, portanto criar OS sem titulo continua bloqueado.

### P0.2 - DELETE `/requests/{id}` ownership check

Corrigido em `RequestController.delete()`.

- Antes comparava `user.id` com `request.id`.
- Agora compara `request.createdBy` com `user.id` usando `Objects.equals(...)`.
- Usuario dono da Request pode excluir a propria Request quando a regra permitir.
- Usuario sem permissao nao ganha acesso por coincidencia de IDs.
- Admin/permissao `deleteOtherPermissions.REQUESTS` continua funcionando.

### P0.3 - GET WorkOrders por asset/location com Customer Scope

Corrigido em `WorkOrderController`.

- `GET /work-orders/asset/{id}` valida `customerScopeService.assertCanAccessAsset(user, id)`.
- `GET /work-orders/location/{id}` valida `customerScopeService.assertCanAccessLocation(user, id)`.
- O retorno tambem filtra por `canViewWorkOrderBase(...)` e `customerScopeService.canAccessWorkOrderBase(...)`.
- REQUESTER fora do escopo recebe bloqueio/resultado filtrado.
- Admin/Super Admin e tecnico seguem a regra atual de visibilidade.

### Arquivos alterados

- `api/src/main/java/com/grash/mapper/WorkOrderMapper.java`
- `api/src/main/java/com/grash/controller/RequestController.java`
- `api/src/main/java/com/grash/controller/WorkOrderController.java`

### Validacao tecnica

- `cd api && .\mvnw.cmd -DskipTests compile`: OK.
- Warnings: apenas avisos pre-existentes de Lombok/Builder/equals/hashCode.
- Docker `--no-cache`: pendente porque o Docker Desktop/engine nao estava disponivel (`dockerDesktopLinuxEngine` ausente).

### Nao alterado

- Banco.
- Migrations.
- Endpoints.
- Permissoes/roles.
- Customer Scope estrutural.
- Mobile.
- Frontend.
- CORS.
- Storybook.
- Regras de status/fluxo de OS.
