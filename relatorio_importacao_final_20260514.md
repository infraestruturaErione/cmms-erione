# Relatório de Importação — Consolidado Final
**Data:** 2026-05-14

---

## Resumo Geral

| Item | Criados | Reutilizados | Ignorados | Erros |
|------|:-------:|:------------:|:---------:|:-----:|
| Customers | 10 | 5 | 0 | 0 |
| Locations | 443 | 253 | 0 | 0 |
| Assets | 1 | 0 | 0 | 0 |

**Total Customers no Erione:** 15
**Total Locations:** 831
**Total Assets:** 163

---

## Customers Criados/Reutilizados

| ID | Customer | Locations | Assets | Status |
|:--:|----------|:---------:|:------:|:------:|
| 1 | PREFEITURA MUNICIPAL DE SANTA BRANCA | 51 | 162 | reutilizado (importação anterior) |
| 2 | PREFEITURA MUNICIPAL DA ESTANCIA TURISTICA DE TREMEMBE | 63 | 0 | reutilizado (importação anterior) |
| 3 | ARC MOBILIDADE | 51 | 0 | reutilizado (importação anterior) |
| 4 | PREFEITURA MUNICIPAL DE CAMANDUCAIA | 87 | 0 | reutilizado (importação anterior) |
| 5 | PREFEITURA MUNICIPAL DE SAO JOSE DOS CAMPOS | 462 | 0 | reutilizado (+209 locs criadas, 253 já existiam) |
| 6 | PREFEITURA MUNICIPAL DE SAO JOSE DOS CAMPOS - DEMAIS | 33 | 0 | **criado** |
| 7 | ENERGISA | 36 | 0 | **criado** |
| 8 | CAMPOS LUZ ILUMINACAO | 15 | 0 | **criado** |
| 9 | PREFEITURA MUNICIPAL DE CAMANDUCAIA - SEDE | 13 | 0 | **criado** |
| 10 | CFTV - AUVO TECNOLOGIA | 7 | 1 | **criado** |
| 11 | CAMARA MUNICIPAL DE SAO JOSE DOS CAMPOS | 7 | 0 | **criado** |
| 12 | AEROPORTO INTERNACIONAL DE SJC | 3 | 0 | **criado** |
| 13 | PREFEITURA MUNICIPAL DE SJC - MATRIZ | 1 | 0 | **criado** |
| 14 | GCM - GUARDA CIVIL MUNICIPAL DE CACAPAVA | 1 | 0 | **criado** |
| 15 | TERMINAL RODOVIARIO DE CACAPAVA | 1 | 0 | **criado** |
| | **Total** | **831** | **163** | |

---

## Customer Hubs (links para validação)

| ID | Customer | URL |
|:--:|----------|-----|
| 1 | PREFEITURA MUNICIPAL DE SANTA BRANCA | http://localhost:8080/customers/1/show |
| 2 | PREFEITURA MUNICIPAL DA ESTANCIA TURISTICA DE TREMEMBE | http://localhost:8080/customers/2/show |
| 3 | ARC MOBILIDADE | http://localhost:8080/customers/3/show |
| 4 | PREFEITURA MUNICIPAL DE CAMANDUCAIA | http://localhost:8080/customers/4/show |
| 5 | PREFEITURA MUNICIPAL DE SAO JOSE DOS CAMPOS | http://localhost:8080/customers/5/show |
| 6 | PREFEITURA MUNICIPAL DE SAO JOSE DOS CAMPOS - DEMAIS | http://localhost:8080/customers/6/show |
| 7 | ENERGISA | http://localhost:8080/customers/7/show |
| 8 | CAMPOS LUZ ILUMINACAO | http://localhost:8080/customers/8/show |
| 9 | PREFEITURA MUNICIPAL DE CAMANDUCAIA - SEDE | http://localhost:8080/customers/9/show |
| 10 | CFTV - AUVO TECNOLOGIA | http://localhost:8080/customers/10/show |
| 11 | CAMARA MUNICIPAL DE SAO JOSE DOS CAMPOS | http://localhost:8080/customers/11/show |
| 12 | AEROPORTO INTERNACIONAL DE SJC | http://localhost:8080/customers/12/show |
| 13 | PREFEITURA MUNICIPAL DE SJC - MATRIZ | http://localhost:8080/customers/13/show |
| 14 | GCM - GUARDA CIVIL MUNICIPAL DE CACAPAVA | http://localhost:8080/customers/14/show |
| 15 | TERMINAL RODOVIARIO DE CACAPAVA | http://localhost:8080/customers/15/show |

---

## Observações

1. **Rate limit (429):** O servidor Erione impõe rate limiting. O script `_retry_apply.py` usou backoff exponencial (até 30s) e conseguiu concluir todas as operações.
2. **Assets:** Dos 168 equipamentos no JSON do Auvo, apenas 1 (CFTV) foi importado pois todos os demais estão sem `locationId` ou sem `associatedCustomerId` consistentes com os dados importados.
3. **Orphans:** 5 equipamentos sem `associatedCustomerId` não puderam ser importados automaticamente.
4. **Equipamentos sem location:** 162 equipamentos (Santa Branca) foram importados em sessão anterior como assets vinculados ao customer sem location específica.

---

## Histórico de Importações

| Data | Arquivo | Customers | Locations | Assets |
|:----:|---------|:---------:|:---------:|:------:|
| 2026-05-13 | import_santa_branca.ps1 | 1 | 51 | 162 |
| 2026-05-14 | import_auvo_group.py | 4 | 201 | 0 |
| 2026-05-14 | import_all_groups.py (apply parcial) | 5(+209 locs) | 209 | 0 |
| 2026-05-14 | _retry_apply.py | 10 | 117 | 0 |
| 2026-05-14 | _fix_remaining.py | 0 | 0 | 1 |
