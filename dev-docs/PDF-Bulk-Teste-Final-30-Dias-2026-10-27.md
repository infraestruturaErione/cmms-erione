# Teste final do bulk - dois clientes em 30 dias - 27/10/2026

Usuario solicitou apagar a massa anterior e testar 12 OS em Todas por
cliente, dois clientes separados e periodo de 30 dias. Condicionou a
proxima etapa de commit a ausencia de erro. Nenhum commit/push executado:
foi encontrada uma traducao de status faltante. Fontes da aplicacao nao
alteradas; somente dados DEV, scripts locais e documentacao nesta etapa.

## Limpeza e preservacao

Backup PostgreSQL antes da limpeza: tmp/qa-final-30dias-20261027/before-cleanup.dump
(privado, nao commitar). Inventario comparado integralmente aos manifests
das massas QA MASSA e QA CARGA 300. Transacao com guards de IDs, nomes,
codigos e referencias externas. Removidos exclusivamente 330 OS, oito
clientes, 1221 fontes JPEG e 23 derivados (17 bulk/seis cache individual).
MinIO removido por lista de 1244 chaves exatas, sem remocao ampla de bucket.
Guardas abortariam se existisse referencia fora das fixtures. Evidencias
locais anteriores e backup preservados; somente massas da aplicacao limpas.

Sete tabelas de negocio fora dos tres namespaces QA tiveram contagens e
fingerprints identicos antes/depois. 59 objetos fonte originais mantiveram
chave/tamanho/ETag. Conferido inventario MinIO sem fontes/derivados antigos.
Nenhum container da aplicacao recriado, producao ou configuracao alterada.

## Nova massa e resultados

QA FINAL 30D ALFA/BETA 20261027, mesma cidade deliberadamente, quatro locais,
24 OS com um cliente por OS, 48 perguntas, 48 comentarios (metade internos),
100 JPEGs sinteticos 1600x1000, dez assinaturas SEM VALIDADE e 14 OS sem
assinatura. IDs -2026139999..-2026130000, codigos QAF-A-001..QAF-B-012.
Insercao SQL transacional, sem notificacoes; teste WEB/PDF, nao fluxo de
criacao/conclusao mobile. Massa nova mantida no DEV para revisao.

Pela UI autenticada, um cliente por vez: Todas as OS / Criado em / 28/09 a
27/10/2026. Trinta dias inclusivos, OS distribuidas em 12 datas. Inclui
28/09 00:00:00 local e 27/10 23:59:59.999 local. Ultima OS concluida depois
do periodo permanece incluida corretamente, pois filtro escolhido e criacao.

Ambos historicos Finalizado, 12 OS por PDF, 24 paginas, 50 fotos, cinco
assinaturas e sete OS sem assinatura. ALFA 4326732 bytes, BETA 4323917 bytes.
Todos os cinco status presentes, nao misturou clientes da mesma cidade.
Codigos, relatos, respostas/notas, ausencia de comentarios internos,
deduplicacao e tecnico unico sem repeticao passaram. Fabricio principal
e Ronaldo executor/concluidor presentes nos casos multiplos. Todas as 100
ocorrencias de JPEG conferidas por SHA-256 contra a fonte correta da OS,
dez assinaturas comparadas por bytes RGB com o PNG especifico; sem assinatura
fabricada nas outras 14. Imagens dentro da MediaBox. Poppler renderizou as
48 paginas a 55 dpi, revisadas nas quatro folhas de contato.

ALFA registrado HTTP 200 / 1139 ms no RequestTimingFilter. BETA nao tem
linha de duracao, pois filtro so registra >=1000 ms ou HTTP >=500. Nao
inventar duracao/status exatos da segunda requisicao a partir da ausencia
de log: sucesso confirmado pelo historico/UI, objeto e PDF completos.
API running=true, OOM=false, RestartCount=0. Nao e benchmark de producao.

## Erro encontrado: traducao de EN_ROUTE

P2 visual: pagina 16 de ambos PDFs, OS QAF-A-005 e QAF-B-005, mostra
??EN_ROUTE_pt_BR?? em vez de Em deslocamento. O fragmento compartilhado
api/src/main/resources/templates/fragments/work-order-report-body.html:115
usa th:text="#{${workOrder.status}}". EN_ROUTE nao existe em nenhum dos
messages*.properties, embora os demais status estejam traduzidos; falta
em messages_pt_BR.properties e no fallback messages.properties.

Nao e defeito de selecao/perda de dados, mas aparece no relatorio entregue
e precisa ser corrigido antes de considerar o teste livre de erros.
E preexistente e foi exposto por Todas. A bateria anterior conferia o set
de status/dados, nao assertava ausencia de chaves i18n nao resolvidas;
esta lacuna ficou evidente agora. Nao alegar que nenhum erro foi encontrado.

Permanece o refinamento ja conhecido de paginacao: primeira OS de cada bulk
ocupa tres paginas, com questionario quase sozinho na pagina 2. Nao corrigido
nem tratado como regressao da selecao nesta etapa. Avisos iText de linha
incompleta persistem; conteudo/imagens renderizados foram conferidos.

Status da bateria: dataIntegrityPassed=true, passed=false, commitReady=false.
Proximo passo recomendado: corrigir traducao EN_ROUTE/fallback, adicionar
regressao para todos os status e regenerar os dois PDFs antes do commit.

Evidencias em tmp/qa-final-30dias-20261027/validation.json, inventarios,
hashes, seed, server.log e lista de remocao. Dois PDFs/README/48 renders/
quatro contatos e recorte do erro em output/pdf/qa-final-30dias-20261027/.
Alias temporario MinIO removido. AST de aplicacao nao mudou (19017 nos /
63315 arestas); registro curado Graphify atualizado, sem tokens de API.
