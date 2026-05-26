# Análise de Equipamentos Órfãos — 14/05/2026

## Problema
168 equipamentos no total no Auvo, mas apenas 6 foram importados (Santa Branca).  
Motivo: 156 equipamentos pertencem a 22 customers com `groupsId=[]` vazio — o script de import por grupo não os captura.

## Evidência Santa Branca
- Todos os 22 customers têm "Santa Branca" na `description`, `address` ou `cpfCnpj`
- CNPJ comum: **46694121000181** (Prefeitura Municipal de Santa Branca)
- Nenhum falso positivo encontrado

## Resultado do Dry-Run (138/156 resolvidos)

| Categoria | Contagem |
|-----------|----------|
| Equipamentos órfãos Santa Branca | 156 |
| → Seriam criados (location encontrada) | **138** |
| → Location não encontrada | **18** |
| → Já existem (dedup) | 0 |
| Equipamentos sem customerId | 5 |
| **Total órfãos processados** | **156** |

### 20 customers órfãos resolvidos
138 equipamentos mapeados para **20 locations existentes** do Santa Branca via código ID.

### 18 não resolvidos (sem location correspondente)
- **Customer 20914827** (1028 — EMEIF PROF. MARIA APARECIDA FONSECA): 12 equipamentos
  - Location não existe em Erione (código 1028 não encontrado - pode ser nova unidade)
- **Customer 20914728** (1020 — UBS CENTRAL): 6 equipamentos  
  - Location não existe (UBS Central não foi importada como location do grupo 122529)
- Os customers 1020 e 1028 precisam ter locations criadas primeiro.

### 5 equipamentos sem customerId
- São câmeras (CAMERA PTZ, PC) com `associatedCustomerId=0` — sem dono no Auvo

## Próximos Passos Sugeridos
1. Revisar relatório completo: `orphan_dry_run_20260514_141902.md`
2. Criar locations faltantes para 1020 (UBS Central) e 1028 (EMEIF Maria Aparecida)
3. Executar `orphan-apply` para criar 138 assets nos locations existentes
4. Decidir o que fazer com os 5 equipamentos sem customerId

## Comando
```bash
python import_auvo_group.py --mode orphan-dry-run
```
