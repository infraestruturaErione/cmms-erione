# Bulk PDF - carga sequencial de 300 OS - 27/10/2026

## Escopo real

Usuario esclareceu que nao existe o cenario de dois clientes simultaneos.
Validacao final: um cliente por OS e por relatorio, geracoes sequenciais.
Nenhuma geracao concorrente foi executada. Os cinco clientes sao casos
independentes, nao um relatorio conjunto de varios clientes.

Antes da fase valida foram retirados dez vinculos artificiais adicionais
entre OS/clientes e sete derivados/historicos preliminares exclusivamente
QA. Manifest e SQL corrigidos. Nao contabilizar essa fase descartada.

Somente DEV. Sem alterar fontes da aplicacao, templates, dependencias,
configuracao, containers da aplicacao ou producao; sem commit/push.
Nao rerodou suites de codigo inalterado. Complementa a massa menor em
PDF-Bulk-Massa-Multicliente-2026-10-27.md.

## Massa mantida para revisao

Cinco clientes QA CARGA 300 ALFA/BETA/GAMA/DELTA/EPSILON 20261027, mesma
cidade propositalmente para detectar ampliacao indevida do filtro. 60 OS
por cliente; 300 no total, cada uma com exatamente um vinculo de cliente.
Dez locais, 600 tarefas, 600 comentarios (300 internos/300 relatos),
90 assinaturas sinteticas SEM VALIDADE. Usuarios DEV existentes usados
nos relacionamentos de tecnicos, sem criar novas contas ou notificacoes.

1110 JPEGs distintos 1600x1000, 121685288 bytes de origem, identificados
por cliente/OS/foto. Casos 0/1/4/8 evidencias, anexos diretos e de relato,
deduplicacao de mesma foto nos dois caminhos, foto legada de questionario,
perguntas nao respondidas, descricoes longas e todos os cinco status.
Tecnico unico e Fabricio atribuido/Ronaldo executor/concluidor cobertos.

IDs reservados -2026129999..-2026120000; codigos QAL-A-001..QAL-E-060.
SQL transacional controlado, sem avancar sequencias reais. Isso testa
WEB/PDF, nao endpoints de criacao/conclusao, nem cache/limpeza mobile.
MinIO: company 1/qa-carga-300-bulk-20261027/.

## Resultados

Onze pedidos pela UI autenticada, sem extrair token/senha. Uma rampa ALFA
ALL de 27/10 e, depois, COMPLETED e ALL de cada cliente, um por vez.
Logs de inicio/fim confirmam ausencia de sobreposicao. Todos HTTP 200.
Periodo principal 26/10/2026 a 27/10/2026, America/Sao_Paulo:

| Cliente | Concluidas / paginas | Todas / paginas |
| --- | --- | --- |
| ALFA | 24 / 42 | 48 / 90 |
| BETA | 24 / 42 | 48 / 90 |
| GAMA | 24 / 42 | 48 / 90 |
| DELTA | 24 / 42 | 48 / 91 |
| EPSILON | 24 / 42 | 48 / 90 |

Cada PDF concluido possui 102 fotos e 18 assinaturas; ALL, 210 fotos e
18 assinaturas. Doze OS por cliente ficam propositalmente fora do periodo.
Ultimo milissegundo local incluso; inicio do dia seguinte e instante anterior
ao inicio excluidos. Rampa: 24 OS / 45 paginas / 105 fotos / 9 assinaturas.

Conferencia automatizada passou: conjuntos exatos de OS, clientes, status,
respostas/notas/relatos, ausencia de comentarios internos/OS fora do periodo,
deduplicacao de anexos e nomes de tecnicos. 706 paginas, 1665 ocorrencias de
fotos com bytes JPEG SHA-256 identicos as fontes corretas da respectiva OS,
posicionadas dentro da MediaBox. 144 comparacoes de fotos/assinaturas entre
COMPLETED/ALL e rampa/ALL passaram. Nao e identidade pixel a pixel de paginas.

Poppler renderizou todas as 706 paginas a 36 dpi. Cinco folhas de contato
revisadas manualmente, com 12 paginas amostradas por cliente (60 amostras).
Nao significa revisao manual de cada pagina. Conteudo preservado nas amostras;
permanece refinamento de paginacao/espaco vazio. DELTA ALL separa trecho do
questionario numa pagina quase vazia. Achado anterior de assinatura isolada
com muitas fotos nao foi corrigido nesta etapa. Avisos iText de linha
incompleta continuam presentes, sem perda detectada nas verificacoes feitas.

Tempos backend de RequestTimingFilter: minimo 2033 ms, maximo 4516 ms,
mediana 2927 ms. Nao usar latencia das ferramentas de UI como benchmark.
API com JVM aquecida: memoria amostrada inicial 1520,6 MiB, maxima 1629,2 MiB,
ultima 1362,9 MiB (110 amostras da fase valida, aproximadamente a cada 2 s).
OOM false, RestartCount 0. Docker disponibiliza 15,49 GiB e container API
sem limite explicito. Nao e pico absoluto do heap, dimensionamento de
producao, garantia para qualquer volume ou teste simultaneo.

## Preservacao e evidencias

Sete tabelas de negocio preexistentes com contagens/fingerprints identicos
antes/depois, excluindo apenas namespace novo. Todos os 170 objetos fonte
preexistentes preservaram chave/tamanho/ETag. 1110 novos objetos QA conferidos.
Dados QA e onze bulks validos mantidos no DEV para revisao; retencao normal
de sete dias dos derivados continua aplicavel. Alias temporario mc removido.

Evidencias locais privadas: tmp/qa-carga-300-bulk-20261027/manifest.json,
validation.json, integrity.json, valid-ui-runs.json, server-valid-phase.log,
docker-samples.jsonl, original-before.csv/original-after.csv e inventarios
de objetos. Scripts auxiliares no tmp, fora de release.

Entrega: output/pdf/qa-carga-300-bulk-20261027/ com onze PDFs, README,
706 renders, cinco folhas de contato e ZIP dos dez PDFs principais.
AST existente 19017 nos / 63315 arestas preservado: nenhuma fonte de
aplicacao alterada; somente registro curado e documentacao desta QA.
