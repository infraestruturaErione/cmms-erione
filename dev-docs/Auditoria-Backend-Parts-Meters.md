# Auditoria Backend — Parts & Meters

## 1. Mapa de Dependências — Parts

### 1.1 Controllers (5)
| Arquivo | Base Path | Endpoints |
|---------|-----------|-----------|
| `PartController.java` | `/parts` | POST search, GET /{id}, POST create, PATCH /{id}, GET /mini, DELETE /{id} |
| `PartQuantityController.java` | `/part-quantities` | GET /work-order/{id}, GET /purchase-order/{id}, PATCH /work-order/{id}, PATCH /purchase-order/{id}, CRUD |
| `PartCategoryController.java` | `/part-categories` | CRUD |
| `MultiPartsController.java` | `/multi-parts` | CRUD + GET /mini |
| `PartAnalyticsController.java` | `/analytics/parts` | POST /consumptions/overview, /pareto, /assets, /parts-category, /work-order-category, /date |

### 1.2 Services (5)
`PartService`, `PartQuantityService`, `PartConsumptionService`, `PartCategoryService`, `MultiPartsService`

### 1.3 Repositories (5)
`PartRepository`, `PartQuantityRepository`, `PartConsumptionRepository`, `PartCategoryRepository`, `MultiPartsRepository`

### 1.4 Entities (5)
| Entidade | Tabela | Relações JPA |
|----------|--------|--------------|
| `Part` | `part` | @ManyToMany → Asset, File, User, Team, Customer, Vendor, PreventiveMaintenance; @OneToMany → PartQuantity, PartConsumption, CustomFieldValue; @ManyToOne → PartCategory; @OneToOne → File (image) |
| `PartQuantity` | `part_quantity` | @ManyToOne → Part, WorkOrder, PurchaseOrder |
| `PartConsumption` | `part_consumption` | @ManyToOne → Part, WorkOrder |
| `PartCategory` | `part_category` | @ManyToOne → CompanySettings (via CategoryAbstract) |
| `MultiParts` | `multi_parts` | @ManyToMany → Part |

### 1.5 DTOs (~17)
`PartPostDTO`, `PartPatchDTO`, `PartShowDTO`, `PartMiniDTO`, `PartQuantityShowDTO`, `PartQuantityPatchDTO`, `PartQuantityCompletePatchDTO`, `MultiPartsShowDTO`, `MultiPartsMiniDTO`, `MultiPartsPatchDTO`, `PartImportDTO`, `PartStats`, `PartConsumptionsByPart`, `PartConsumptionsByMonth`, `PartConsumptionsByAsset`, `PartConsumptionByCategory`, `PartConsumptionByWOCategory`

### 1.6 Mappers (4)
`PartMapper`, `PartQuantityMapper`, `PartCategoryMapper`, `MultiPartsMapper`

### 1.7 Enums Part-relacionados
- `PermissionEntity.PARTS_AND_MULTIPARTS` (33 referências)
- `NotificationType.PART`
- `CustomFieldEntityType.PART`
- `WebhookEvent.NEW_PART`, `PART_CHANGE`, `PART_DELETE`, `PART_QUANTITY_CHANGED`
- `WFMainCondition.PART_UPDATED`
- `PartCondition` (workflow): `PART_IS`, `QUANTITY_INFERIOR`
- `PartAction` (workflow): `CREATE_PURCHASE_ORDER`
- `PartField` (webhook): 17 fields

### 1.8 Licenciamento
- `LicenseEntitlement.UNLIMITED_PARTS` — checado em `PartService.checkUsageBasedLimit()`
- `LicenseEntitlement.LOW_STOCK_ALERTS`
- `LicenseEntitlement.PARTS_COST_TRACKING`

### 1.9 Liquibase (9 changelogs)
Tabelas: `part`, `part_category`, `part_quantity`, `part_consumption`, `multi_parts`, `t_part_user_associations`, `t_part_file_associations`, `t_part_customer_associations`, `t_part_vendor_associations`, `t_part_team_associations`, `t_asset_part_associations`, `t_multi_parts_part_associations`, `part_preventive_maintenances`

