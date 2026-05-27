# Remoção Parts/Meters — Plano MVP

## Status Atual

Frontend: ✅ **Concluído** — rotas, sidebar, topnav, features, roles (paid/free) limpos.
Backend: ❌ **Não iniciado** — controllers, services, entities, endpoints intactos.

## Proposta de Execução

### Fase 1 — Frontend ✅ (JÁ FEITO)
- Remover rotas Parts/Meters do router
- Remover sidebar e topnav
- Remover features settings
- Remover coluna paid/free e gating de subscription em Roles
- Adicionar redirect People/Teams
- `erioneModules.ts` com `parts: true, meters: true`

### Fase 2 — Backend Seguro (Nível A)
**Estimativa: 2-3 horas**

Remover apenas controllers e endpoints que não afetam entities JPA:

1. `PartAnalyticsController.java` + 6 DTOs de analytics
2. `MultiPartsController.java`
3. Endpoints `/import/parts`, `/import/meters`, `/export/parts`, `/export/meters`
4. CSV templates `meter.csv` (en/fr/tr)
5. `PartQuantityController.java` endpoints (manter service p/ dados existentes)
6. Desabilitar `/part-categories` e `/meter-categories`
7. Remover telas mobile de Parts (`mobile/screens/parts/`, `mobile/components/PartQuantities.tsx`, etc.)
8. Remover telas mobile de Meters (`mobile/screens/meters/`, etc.)

### Fase 3 — Backend Entidades (Nível B)
**Estimativa: 1-2 dias**

Remover entities + ajustar JPA relationships:

**Parts:**
- Remover `Part.java`, `PartQuantity.java`, `PartConsumption.java`, `PartCategory.java`, `MultiParts.java`
- Remover `@ManyToMany List<Part> parts` de `Asset.java`
- Remover `@ManyToMany List<Part> parts` de `File.java`
- Remover `@ManyToOne Part part` de `CustomFieldValue.java`
- Remover `@ManyToOne Part part` de `WorkflowCondition.java`
- Remover `PartCondition`, `PartAction`, `PartField`, `WebhookEvent.*PART*`
- Remover `WorkflowService.runPart()`
- Remover `LicenseEntitlement.UNLIMITED_PARTS`, `LOW_STOCK_ALERTS`, `PARTS_COST_TRACKING`
- Ajustar `PurchaseOrderController` — remover lógica de aprovação que atualiza estoque
- Ajustar `WorkOrderController` — remover `getByPart()`
- Ajustar `DemoDataService` — remover criação demo de Parts

**Meters:**
- Remover `Meter.java`, `Reading.java`, `WorkOrderMeterTrigger.java`
- Remover `@ManyToOne Meter meter` de `TaskBase.java`
- Remover `@ManyToOne Meter meter` de `CustomFieldValue.java`
- Remover `MeterCategory.java`
- Remover `WorkOrderMeterTriggerCondition`
- Ajustar `ReadingController` — remover fluxo de criação de WO por trigger

### Fase 4 — Banco (Nível C)
**Estimativa: Agendamento futuro**

- Migration para dropar tabelas após backup
- Limpeza de changelogs Liquibase
- Commit separado com `context="legacy"` nos changelogs

---

## Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| WorkOrder existentes com PartQuantity/PartConsumption perdem referência | Alta | Médio | ON DELETE CASCADE preserva WO; dados de custo somem |
| Asset-Part join table com dados reais | Média | Alto | Fazer script de migração para extrair dados antes de dropar |
| Workflow conditions de PART paradas em WO pendentes | Baixa | Médio | Desativar workflows de Part antes de remover |
| Trigger de Meter cria WO automaticamente | Média | Alto | Manter último ciclo de trigger; depois remover |
| Mobile app ainda chama endpoints de Parts/Meters | Alta | Alto | Remover telas mobile antes dos endpoints backend |

---

## Checklist de Execução

### Pré-requisitos
- [ ] Backup do banco de produção
- [ ] Identificar WOs com PartQuantity/PartConsumption ativas
- [ ] Identificar Assets com Parts associadas
- [ ] Identificar Meters com Readings ativas
- [ ] Identificar WorkOrderMeterTriggers ativos
- [ ] Commitar remoção frontend (já feito)

### Fase 2 (Nível A)
- [ ] Remover `PartAnalyticsController.java`
- [ ] Remover `MultiPartsController.java`
- [ ] Remover endpoints import/export Parts/Meters
- [ ] Remover CSV templates de meter
- [ ] Desabilitar PartCategoryController / MeterCategoryController
- [ ] Remover telas mobile de Parts
- [ ] Remover telas mobile de Meters
- [ ] Build + testar

### Fase 3 (Nível B)
- [ ] Remover todas as entities de Part
- [ ] Ajustar Asset entity
- [ ] Ajustar File entity
- [ ] Ajustar CustomFieldValue entity
- [ ] Ajustar WorkflowCondition entity
- [ ] Ajustar TaskBase entity
- [ ] Ajustar WorkflowService
- [ ] Ajustar PurchaseOrderController
- [ ] Ajustar WorkOrderController
- [ ] Ajustar DemoDataService
- [ ] Remover mappers, services, repositories de Part
- [ ] Remover todas as entities de Meter
- [ ] Remover mappers, services, repositories de Meter
- [ ] Ajustar ImportService / ExportService / Async*
- [ ] Build + testar

### Fase 4 (Nível C)
- [ ] Migration DROP TABLE
- [ ] Limpar changelogs Liquibase
- [ ] Build + testar
