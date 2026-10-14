# Correcao: tecnico unico sem botao extra

Complemento posterior ao commit 5496239 e ao APK de teste 1.0.46/41 gerado em 2026-10-14. Esta correcao ainda nao esta nesse APK nem no servidor/repositório remoto.

Causa: canExecuteWorkOrder exigia owner para todas as OS e o botao de assumir verificava apenas owner nulo, sem cardinalidade de atribuicao.

Regra corrigida: principal, assignedTo e membros da equipe sao contados por IDs distintos. Repetir o mesmo usuario em principal/assignedTo/equipe nao cria disputa. Com uma unica pessoa atribuida, ela usa o fluxo operacional normalmente, sem assumir em botao separado. A API registra owner/date na primeira escrita operacional autorizada (inclusive retomada por APK legado), sob a trava existente. GET nao registra owner.

Com varias pessoas, a aquisicao exige inicio explicito; primeiro vence, demais acompanham em leitura. Owner de outra pessoa nunca e ignorado, mesmo se agora houver apenas um atribuido. Company, Customer Scope, Requester e permissoes continuam sendo verificados antes da aquisicao. OS ja concluida sem owner nao recebe backfill ficticio.

Web/mobile usam a mesma deduplicacao. Se o DTO da equipe nao informa membros, a UI nao presume tecnico unico. Nesse caso a API, que conhece as atribuicoes reais, continua autoridade. Nenhuma migration nova, alteracao de Role ou requisito de conclusao foi adicionada.

Necessario atualizar API/frontend e gerar outro APK para testar esta correcao completa. Os APKs antigos com tecnico unico precisam da API corrigida; nao foi homologado um APK antigo no aparelho. Nao assumir compatibilidade irrestrita para OS compartilhadas.

Validacoes: TypeScript mobile aprovado, 34 testes mobile e 3 testes web aprovados; 21 testes backend aprovados (autorizacao, tecnico unico, equipe, OS concluida legada, concorrencia real H2, endpoints e retry de conclusao). GET nao adquire posse. Build frontend de producao aprovado; atualizacao AST Graphify concluida (18169 nodes, 61346 edges, sem clustering). Nenhum container de producao, commit/push ou novo APK foi executado por esta correcao.