---

## 2. Mapa de Dependências — Meters

### 2.1 Controllers (3)
| Arquivo | Base Path | Endpoints |
|---------|-----------|-----------|
| `MeterController.java` | `/meters` | POST search, GET /mini, GET /{id}, POST create, PATCH /{id}, GET /asset/{id}, DELETE /{id} |
| `ReadingController.java` | `/readings` | GET /meter/{id}, POST create, PATCH /{id}, DELETE /{id} |
| `WorkOrderMeterTriggerController.java` | `/work-order-meter-triggers` | GET /{id}, POST create, GET /meter/{id}, PATCH /{id}, DELETE /{id} |

### 2.2 Services (3)
`MeterService`, `ReadingService`, `WorkOrderMeterTriggerService`

### 2.3 Repositories (3)
`MeterRepository`, `ReadingRepository`, `WorkOrderMeterTriggerRepository`

### 2.4 Entities (3)
| Entidade | Tabela | Relações JPA |
|----------|--------|--------------|
| `Meter` | `meter` | @ManyToOne → Asset (required), @ManyToOne → MeterCategory, @ManyToOne → Location, @ManyToMany → User, @OneToMany → Reading, @OneToMany → WorkOrderMeterTrigger, @OneToMany → CustomFieldValue, @OneToOne → File (image) |
| `Reading` | `reading` | @ManyToOne → Meter (required) |
| `WorkOrderMeterTrigger` | `work_order_meter_trigger` | @ManyToOne → Meter (required); extends WorkOrderBase |

### 2.5 DTOs (~9)
`MeterPostDTO`, `MeterPatchDTO`, `MeterShowDTO`, `MeterMiniDTO`, `MeterImportDTO`, `ReadingPatchDTO`, `WorkOrderMeterTriggerPostDTO`, `WorkOrderMeterTriggerShowDTO`, `WorkOrderMeterTriggerPatchDTO`

### 2.6 Mappers (3)
`MeterMapper`, `ReadingMapper`, `WorkOrderMeterTriggerMapper`

### 2.7 Enums Meter-relacionados
- `PermissionEntity.METERS` (16 referências)
- `CustomFieldEntityType.METER`
- `PlanFeatures.METER` (guarda criação de Meter e Reading)
- `WorkOrderMeterTriggerCondition`: `LESS_THAN`, `MORE_THAN`

### 2.8 Cross-entity References
- `TaskBase.java`: `@ManyToOne Meter meter` (nullable — task opcionalmente associada a meter)
- `CustomFieldValue.java`: `@ManyToOne Meter meter`
- `Asset.java`: NÃO tem field Meter (relação é unidirecional de Meter → Asset)

### 2.9 Import/Export
- `POST /import/meters`
- `GET /export/meters`
- CSV templates: `meter.csv` (en, fr, tr)
- `ImportService.importMeters()`, `AsyncImportService.importMeters()`, `AsyncExportService.exportMeters()`

---

## 3. Endpoints REST — Lista Completa

### Parts
| Método | Path | Controller |
|--------|------|------------|
| POST | `/parts/search` | PartController |
| GET | `/parts/{id}` | PartController |
| POST | `/parts` | PartController |
| PATCH | `/parts/{id}` | PartController |
| GET | `/parts/mini` | PartController |
| DELETE | `/parts/{id}` | PartController |
| GET | `/part-quantities/work-order/{id}` | PartQuantityController |
| GET | `/part-quantities/purchase-order/{id}` | PartQuantityController |
| PATCH | `/part-quantities/work-order/{id}` | PartQuantityController |
| PATCH | `/part-quantities/purchase-order/{id}` | PartQuantityController |
| GET/POST/PATCH/DELETE | `/part-quantities[/{id}]` | PartQuantityController |
| GET/POST/PATCH/DELETE | `/part-categories[/{id}]` | PartCategoryController |
| GET/POST/PATCH/DELETE | `/multi-parts[/{id}]` | MultiPartsController |
| GET | `/multi-parts/mini` | MultiPartsController |
| POST | `/analytics/parts/consumptions/*` (6) | PartAnalyticsController |
| POST | `/import/parts` | ImportController |
| GET | `/export/parts` | ExportController |
| GET | `/work-orders/part/{id}` | WorkOrderController |

