# Import de Equipamentos Órfãos — Finalizado ✅

**Data:** 14/05/2026

## Resumo Final

Santa Branca agora tem **162 assets** (6 do grupo original + 156 órfãos).

### 2 Locations criadas
| Location | Erione ID | Código Auvo |
|----------|-----------|-------------|
| UBS CENTRAL | 266 | 1020 |
| EMEIF PROF. MARIA APARECIDA FONSECA | 267 | 1028 |

### 156 Assets órfãos criados

| Status | Quantidade |
|--------|-----------|
| Criados (1ª leva) | 111 |
| Criados (2ª leva — retry rate-limit + UBS II) | 45 |
| Já existiam (dedup) | 0 |
| Location não encontrada | 0 |
| **Total** | **156** |

### 5 Equipamentos ignorados (sem customerId)
- CAMERA PTZ 0001, 0002, 0003, 0004, PC 0001

### Assets por Location (top 5)
| Location | Assets |
|----------|--------|
| PREFEITURA ID 1015 | 12 |
| ID 1004 CRECHE II | 12 |
| PROTEÇÃO SOCIAL | 11 |
| EMEF FRANCISCA ROSA | 10 |
| UBS II | 12 + 1 |
| (demais 20 locations) | restante |

## Comandos utilizados
```bash
# Análise dry-run
python import_auvo_group.py --mode orphan-dry-run

# Aplicar (2 vezes — rate limit na 1ª, sucesso na 2ª)
python import_auvo_group.py --mode orphan-apply
```

## Estado atual do sistema
| Customer | Locations | Assets |
|----------|-----------|--------|
| Santa Branca | 51 | 162 |
| Tremembe | 63 | 0 |
| ARC Mobilidade | 51 | 0 |
| Camanducaia | 87 | 0 |
| **Total** | **252** | **162** |
