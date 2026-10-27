# Bulk PDF - todas as OS do cliente - 27/10/2026

## Fluxo e limites

- Padrao preservado: somente OS concluidas do cliente selecionado.
- Novo campo independente `OS no relatorio`: `COMPLETED` / `ALL`.
  Todas significa todos os STATUS, nao todo o historico sem intervalo.
- Cliente e datas inicial/final permanecem obrigatorios. Ao trocar para ALL
  com periodo por conclusao, a UI muda para criacao e explica o motivo.
  ALL permite criacao ou check-in; check-in exige um registro nessa data.
- Cliente, CNPJ e datas nao se perdem ao alternar o escopo. CNPJ continua
  opcional e serve somente como conferencia contra o cliente selecionado.
- Datas vazias iniciam neutras. Erros aparecem por blur ou submit; intervalo
  invertido e rejeitado com mensagem. Formulario suporta Enter, desabilita
  filtros durante geracao e mantem botao em cor primary, nao error.
- Campos em duas colunas a partir de md e uma no celular. Cliente vem antes
  do CNPJ; escopo, campo de data e datas agrupados sem cinco campos estreitos.

## Backend e compatibilidade

`WorkOrderBulkReportRequestDTO` recebe scope com default COMPLETED, incluindo
chamadores antigos/assistente. Validacao rejeita null em scope/periodField,
datas ausentes/invertidas e ALL + COMPLETED_ON.

`WorkOrderService.findCompletedByCustomersAndPeriod` preserva o contrato
anterior e delega ao novo metodo. O filtro de status so e omitido em ALL.
Company, join customers, distinct e limites start inclusivo/end exclusivo
permanecem. Controller mantem permissao WORK_ORDERS, customer scope, CNPJ e
timezone da empresa. Nao amplia por cidade nem altera regras de visibilidade.
Arquivamento nao ganha novo filtro: mantida a consulta anterior quanto a ele.

PDF usa o mesmo corpo individual. Apenas o subtitulo da capa muda em ALL;
status/dados efetivamente registrados sao exibidos, sem inventar assinatura,
executor ou conclusao para OS aberta. Historico concluido usa BulkKeyV1,
ALL usa BulkKeyV2 com descricao explicita, para nao ser reutilizado pelo
assistente como se fosse um PDF so de concluidas. Sem reescrever PDFs antigos.
Retencao de sete dias, armazenamento e download bulk preservados.

Sem dependencia nova, migration desta feature, tratamento de fotos ou APK.
Compartilha WorkOrderController com o cache individual ainda nao commitado;
nao descartar nem misturar acidentalmente os hunks dessa implementacao anterior.

## Validacao automatizada

- Frontend completo: 26 suites / 232 testes passaram. Oito testes novos com
  componentes MUI reais cobrem neutralidade/touched, datas ausentes/invertidas,
  troca de escopo, periodo automatico e payload de ambos os modos sem fuso.
  Log tmp/bulk-scope-frontend-all-20261027.log.
- Backend direcionado: 69 testes, zero falhas/erros/skips, Maven package
  BUILD SUCCESS em container Linux descartavel. Query JPA executada em H2
  com todos os status, isolamento cliente/empresa e fronteiras temporais.
  Doze casos parametrizados do controller verificam ambos os modos,
  permissao, customer scope, CNPJ, datas no fuso e identificacao do historico.
  PDF real de OS aberta/em andamento conferido por texto; regressao do
  assistente impede reaproveitar ALL como COMPLETED. Paridade do corpo dos
  PDFs e testes de snapshot/cache/migration incluidos. Nao e toda a suite API.
  Log tmp/bulk-scope-api-tests-20261027.log, XMLs tmp/bulk-scope-surefire-20261027.
- Primeiras tentativas corrigiram apenas fixtures de teste: mock i18n/reset
  CRA, transicao de portal, campos de auditoria/keyword VALUE do H2 e texto
  de comentario HTML confundido com texto visivel do PDF. Bateria final passou.
- ESLint quiet da pagina, Prettier da pagina/teste e git diff --check passaram.

## Homologacao integrada DEV

Builds Docker API/frontend aprovados (frontend Compiled successfully), somente
esses dois containers recriados. PostgreSQL e MinIO mantidos. Usuario fez o
login DEV no navegador integrado; nenhuma senha/token extraido.

- Duas fixtures exclusivamente sinteticas no cliente QA BULK STATUS 20261027:
  QA-BULK-OPEN e QA-BULK-COMPLETE, ambas criadas no dia 27 no periodo testado.
- Pedido pela UI em COMPLETED produziu historico BulkKeyV1 e PDF de uma pagina
  contendo apenas QA-BULK-COMPLETE. ALL mudou para CREATED_AT sem perder
  cliente/datas e produziu BulkKeyV2, duas paginas com ambas as OS.
- Texto dos PDFs extraido e paginas de ALL renderizadas com Poppler a 75 dpi
  e inspecionadas: subtitulo/totais/status corretos, sem assinatura ou conclusao
  inventada na aberta. Corpo individual preservado; nao e teste pixel a pixel
  da capa, que muda intencionalmente para ALL.
- Datas vazias com aria-invalid=false na UI real e screenshot inicial neutro
  tmp/bulk-scope-neutral-20261027.png. Formulario tambem visto a largura de
  celular, em coluna unica, tmp/bulk-scope-all-20261027.png. Sem aparelho real.
- Duas linhas de historico e seus dois objetos derivados QA removidos por
  caminhos/IDs exatos, alem das duas OS e cliente sintetico. Nenhum dado de
  usuario apagado. Sete tabelas de negocio com contagens e fingerprints
  identicos antes/depois; evidencias em tmp/bulk-scope-business-{before,after}-20261027.csv.
- Container Maven temporario e alias de storage temporario removidos. PDFs
  QA e XMLs/logs locais preservados em tmp, fora de qualquer commit.

## Entrega

Graphify AST concluido: 19017 nos / 63315 arestas, 1229 arquivos nao cacheados;
59 avisos sem nos e 21 SQLs sem extracao (tree_sitter_sql ausente). Sem instalar
dependencias, clustering, extracao semantica ou tokens/custo API. Log
tmp/graphify-bulk-scope-20261027.log. Nota e indice do vault Obsidian sincronizados.

Implementacao local sem commit/push ou producao. Para promover no futuro,
API e frontend devem ser atualizados juntos. O cache individual pendente tem
migration propria, separada desta mudanca, e deve ser considerado no release.