### Meters
| Método | Path | Controller |
|--------|------|------------|
| POST | `/meters/search` | MeterController |
| GET | `/meters/mini` | MeterController |
| GET | `/meters/{id}` | MeterController |
| POST | `/meters` | MeterController |
| PATCH | `/meters/{id}` | MeterController |
| GET | `/meters/asset/{id}` | MeterController |
| DELETE | `/meters/{id}` | MeterController |
| GET | `/readings/meter/{id}` | ReadingController |
| POST | `/readings` | ReadingController |
| PATCH | `/readings/{id}` | ReadingController |
| DELETE | `/readings/{id}` | ReadingController |
| GET | `/work-order-meter-triggers/{id}` | WorkOrderMeterTriggerController |
| POST | `/work-order-meter-triggers` | WorkOrderMeterTriggerController |
| GET | `/work-order-meter-triggers/meter/{id}` | WorkOrderMeterTriggerController |
| PATCH | `/work-order-meter-triggers/{id}` | WorkOrderMeterTriggerController |
| DELETE | `/work-order-meter-triggers/{id}` | WorkOrderMeterTriggerController |
| POST | `/import/meters` | ImportController |
| GET | `/export/meters` | ExportController |
| GET | `/import/download-template` (parâmetro METER) | ImportController |

---

## 4. Impacto — Se Remover Part do Backend

### O QUE QUEBRA (🔥 Ruim / ⚠️ Gerenciável / ✅ Seguro)

| Dependência | Tipo | Gravidade | Detalhe |
|------------|------|-----------|---------|
| WorkOrder | Indireta | ⚠️ | `WorkOrderController.getByPart()` endpoint quebra; cálculo de custo de WO via `partQuantityService.findByWorkOrder()` perde fonte; PDF de WO perde peças |
| Asset | @ManyToMany Part | 🔥 | `Asset.parts` field precisa ser removido da entidade; join table `t_asset_part_associations` ficaria órfã |
| PurchaseOrder | Indireta | 🔥 | PO usa PartQuantity como line items; aprovação de PO aumenta estoque de Part → lógica de negócio inteira quebra |
| MultiParts (Sets) | @ManyToMany Part | 🔥 | Sets de peças perdem todo propósito sem Parts |
| CustomFieldValue | @ManyToOne Part | 🔥 | FK precisa ser removida; custom fields de Part deixam de existir |
| Workflow | PartCondition + PartAction + Part | 🔥 | WorkflowCondition referencia Part entity; WorkflowAction tem PartAction; WorkflowService.runPart() quebra |
| File | @ManyToMany Part | ⚠️ | File tem coleção de Parts; join table fica órfã |
| PreventiveMaintenance | @ManyToMany (inverse) | ⚠️ | Join table `part_preventive_maintenances` fica órfã |
| Analytics | Controller + 6 endpoints + 6 DTOs | ⚠️ | Todo o módulo de analytics de Parts perde sentido |
| Import/Export | 2 endpoints + CSV | ✅ | Import/export de Parts pode ser desabilitado |
| Notification | NotificationType.PART | ✅ | Notificações de Part não serão mais enviadas |
| Webhook | 4 WebhookEvents + PartField | ✅ | Webhooks de Part não serão mais disparados |
| DemoData | Cria Parts/PartCategories | ✅ | Demo data não será seedada |
| Licenciamento | 3 entitlements | ✅ | UNLIMITED_PARTS, LOW_STOCK_ALERTS, PARTS_COST_TRACKING podem ser ignorados |

### Work Orders dependem de Parts?
**Não diretamente.** WO não tem FK para Part. A conexão é via `PartQuantity` (peças alocadas na WO) e `PartConsumption` (consumo). Se remover Part:
- Peças não poderão mais ser alocadas em WOs
- WO existentes com PartQuantity/PartConsumption preservam dados (FK com ON DELETE CASCADE)
- Cálculo de custo de WO via Part fica zerado

