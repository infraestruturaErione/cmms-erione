# Auditoria de Produção — Erione CMMS

> **Data:** 26/05/2026
> **Base:** GitHub `infraestruturaErione/cmms-erione` @ `b7a88ec`
> **Comparação:** ObsidianVault `CmmSErione/` (documentação de 11/05/2026)
> **Objetivo:** Gap analysis — o que falta para rodar em produção como um "Auvo"
> **⚠️ Nenhum código foi alterado durante esta auditoria.**

---

## Resumo Executivo

O repositório em `b7a88ec` **já avançou significativamente** além do que está documentado no ObsidianVault. Muitos itens planejados no roadmap foram implementados. Ainda assim, existem **gaps críticos** para produção.

| Categoria | Feito | Falta | Risco |
|-----------|-------|-------|-------|
| Branding | ✅ Nome, layout, logo, cores | 🔴 i18n (15 idiomas) | 🔴 ALTO |
| Field Service | ✅ Geolocalização, status EN_ROUTE | 🟡 Status AWAITING_APPROVAL | 🟡 MÉDIO |
| License | ⚠️ Bypass hardcoded ativo | 🔴 Remover bypass p/ produção | 🔴 ALTO |
| Segurança | ✅ CORS, Rate Limit, CSRF off | 🔴 Swagger exposto, JWT fraco | 🔴 ALTO |
| Infra | ✅ dockerignore, compose, .env | 🔴 SMTP, GCP, OAuth2 vazios | 🔴 ALTO |
| Mobile | ✅ Branding na UI | 🟡 IDs (bundle, package) | 🟡 MÉDIO |

---

## 1. 🟢 O Que Já Está Feito (além do vault)

Itens do ObsidianVault que **já foram implementados** mas não estão documentados lá:

| Item | Local | Commit |
|------|-------|--------|
| Branding "Erione CMMS" | `frontend/public/index.html`, layouts | `63e2ab1` |
| Sidebar/header Erione | `frontend/src/layouts/ExtendedSidebarLayout/` | `0cd0365` |
| Logo, favicon Erione | `frontend/public/` | `63e2ab1` |
| Status `EN_ROUTE` | `Status.java` | `3be9a55` |
| Check-in/out fields (11 campos) | `WorkOrder.java:90-130` | `7671947` |
| Field endpoints check-in/out | `WorkOrderController.java` | `7671947` |
| Customer scoping | `getSearchCriteria()`, `CustomerScope` | `3be9a55` |
| Customer/location hubs | Frontend páginas dedicadas | `14c110e` |
| Mobile branding Erione | `mobile/app.config.ts`, navegação | `63e2ab1` |
| frontend/.dockerignore | `frontend/.dockerignore` | `fbaf4e1` |
| Raiz .dockerignore | `.dockerignore` | Após 11/05 |
| PlanFeatures liberadas | `LicenseService.hasEntitlement()` = true | `342f173` |
| SubscriptionPlanService.save() | `SubscriptionPlanService.java` | `342f173` |
| ApiApplication loop planos | `ApiApplication.java` | `342f173` |
| useLicenseEntitlement bypass | `frontend/src/hooks/useLicenseEntitlement.ts` | `342f173` |
| WorkOrder check-in/check-out/start-travel | WorkOrderController + WorkOrderService | `7671947` |

---

## 2. 🔴 Gaps Críticos (Bloqueantes para Produção)

### 2.1 Branding — Traduções (i18n) ainda com "Atlas CMMS" e "Grash"

**15 arquivos** de tradução ainda contêm referências ao produto original:

`frontend/src/i18n/translations/`:
- `pt.ts` (português)
- `en.ts` (inglês)
- `es.ts` (espanhol)
- `fr.ts` (francês)
- `de.ts`, `it.ts`, `nl.ts`, `ar.ts`, `zh.ts`, `ja.ts`, `ko.ts`, `ru.ts`, `pl.ts`, `tr.ts`, `ro.ts`

**Strings contaminadas** (exemplo do `pt.ts`):
- `free_cmms.title`: `"Atlas Free CMMS..."` → trocar para `"Erione CMMS"`
- `pricing.title`: `"Pricing - Atlas CMMS"` → `"Planos - Erione CMMS"`
- `try_grash`: chave/valor mencionando "grash"
- SEO descriptions/keywords com "Atlas CMMS"

**Ação:** Substituir todas as ocorrências de "Atlas CMMS", "Grash", "Intelloop" nos 15 arquivos. Usar `{{shortBrandName}}` onde existir interpolação.

---

### 2.2 Licenciamento — Bypass Hardcoded

`LicenseService.java:70`:

```java
public boolean hasEntitlement(LicenseEntitlement entitlement) {
    return true; // ← bypass ativo
}
```

**Problema:** O bypass é 100% hardcoded. Em produção, qualquer instância tem acesso a todas as features sem validação.

