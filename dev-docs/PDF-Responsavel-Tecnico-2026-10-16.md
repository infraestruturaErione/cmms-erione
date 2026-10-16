# PDF: responsavel tecnico sem repeticao

## Regra aprovada

- Um unico tecnico explicitamente atribuido: exibir somente Responsavel tecnico e o nome uma vez no bloco de responsaveis.
- Mais de um tecnico: manter responsavel tecnico (antigo trabalhador principal), operador, finalizador e atribuidos separados.
- Equipe registrada continua identificada, sem inventar membros da equipe.
- Mesmo corpo compartilhado no individual e bulk; filtros por cliente/periodo, assinatura, fotos, permissoes e execucao nao mudam.

## Implementacao

`WorkOrderReportService` calcula `singleAssignedTechnician` apenas para apresentacao. Sem snapshot de conclusao, conta IDs distintos do principal e dos atribuidos (principal repetido em assignedTo conta uma vez; pessoas homonimas contam separadamente).

Para OS concluida com snapshot, respeita o texto de atribuicao congelado na conclusao, nao a lista atual. O formato legado armazena nomes separados por virgula, sem IDs/contagem. Snapshot vazio ou nome historico ambiguo com virgula conserva o detalhamento, evitando esconder atribuicoes por suposicao. Nenhuma migration ou mudanca no formato armazenado.

O bulk encaminha a mesma flag ao fragmento compartilhado. No modo compacto, o nome vem da atribuicao usada pelo relatorio, inclusive snapshot historico e atribuicao unica sem principal preenchido. Os campos de executor/finalizador e atribuicao continuam calculados e armazenados; apenas suas linhas repetitivas deixam de ser exibidas nesse modo.

## Validacao

`WorkOrderReportTechnicianLayoutTest` cobre dez cenarios, renderiza os PDFs individuais e o bulk, compara cada corpo HTML e verifica a quantidade de ocorrencias do nome no PDF. Casos: principal repetido em assignedTo, multiplos IDs, unico sem principal, snapshot multiplo com cadastro atual unico, snapshot unico com cadastro atual multiplo/equipe, sem atribuicao, snapshot vazio, homonimos, snapshot ambiguo e atribuicao unica com executor/finalizador diferentes. A regra visual depende da atribuicao, nao da igualdade entre nomes de papeis.

Fixtures de homologacao sinteticas sao geradas em `api/target/pdf-technician-layout/`, fora do versionamento. A alteracao nao recalcula nem regrava PDFs antigos do historico.

Resultado: 30 testes aprovados, 0 falhas/erros/ignorados (20 WorkOrderReportServiceTest, 9 PdfImageOptimizerTest, 1 WorkOrderReportTechnicianLayoutTest com dez cenarios internos). PDFs individuais e dez paginas do bulk de teste renderizados e inspecionados. Os testes usam TemplateEngine sem catalogo de mensagens da aplicacao; placeholders de status/prioridade nos exemplos sinteticos nao representam mudanca da traducao em producao.

Somente a API DEV foi rebuildada e recriada, com inicializacao confirmada. Nenhum commit/push ou deploy em producao nesta etapa. Mudancas mobile preexistentes preservadas fora deste escopo.
