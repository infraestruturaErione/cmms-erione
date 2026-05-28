## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**Project environment (Obsidian vault):** `C:\Users\caios_\Documents\ObsidianVault\Projetos\Atlas-CMMS`

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- For project analysis docs, reference `C:\Users\caios_\Documents\ObsidianVault\Projetos\Atlas-CMMS\` (e.g. `Auditoria-Roles-Permissoes-Erione-CMMS.md`).

## Mobile — CORS

If you get CORS errors from Expo Web (`localhost:8081` → API `localhost:8080`):
1. Make sure `EXTRA_CORS_ORIGINS` in root `.env` includes `http://localhost:8081`
2. Recreate API container: `docker compose up -d --force-recreate api`

## Mobile — API URL

Configurada em `mobile/.env`:
```env
API_URL=http://localhost:8080   # Expo Web
API_URL=http://192.168.x.x:8080 # Celular físico
```
Lida por `mobile/config.ts` → `getApiUrl()` → `Constants.expoConfig?.extra?.API_URL ?? process.env.API_URL`.

## Mobile — Login

Não há mais tela de "Servidor customizado". `CustomServerScreen.tsx` deletado. `customApiUrl` não é mais lido do AsyncStorage.

Login redesenhado com identidade Erione: logo 72px, "Bem-vindo de volta", campos com ícones, rodapé "© 2026 Erione".

## MVP — Módulos ocultos via ERIONE_HIDDEN_MODULES

Parts, Meters, Inventory (parts tab), PurchaseOrders e Vendors foram removidos da UX do MVP.

**Frontend:** sidebar, topnav, rotas com redirect, features settings, roles — tudo gated.
**Backend:** auditado mas NÃO alterado. ~70 arquivos envolvidos.
**Banco:** NÃO alterado. Nenhuma migration destrutiva.

### Mecanismo de gating: `ERIONE_HIDDEN_MODULES`

Definido em `frontend/src/config/erioneModules.ts`, controla quais módulos ficam ocultos:

```ts
export const ERIONE_HIDDEN_MODULES = {
  parts: true,
  inventory: true,
  meters: true,
  purchaseOrders: true,
  vendors: true
};
```

Usado com:
- Spread condicional em arrays (`tabs`, `fields`, `columns`) com type assertion `as IField[]`
- `&&` em JSX condicional para checkboxes e elementos visuais
- `Navigate` redirect em rotas (`/app/parts` → `/app/work-orders`, etc.)
- Guard condition no componente (`if (hidden) { navigate('/app/work-orders'); return null; }`)

**Cuidados TypeScript:** spreads condicionais em `IField[]` precisam de `as IField[]` ou `as const` nos fields; spreads em `Map` constructor precisam de `as any` para evitar erro de overload.

### Módulos ocultos e comportamento

| Módulo | Sidebar | TopNav | Rota direta | Settings |
|--------|---------|--------|-------------|----------|
| `parts` | ❌ | ❌ | Redirect → /app/work-orders | Redirect → /app/settings/features |
| `inventory` | ❌ (só sets) | ❌ | Redirect → /app/work-orders | N/A |
| `meters` | ❌ | ❌ | Redirect → /app/work-orders | Redirect → /app/settings/features |
| `purchaseOrders` | ❌ | ❌ | Redirect → /app/work-orders | N/A |
| `vendors` | ❌ | ❌ | Redirect → /app/work-orders | Redirect → /app/settings/features |

### Arquivos alterados (gating via ERIONE_HIDDEN_MODULES)