**Ação:** Substituir por flag de ambiente `ERIONE_DEV_UNLOCK_FEATURES`:
```java
if ("true".equalsIgnoreCase(System.getenv("ERIONE_DEV_UNLOCK_FEATURES"))) return true;
// comportamento original abaixo
return validateLicense(entitlement);
```

**Arquivos afetados:**
- `api/.../service/LicenseService.java`
- `api/.../ApiApplication.java` (loop de planos)
- `frontend/.../useLicenseEntitlement.ts`
- `frontend/.../slices/license.ts`

**Impacto:** 🔴 Se enviar para produção sem reverter, qualquer um roda o sistema completo sem licença.

---

### 2.3 Segurança — Swagger/API Docs Exposto

`WebSecurityConfig.java:83-85`:
```
/swagger-ui/**, /swagger-ui.html, /v3/api-docs/** → permitAll()
```

**Problema:** Qualquer pessoa pode acessar a documentação completa da API, ver todos os endpoints, schemas, e exemplos de request/response sem autenticação.

**Ação:** Em produção:
1. Remover `permitAll()` do Swagger, ou
2. Proteger com autenticação básica, ou
3. Desabilitar via `springdoc.api-docs.enabled: false` no profile de produção

---

### 2.4 Segurança — JWT Secret Fraco

`.env:11`:
```
JWT_SECRET_KEY=ZGV2LWxvY2FsLWp3dC1zZWNyZXQta2V5LWZvci1hdGxhcy1jbW1zLWFwcA==
```

Isso decodifica para: `"dev-local-jwt-secret-key-for-atlas-cmms-app"` — uma string de 42 chars, **não** uma chave criptograficamente segura de 256-bit.

**Risco:** 🔴 Qualquer um que conheça essa string pode forjar tokens JWT e se passar por qualquer usuário.