### Assets dependem de Parts?
**Sim.** Asset tem `@ManyToMany List<Part> parts`. A join table `t_asset_part_associations` precisaria ser removida junto com o field.

### PurchaseOrders dependem de Parts?
**Sim, indiretamente.** PO usa `PartQuantity` como line items. Aprovação de PO executa `part.setQuantity(part.getQuantity() + quantity)`. Sem Part, esse fluxo quebra.

### PreventiveMaintenance depende de Parts?
**Não diretamente.** A relação é via join table `part_preventive_maintenances` (lado inverso em Part). PM não tem field Part.

### Inventory/Sets dependem de Parts?
**Sim.** `MultiParts` tem `@ManyToMany List<Part> parts`. Sem Part, Sets perdem todo propósito.

### Relatórios dependem de Parts?
**Sim.** `PartAnalyticsController` com 6 endpoints de consumo por asset, categoria, WO, mês, Pareto e overview.

### Mobile depende de Parts?
**Sim.** Telas: `PartsScreen`, `CreatePartScreen`, `EditPartScreen`, `PartDetails`, `PartFiles`, `PartAssets`, `PartWorkOrders`, `SelectPartsModal`, `PartQuantities`, `PartDetailsSheet`. Além do slice Redux `analytics/part`.

---

## 5. Impacto — Se Remover Meter do Backend

| Dependência | Tipo | Gravidade | Detalhe |
|------------|------|-----------|---------|
| Asset | @ManyToOne (Meter → Asset) | ⚠️ | Meter TEM Asset obrigatório. Remover Meter não quebra Asset (Asset não tem field Meter). Mas meters existentes perderiam referência |
| Reading | @ManyToOne Meter (required) | 🔥 | Reading entity inteira perderia sentido sem Meter |
| WorkOrderMeterTrigger | @ManyToOne Meter (required) | 🔥 | Trigger entity inteira perderia sentido; criação automática de WO por trigger quebraria |
| TaskBase | @ManyToOne Meter (nullable) | ⚠️ | TaskBase tem Meter opcional; remover Meter exige remover field |
| CustomFieldValue | @ManyToOne Meter | ⚠️ | FK precisa ser removida |
| WorkOrder | Indireta | ✅ | WO não tem FK para Meter; WO criadas por triggers existem independentemente |
| PreventiveMaintenance | Nenhuma | ✅ | PM não tem relação com Meter |
| PlanFeatures.METER | Guard | ✅ | Remove guard de criação de Meter/Reading |
| Import/Export | 2 endpoints + CSV | ✅ | Pode desabilitar |
| CSV Templates | en/fr/tr | ✅ | Pode remover |

### Assets dependem de Meters?
**Não.** Asset não tem field Meter. A relação é unidirecional: Meter → Asset (Meter tem `@ManyToOne Asset` obrigatório). Remover Meter não impacta Asset entity.

### PreventiveMaintenance depende de Meters?
**Não.** Nenhuma relação.

### Work Orders dependem de Meters?
**Não diretamente.** WO podem ser criadas a partir de WorkOrderMeterTriggers (quando leitura cruza threshold). Mas WO existentes não têm FK para Meter.

### TaskBase depende de Meters?
**Sim, mas fracamente.** TaskBase tem `@ManyToOne Meter meter` (nullable). Tasks podem opcionalmente estar associadas a meters para captura de leitura.

---

## 6. Plano de Remoção por Níveis

### Nível A — Seguro Remover Agora ✅
Remoção puramente frontend + config. Já executado na fase anterior.

**Frontend (já feito):**
- Rotas de Parts removidas do router
- Rotas de Meters removidas do router
- Sidebar items removidos
- TopNav items removidos
- Features settings removidos
- Paid/free de Roles removido
- People/Teams redirect adicionado
- `erioneModules.ts` com `parts: true, meters: true`

