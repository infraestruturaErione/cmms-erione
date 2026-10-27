# PDF - traducao do status Em deslocamento - 27/10/2026

## Correcao minima

Usuario autorizou corrigir a falha encontrada na bateria final de 30 dias
e repetir os testes. Adicionadas somente as chaves EN_ROUTE nos bundles
messages_pt_BR.properties e mailMessages_pt_BR.properties: Em deslocamento;
messages.properties e mailMessages.properties: En route.
Nenhuma mudanca em layout, query, filtros, permissoes, dados da OS ou fluxo.
O fragmento compartilhado individual/bulk ja resolve o enum por MessageSource.
EmailConfiguration configura o Thymeleaf real para usar mailMessages, nao
apenas o bundle geral messages. A primeira tentativa corrigiu somente messages:
os testes montados manualmente passaram, mas o DEV continuou com placeholder.
Essa lacuna foi detectada pela homologacao e corrigida no teste, que agora
instancia exatamente EmailConfiguration e seu template resolver/message source.

WorkOrderReportStatusTranslationTest cobre todos os cinco status em pt-BR
e nos dois bundles padrao, fallback para locale sem bundle e renderizacao real de
dez PDFs (individual/bulk por status), exigindo ausencia de ?? e texto correto.

## Testes e DEV

Teste vermelho antes da correcao: dois testes falharam exatamente por
EN_ROUTE nao resolvido (NoSuchMessageException e placeholder no individual).
Evidencia tmp/pdf-status-red-20261027.log.

Primeira bateria: 71 testes direcionados passaram, mas o teste novo ainda
usava MessageSource montado manualmente. Isso NAO comprovou o engine real.
A regressao ajustada para EmailConfiguration reproduziu novamente a falha
de EN_ROUTE antes de adicionar mailMessages (tmp/pdf-status-production-red-20261027.log).
Bateria FINAL apos os quatro bundles: 71 testes passaram sem falhas/erros/skips,
Maven package BUILD SUCCESS em tmp/pdf-status-production-green-20261027.log.
Inclui
traducao nova, controller/queries reais do scope bulk, assistant, templates,
tecnicos, snapshot/cache/migration. Nao e suite backend completa nem teste
nativo/mobile. Evidencia inicial tmp/pdf-status-green-20261027.log nao deve
ser usada como se fosse a aprovacao final da configuracao real.

Docker build API passou. Somente container API DEV recriado; IDs/datas de
inicio de frontend, PostgreSQL e MinIO conferidos inalterados. Chave
EN_ROUTE=Em deslocamento confirmada dentro do JAR em execucao. API running,
OOM false, RestartCount 0. Nenhuma migration nova, producao, commit/push.
Tentativa de tag de rollback pelo antigo image ID falhou porque o daemon
nao tinha mais aquele image ID; nao alegar que essa tag foi preservada.

## Homologacao integrada

CONCLUIDA: usuario entrou novamente sem compartilhar senha. A primeira
tentativa (relatorios 76/77) revelou que o engine real usa mailMessages;
PDFs e evidencias dessa tentativa preservados em tmp/qa-status-retest-first-attempt-20261027.
Apos completar a correcao nos quatro bundles e reiniciar apenas a API,
aguardou-se prontidao antes de atualizar a UI, sem nova perda de sessao.

Novos bulks 78/79 gerados pela UI autenticada, um cliente por vez:
QA FINAL 30D ALFA/BETA, Todas / Criado em / 28/09 a 27/10/2026, 12 OS cada.
Ambos Finalizado. Cada PDF tem 24 paginas, 50 fotos, cinco assinaturas e
sete OS sem assinatura, com os cinco status. Em deslocamento confirmado
na pagina 16 de ambos, sem ?? no texto de nenhuma pagina. Textos anteriores
e novos identicos exceto substituicao exata de ??EN_ROUTE_pt_BR?? pelo texto
correto. Todas as 100 fotos conferidas com SHA-256 contra fonte correta,
dez assinaturas conferidas em RGB, sem assinatura fabricada nas outras 14 OS.
Sete tabelas originais e 59 objetos fonte originais preservados.

Roteiro preparado em tmp/qa-status-retest-download.ps1 e modo --corrected
de tmp/qa-final-30dias-validate.py. Exige nomes/codigos/clientes, fotos e
assinaturas exatas, traducao resolvida e texto identico exceto EN_ROUTE.
Comparacao raster das 48 paginas: 30 identicas; duas mudam somente na area
do status e 16 apenas dentro das caixas de fotos, com mesmo conjunto de bytes
por pagina e mesmas posicoes/tamanhos dos slots, mas ordem interna diferente.
Fora dessas areas verificadas, pixels identicos. Nao alegar 46 paginas
pixel-identicas: anexos sao iterados sem ordenacao em buildFieldEvidenceItems
e podem trocar posicao apos reiniciar a JVM. Este comportamento preexistente
foi documentado e nao alterado numa correcao limitada a traducao.
Scripts nao sao arquivos de release. Namespace/fixtures anteriores mantidos.

Paginacao/espacos vazios e ordenacao deterministica dos anexos continuam
fora desta correcao. Sao limitacoes registradas, nao perda de conteudo.
Nao eliminar/ocultar esse refinamento pendente sob a alegacao de teste verde.

Removidos somente quatro derivados/historicos QA incorretos 74..77 apos
preservar as evidencias locais. Central DEV conserva apenas os dois bulks
corrigidos 78/79 e toda a massa fonte de 24 OS. Sem exclusao de fonte real.
Alias temporario mc removido. ZIP corrigido e recorte do status em
output/pdf/qa-status-retest-20261027/. Sem commit/push ou producao.

Graphify: primeiro refresh concluido 19142 nos / 63569 arestas, 1280 arquivos
nao cacheados, 75 avisos zero-node e 38 SQL ignorados por tree_sitter_sql
ausente; sem instalar dependencias/clustering/semantica/API. Segundo refresh
CONCLUIDO apos ajustar a regressao para EmailConfiguration: 19149 nos /
63575 arestas, 1258 arquivos nao cacheados, 79 avisos zero-node e 38 SQL
ignorados pela mesma dependencia ausente. Log
tmp/graphify-pdf-status-final-20261027.log. Registros de entrega posteriores
no guia Deploy-PDF-Cache-Bulk-Status-2026-10-27.md e no vault supersedem
a situacao historica sem commit/push desta homologacao.