**Ação:** Gerar uma chave real:
```powershell
# Linux/macOS:
# openssl rand -base64 32

# PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

### 2.5 Segurança — Endpoint `/demo/generate-account` Público

`WebSecurityConfig.java:72`: `GET /demo/generate-account` é `permitAll()`.

**Problema:** Qualquer pessoa pode gerar contas de demonstração no sistema sem autenticação.

**Ação:** Restringir para autenticados ou desabilitar em produção com profile.

---

### 2.6 Variáveis de Ambiente — Produção Vazias

| Variável | Situação | Impacto |
|----------|----------|---------|
| `SMTP_PWD`, `SMTP_USER`, `SMTP_FROM` | Vazias | ❌ E-mail não funciona (notificações, recovery, convite) |
| `GOOGLE_KEY` | Vazia | ❌ Google Maps não funciona (geolocalização, check-in/out) |
| `GCP_BUCKET_NAME`, `GCP_JSON`, `GCP_PROJECT_ID` | Vazias | ❌ Se usar GCP storage, não funciona |
| `MAIL_RECIPIENTS` | Vazia | ❌ Admin não recebe notificações de novos cadastros |
| `LICENSE_KEY` | Vazia | ⚠️ License bypass ativo, mas sem chave real |
| `OAUTH2_CLIENT_ID/SECRET` | Vazias | ⚠️ SSO não funciona |
| `SENDGRID_API_KEY` | Vazia | ⚠️ Se usar SendGrid, não funciona |

---

### 2.7 PostgreSQL — Credenciais Fracas

`.env`:
```
POSTGRES_USER=atlas
POSTGRES_PWD=atlas123
```

Senha trivial. Em produção exposto na rede interna, ainda assim é um vetor de ataque.

---

## 3. 🟡 Gaps Médios

### 3.1 Status `AWAITING_APPROVAL` Ausente

O roadmap (`Roadmap-Backend-Erione-Field.md`) previa este status para o fluxo de validação pós-atendimento, mas ele não existe em `Status.java`.

**Workaround atual:** Usar `ON_HOLD` ou `COMPLETE` com flag de aprovação. Sem bloqueio funcional.

---

### 3.2 Mobile — Identifiers ainda "atlas"

| Arquivo | Campo | Valor Atual | Correto |
|---------|-------|-------------|---------|
| `mobile/app.config.ts` | `ios.bundleIdentifier` | `com.cmms.atlas` | `com.erione.cmms` |
| `mobile/app.config.ts` | `android.package` | `com.atlas.cmms` | `com.erione.cmms` |
| `mobile/package.json` | `name` | `atlas` | `erione-cmms` |

**Impacto:** Impede publicação nas lojas com identidade Erione.

---

### 3.3 Branding — Favicon

Verificar se o favicon em `frontend/public/` foi atualizado para o ícone Erione (não mais o atlas padrão).

---

### 3.4 MinIO — Credenciais Fracas

```
MINIO_USER=minioadmin
MINIO_PASSWORD=minioadmin123
```

Senha trivial para o storage de arquivos (fotos, anexos, assinaturas).

---

### 3.5 CORS Ativado em Dev

`ENABLE_CORS=true` no `.env` de desenvolvimento. Em produção, deve ser `false` (ou configurado com origens específicas).

---

## 4. 🟢 Gaps Baixos / Observações

### 4.1 LDAP Warnings

Os warnings `"The X variable is not set. Defaulting to a blank string."` no docker compose são cosméticos. LDAP está desabilitado (`LDAP_ENABLED=false`).

**Ação:** Adicionar as variáveis ao `.env` com valores dummy para silenciar (opcional).

---

### 4.2 Super Admin com Senha Fraca

`superadmin@test.com` / `pls_change_me` — user criado automaticamente no startup. Em produção, desabilitar ou alterar senha.

---

### 4.3 Intercom Ativo

`application.yml:193`: `intercom.token: ${INTERCOM_TOKEN:}` — sem token, falha silenciosamente. Em produção, remover ou configurar.

---

### 4.4 Paddle Sem Credenciais

`PADDLE_API_KEY` vazio — endpoints de checkout/faturamento falham. Se for usar Paddle para billing, configurar.

---

## 5. Comparação Vault vs Realidade

| Item do Vault | Status no Código |
|--------------|------------------|
| Liberação de features (LicenseService + ApiApplication + SubscriptionPlanService + useLicenseEntitlement) | ✅ **FEITO** (idêntico ao descrito) |
| `.dockerignore` frontend e raiz | ✅ **FEITO** |
| Branding Erione (logo, título, sidebar) | ✅ **FEITO** |
| Check-in/out fields no WorkOrder | ✅ **FEITO** |
| Status `EN_ROUTE` | ✅ **FEITO** |
| Flag `ERIONE_DEV_UNLOCK_FEATURES` | ❌ **NÃO FEITO** — bypass continua hardcoded |
| Reverter bypass antes de produção | ❌ **NÃO FEITO** |
| Traduções (i18n) sem Atlas/Grash | ❌ **NÃO FEITO** — 15 arquivos contaminados |
| Mobile identifiers corrigidos | ❌ **NÃO FEITO** — ainda "atlas" |
| Status `AWAITING_APPROVAL` | ❌ **NÃO FEITO** — não existe |
| WorkOrderApproval entidade | ❌ **NÃO FEITO** — não existe |
| Relatório customizado Erione | ❌ **NÃO FEITO** — não existe |

---

## 6. Checklist de Produção (Ordem Recomendada)

### 🔴 Semana 1 — Críticos
- [ ] Substituir `JWT_SECRET_KEY` por chave criptograficamente segura (256-bit Base64)
- [ ] Substituir `POSTGRES_PWD` e `POSTGRES_USER` por credenciais fortes
- [ ] Substituir `MINIO_PASSWORD` por senha forte
- [ ] Proteger Swagger: desabilitar ou autenticar
- [ ] Remover/desabilitar `/demo/generate-account` público
- [ ] Criar profile `production` com CORS restrito, Swagger off

### 🔴 Semana 2 — Licenciamento & Branding
- [ ] Implementar flag `ERIONE_DEV_UNLOCK_FEATURES` no LicenseService
- [ ] Criar condicional no ApiApplication (planos) e useLicenseEntitlement
- [ ] Reverter bypass hardcoded
- [ ] Scrub "Atlas CMMS" / "Grash" / "Intelloop" nos 15 arquivos i18n

### 🟡 Semana 3 — Infra & Mobilidade
- [ ] Configurar SMTP (credenciais reais)
- [ ] Configurar Google Maps API Key
- [ ] Configurar storage (GCP ou MinIO com credenciais fortes)
- [ ] Corrigir mobile identifiers (iOS bundle, Android package, package.json name)
- [ ] Trocar favicon se ainda for o antigo

### 🟡 Semana 4 — Field Service & UX
- [ ] Avaliar se precisa de `AWAITING_APPROVAL` no fluxo
- [ ] Testar fluxo completo: abertura → atribuição → check-in → execução → check-out → fechamento
- [ ] Testar mobile conectado ao backend de produção
- [ ] Testar portal público de solicitação

---

## 7. Riscos Não Mitigados

| Risco | Gravidade | Por quê |
|-------|-----------|---------|
| **Multi-tenancy parcial** | 🟠 MÉDIO | `TenantAspect` só cobre POST/PATCH. Getters dependem de filtro manual nos services. Uma falha = vazamento de dados entre empresas. |
| **Sem testes automatizados** | 🟠 MÉDIO | Nenhum teste unitário ou de integração detectado. Qualquer alteração é manual. |
| **BCrypt cost 12** | 🟢 BAIXO | Custo alto para login (pode ser lento em hardware fraco). Aceitável para produção. |

---

> **Conclusão:** O código em `b7a88ec` está funcional para **desenvolvimento e demonstração**, mas **não está pronto para produção**. Os maiores riscos são (1) bypass de licença, (2) JWT secret frágil, (3) Swagger exposto, (4) traduções com marca antiga, e (5) variáveis de ambiente vazias. Estima-se **2-4 semanas** de trabalho para resolver todos os itens críticos e médios.
