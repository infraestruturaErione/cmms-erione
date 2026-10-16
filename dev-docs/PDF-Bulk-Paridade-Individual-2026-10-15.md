# PDF bulk: paridade com o individual

## Regra

O relatorio em massa reune as OS concluidas de um cliente no periodo selecionado. Cada OS deve manter o mesmo corpo, dados e layout do PDF individual. Somente resumo do lote, indice da OS e paginacao geral sao especificos do bulk.

## Causa e correcao

O servico calculava as variaveis corretamente e o fragmento era compartilhado. Faltavam cinco variaveis na projecao `th:with` de `work-orders-bulk-report.html`: `executionOwnerName`, `completedByName`, `assignedUserNames`, `assignedTeamName`, `travelDurationLabel`.

Completar essa projecao restaura os campos existentes no individual sem alterar o fragmento, estilos, PDF individual, filtros, permissao, banco ou armazenamento.

## Regressao

`WorkOrderReportServiceTest.bulkPreservesEachIndividualReportBodyWithoutLeakingValuesBetweenOrders` renderiza os templates reais e compara o corpo HTML integral de cada individual com o bulk (normalizando apenas comentarios e espacos entre tags).

O lote inclui duas OS com principais, executores, finalizadores e snapshots de atribuicao distintos, tempos diferentes, questionario com imagem, relato, evidencia e assinatura sintetica. Uma terceira OS sem campos opcionais verifica ausencia de dados herdados de outra OS. O PDF efetivamente renderizado tambem e inspecionado por extracao de texto e separacao por codigo de OS.

O teste reproduziu a divergencia antes da correcao: `Bulk must preserve the entire individual body for WO-BULK-0`.

Apos a correcao: 35 testes passaram, sem falhas, erros ou ignorados (20 WorkOrderReportServiceTest, 9 PdfImageOptimizerTest, 3 WorkOrderExecutionEndpointsTest, 1 WorkOrderExecutionCompletionRetryTest, 2 WorkOrderExecutionConcurrencyTest). Execucao isolada em Maven/Java 17, H2 em memoria, sem alterar o banco DEV.

## Homologacao DEV

Reutilizar WO000086, WO000089 e WO000090 no filtro de conclusao de 15/10/2026, cliente Prefeitura de Santa Branca. As duas ultimas sao sinteticas; a primeira e preexistente e permanece sem alteracoes.

Comparar WO000090 com o individual fornecido pelo usuario, inclusive trabalhador principal Fabricio, executor/finalizador Caio, dois atribuidos, deslocamento de 6min e quatro fotos.

Validado apos rebuild/recriacao somente da API DEV: novo bulk com 3 OS, 5 paginas, 1435123 bytes. Comparacao automatizada do texto da WO000090 com o PDF individual fornecido passou (normalizados apenas espacos, quebras de linha e rodapes/paginacao). Todas as paginas foram renderizadas e inspecionadas; fotos e assinatura preexistente preservadas. Arquivo: `output/pdf/erione-cmms-bulk-dev-corrigido-20261015.pdf`. Producao, frontend e mobile nao foram alterados nesta correcao; sem commit/push.

Relatorios historicos ja gerados sao arquivos imutaveis: e necessario gerar novo bulk para incorporar a correcao. Nao reescrever nem apagar PDFs anteriores.