**Backend — seguro remover agora (sem quebrar build):**
1. Remover `PartAnalyticsController.java` + DTOs de analytics de part
2. Remover endpoints `/import/parts` e `/export/parts` (manter ImportService/ExportService)
3. Remover endpoints `/import/meters` e `/export/meters`
4. Remover CSV templates `meter.csv` (en, fr, tr)
5. Remover `PartQuantityController.java` endpoints (manter service para compatibilidade de dados existentes)
6. Desabilitar endpoints de `/part-categories` e `/meter-categories` no controller (manter service/repo)
7. Remover `MultiPartsController.java` (sets sem parts não fazem sentido)
8. Remover `PartAnalyticsController.java`

### Nível B — Requer Cuidado ⚠️
Envolve alterar JPA entities, services, e verificar dados existentes.

**Parts:**
1. Remover `Part.java` entity → cascata para remover:
   - `PartQuantity.java` (tem @ManyToOne Part)
   - `PartConsumption.java` (tem @ManyToOne Part)
   - `PartCategory.java` (PartCategory só existe para Parts)
   - `MultiParts.java` (só existe como conjunto de Parts)
   - Remover `@ManyToMany List<Part> parts` de `Asset.java`
   - Remover `@ManyToMany List<Part> parts` de `File.java`
   - Remover `@ManyToMany List<Part> preventiveMaintenances` de `Part.java` (inverse side)
   - Remover `@ManyToOne Part part` de `CustomFieldValue.java`
   - Remover `@ManyToOne Part part` de `WorkflowCondition.java`
   - Remover `PartCondition`/`PartAction` enums e `WorkflowService.runPart()`
   - Remover `PartField` webhook enum e entradas `WebhookEvent`
   - Remover `PermissionEntity.PARTS_AND_MULTIPARTS` (33 referências)
   - Remover `NotificationType.PART`
   - Remover `CustomFieldEntityType.PART`
   - Remover `LicenseEntitlement.UNLIMITED_PARTS`, `LOW_STOCK_ALERTS`, `PARTS_COST_TRACKING`
2. Ajustar `PartMapper`, `PartQuantityMapper`, `PartCategoryMapper`, `MultiPartsMapper`
3. Ajustar `PartService`, `PartQuantityService`, `PartConsumptionService`, `PartCategoryService`, `MultiPartsService`
4. Ajustar `PartRepository`, `PartQuantityRepository`, `PartConsumptionRepository`, `PartCategoryRepository`, `MultiPartsRepository`
5. Ajustar `DemoDataService` — remover criação de parts demo
6. Ajustar `WorkOrderController` — remover `getByPart()` e cálculos de Part
7. Ajustar `PurchaseOrderController` — remover lógica de aprovação que atualiza estoque
8. Remover DTOs: `PartPostDTO`, `PartPatchDTO`, `PartShowDTO`, `PartMiniDTO`, `PartQuantityShowDTO`, `PartQuantityPatchDTO`, `PartQuantityCompletePatchDTO`, `MultiPartsShowDTO`, `MultiPartsMiniDTO`, `MultiPartsPatchDTO`, `PartImportDTO`, + 6 analytics DTOs
9. Remover `PartController.java`

**Meters:**
1. Remover `Meter.java` entity → cascata para remover:
   - `Reading.java` (tem @ManyToOne Meter)
   - `WorkOrderMeterTrigger.java` (tem @ManyToOne Meter)
   - Remover `@ManyToOne Meter meter` de `TaskBase.java`
   - Remover `@ManyToOne Meter meter` de `CustomFieldValue.java`
   - Remover `WorkOrderMeterTriggerCondition` enum