| Arquivo | O quê |
|---------|-------|
| `router/app.tsx` | Rotas `parts`/`meters`/`purchase-orders`/`vendors-customers/vendors` condicionais; redirect p/ work-orders se hidden |
| `router/analytics.tsx` | Analytics de parts removido |
| `layouts/.../SidebarMenu/items.ts` | Items parts/meters/inventory/purchaseOrders/vendors gated |
| `layouts/.../Header/ErioneTopNav.tsx` | Items meters gated |
| `config/erioneModules.ts` | Definição dos módulos ocultos |
| `Assets/Show/index.tsx` | Tabs `parts`/`meters` + form field `parts` + renderização dinâmica por valor de tab |
| `Assets/index.tsx` | Form field `parts` |
| `Categories/CategoriesLayout.tsx` | Tab `meter` |
| `PurchaseOrders/PurchaseOrderDetails.tsx` | Tab `parts` |
| `PurchaseOrders/Create.tsx` | Field `partQuantities` + validação + dispatch |
| `PurchaseOrders/index.tsx` | Columns `itemsNumber`/`totalCost`/`totalQuantity` + field `partQuantities` + dispatch |
| `Imports/index.tsx` | Options `parts`/`meters` |
| `Settings/Roles/RoleDetails.tsx` | Permission rows `meters`/`parts_and_sets`/`purchaseOrders`/`vendors` gated |
| `Settings/Roles/PageHeader.tsx` | Checkboxes `deletePartsAndSets`/`deleteMeters`/`deletePurchaseOrders`/`deleteVendorsCustomers` gated; código Free/Paid removido |
| `Settings/Roles/EditRole.tsx` | Initial values + checkboxes `deletePartsAndSets`/`deleteMeters`/`deletePurchaseOrders`/`deleteVendorsCustomers` gated; label hardcoded corrigido |
| `Settings/Roles/index.tsx` | Permissions mapping entries `deletePartsAndSets`/`deleteMeters`/`deletePurchaseOrders`/`deleteVendorsCustomers` gated |
| `Settings/Features/Parts/index.tsx` | Redirect p/ `/app/settings/features` se hidden |
| `Settings/Features/Meters/index.tsx` | Redirect p/ `/app/settings/features` se hidden |
| `Settings/Features/Parts/CustomFields.tsx` | Redirect p/ `/app/settings/features` se hidden |
| `Settings/Features/Meters/CustomFields.tsx` | Redirect p/ `/app/settings/features` se hidden |
| `Settings/Features/index.tsx` | Module meters removido |
| `Inventory/index.tsx` | Parts tab removido, apenas sets |

Documentação da auditoria:
- `dev-docs/Auditoria-Backend-Parts-Meters.md` — inventário completo de dependências
- `dev-docs/Remocao-Parts-Meters-MVP.md` — plano de remoção em níveis A/B/C

Regras:
- NÃO dropar tabelas ainda
- NÃO apagar backend ainda
- NÃO quebrar Work Orders, Assets, Locations, Requests, People/Teams, Roles
- NÃO mexer em Customer Scope
- Usar `ERIONE_HIDDEN_MODULES` para esconder UI; código compilado mas não renderizado
- Após alterar gating, rodar `npm run build` no frontend

## Mobile — QuickFilter "Minhas OS"

O mobile tem um QuickFilter para `assignedToUser` ativado por padrão para qualquer usuário com `viewOtherPermissions.WORK_ORDERS`.

**Comportamento:**
- Técnico abre o app → vê **apenas OS atribuídas a ele** (filtro `assignedToUser = user.id`)
- Pode desligar o toggle para ver todas as OS da empresa
- `onRefresh()` preserva o filtro (pull-to-refresh não remove "Minhas OS")

**Implementação:**
- `mobile/screens/workOrders/WorkOrdersScreen.tsx`: função `getDefaultFilterFields()` + usado no `useState` inicial do `criteria` e no `onRefresh()`

## Roles & Permissions — Auditoria Concluída

Relatório completo: `C:\Users\caios_\Documents\ObsidianVault\Projetos\Atlas-CMMS\Auditoria-Roles-Permissoes-Erione-CMMS.md`

### Arquitetura de permissões
- Role define **o que** o usuário pode fazer (via 5 sets de `PermissionEntity`)
- **Não existe** escopo por cliente/cidade hoje
- Backend: `PermissionEntity` (15 valores, armazenados como smallint em join tables)
- Frontend: checkboxes mapeados via `permissionsMapping` no `index.tsx` → `formatValues()`
- Fluxo de visibilidade de OS: `WorkOrderService.getSearchCriteria()` — role-based filtering

### Regras de Roles
- Role **não** deve receber campo de customer/city scope — escopo futuro vai em User, não em Role
- `VIEW_ONLY` (paid=false) e `REQUESTER` (paid=false) não contam como assentos pagos
- `deletePartsAndSets`, `deleteMeters`, `deletePurchaseOrders` e `deleteVendorsCustomers` estão gated por `ERIONE_HIDDEN_MODULES`
- `BasicPermission` enum é legado (não usado)
- `CATEGORIES_WEB` é automático (não precisa de checkbox na UI)
- `paid`/`free`/`upgrade_role*` translations existem mas não são usadas na UI

### Decision record
| Decisão | Data |
|---------|------|
| Escopo futuro por cidade/cliente deve ir em **User**, não em Role | 2026-05-26 |
| `CATEGORIES_WEB` não precisa de checkbox na UI | 2026-05-26 |
| Mobile técnico usa MESMA regra de visibilidade que web | 2026-05-26 |
| `WORK_ORDERS` em `viewOtherPermissions` é o toggle que separa "ver só as minhas" de "ver todas" | 2026-05-26 |