2. Remover `MeterMapper`, `ReadingMapper`, `WorkOrderMeterTriggerMapper`
3. Remover `MeterService`, `ReadingService`, `WorkOrderMeterTriggerService`
4. Remover `MeterRepository`, `ReadingRepository`, `WorkOrderMeterTriggerRepository`
5. Remover `MeterController.java`, `ReadingController.java`, `WorkOrderMeterTriggerController.java`
6. Remover `MeterCategory.java`, `MeterCategoryService`, `MeterCategoryRepository`, `MeterCategoryMapper`, `MeterCategoryController`
7. Ajustar `CsvFileGenerator` — remover `writeMetersToCsv()`
8. Remover DTOs: `MeterPostDTO`, `MeterPatchDTO`, `MeterShowDTO`, `MeterMiniDTO`, `MeterImportDTO`, `ReadingPatchDTO`, `WorkOrderMeterTriggerPostDTO`, `WorkOrderMeterTriggerShowDTO`, `WorkOrderMeterTriggerPatchDTO`
9. Ajustar `ImportService` — remover `importMeters()`
10. Ajustar `AsyncImportService` — remover `importMeters()`
11. Ajustar `AsyncExportService` — remover `exportMeters()`
12. Remover CSV templates `meter.csv`
13. Ajustar `ReadingController` — fluxo que cria WO por trigger

### Nível C — Banco/Futuro 🗄️
Operações de banco que só devem ser executadas após confirmação de que dados legados não são necessários.

1. **Migration para dropar tabelas** (somente após backup):
   - `DROP TABLE part CASCADE CONSTRAINTS`
   - `DROP TABLE part_category CASCADE CONSTRAINTS`
   - `DROP TABLE part_quantity CASCADE CONSTRAINTS`
   - `DROP TABLE part_consumption CASCADE CONSTRAINTS`
   - `DROP TABLE multi_parts CASCADE CONSTRAINTS`
   - `DROP TABLE t_part_user_associations`, `t_part_file_associations`, `t_part_customer_associations`, `t_part_vendor_associations`, `t_part_team_associations`
   - `DROP TABLE t_asset_part_associations`
   - `DROP TABLE t_multi_parts_part_associations`
   - `DROP TABLE part_preventive_maintenances`
   - `DROP TABLE meter CASCADE CONSTRAINTS`
   - `DROP TABLE reading CASCADE CONSTRAINTS`
   - `DROP TABLE work_order_meter_trigger CASCADE CONSTRAINTS`
   - `DROP TABLE meter_category CASCADE CONSTRAINTS`
   - `DROP TABLE t_meter_user_associations`
2. **Remover changelogs Liquibase** obsoletos (ou marcar como `context="legacy"`)
3. **Remover colunas/constraints**:
   - `custom_field_value.part_id` FK + coluna
   - `custom_field_value.meter_id` FK + coluna
   - `workflow_condition.part_id` FK + coluna
   - `file.parts` via join table drop

---

## 7. Recomendação

### Fazer AGORA (Nível A):
- Já executado: remoção frontend de Parts e Meters
- Próximo passo: remover controllers órfãos (PartAnalyticsController, MultiPartsController, endpoints de import/export de Parts/Meters)
- Remover telas mobile de Parts/Meters

### Fazer PRÓXIMO SPRINT (Nível B):
- Remover entities/services/repositories de Parts e Meters
- Ajustar JPA relationships em Asset, File, CustomFieldValue, WorkflowCondition, TaskBase
- Ajustar PurchaseOrderController (fluxo de aprovação)
- Ajustar WorkOrderController (cálculo de custo, endpoint getByPart)
- Ajustar DemoDataService
- Compilar e validar

### Fazer FUTURO (Nível C):
- Migration para dropar tabelas
- Limpeza de changelogs Liquibase
- Remoção de colunas órfãs em custom_field_value e workflow_condition

---

## 8. Arquivos Backend Envolvidos — Contagem Total

**Parts:** ~44 arquivos (5 controllers, 5 services, 5 repositories, 5 entities, 17 DTOs, 4 mappers, 7 enums)
**Meters:** ~25 arquivos (3 controllers, 3 services, 3 repositories, 3 entities, 9 DTOs, 3 mappers, 4 enums, 3 CSV templates)
**Compartilhados:** CustomFieldValue, TaskBase, ImportService, ExportService, DemoDataService, LicenseEntitlement

**Total: ~70 arquivos backend envolvidos na remoção completa.**
