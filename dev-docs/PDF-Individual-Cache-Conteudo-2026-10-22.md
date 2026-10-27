# PDF individual - cache por conteudo - 22/10/2026

## Objetivo e limites

Evitar renderizar e enviar um novo PDF a cada abertura da mesma versao da OS.
PostgreSQL e MinIO continuam sendo as fontes oficiais da OS e dos arquivos.
O PDF e uma copia derivada, nao substitui respostas, relatos, fotos ou assinatura.
Implementacao local; sem commit/push, deploy de producao ou alteracao de APK.

Mantidos GET /work-orders/report/{id}, SuccessResponse(success,message=URL),
link assinado por 10 minutos, template, fontes e layout aprovados. Bulk,
filtros por cliente/data, historico e limpeza bulk de sete dias nao alterados.
O metodo publico do WorkOrderReportService continua atendendo o bulk; sua
extracao interna agora aceita um resolvedor de arquivos, com o mesmo default.

## Fluxo

1. whoami e permissao WORK_ORDERS; validar acesso a OS por regras existentes.
2. Trava PostgreSQL pg_advisory_xact_lock por empresa + OS, com espera de no
   maximo 30 segundos. Vale entre processos/instancias, nao apenas threads Java.
   O lock nao bloqueia a linha da OS nem exige que a execucao pare para gerar PDF.
3. Refresh da OS gerenciada apos a espera e nova validacao de acesso.
4. Renderizar o MESMO HTML com marcadores estaveis no lugar das URLs/imagens.
   SHA-256 do HTML + idioma, fuso, formato, versao do renderer e hash dos
   templates, estilos, logo e fontes. Sem baixar/comprimir fotos nesta etapa.
5. Consultar work_order_pdf_cache por empresa, OS e fingerprint. Conferir
   prefixo proprio e existencia fisica. Hit: renovar retencao e assinar outro
   link para o mesmo arquivo, sem renderPdf, download de fotos ou upload.
6. Miss/arquivo ausente: resolver marcadores, otimizar imagens com a regra
   existente e renderizar o PDF. Salvar e rastrear somente apos gerar/enviar.
7. Falha de imagem: preservar o best-effort anterior, mas NAO reutilizar esse
   PDF incompleto. Rastrear a copia apenas para limpeza futura. Falha de
   render/upload nao cria entrada; rollback posterior tenta remover a copia nova.

## Invalida quando muda

Tudo que efetivamente aparece no template: dados da OS, cliente/endereco,
tecnicos e snapshots de atribuicao, executor/finalizador, datas de execucao,
perguntas/respostas/notas/fotos, relato, evidencias, assinatura e assinante.
Nao depende de workOrder.updatedAt. Atualizar apenas um timestamp de auditoria
que nao aparece no relatorio nao invalida desnecessariamente.

Arquivos recebem marcador SHA-256 de id, caminho, tipo, nome e updatedAt.
O upload atual cria caminhos unicos: substituir/anexar fotos pelo app altera
essa identidade. Sobrescrever bytes manualmente no MESMO objeto MinIO sem
alterar o registro do File nao e detectado por esse contrato; nao fazer isso.
Se renderer/otimizador mudar sem alterar recursos, incrementar RENDERER_VERSION.

HTML final e congelado antes do download. Uma edicao concorrente depois desse
snapshot sera vista na proxima solicitacao e produzira outra fingerprint;
nao ha promessa de bloquear edicoes durante todo o download do usuario.

## Retencao e seguranca

- Tabela nova exclusiva e aditiva, sem alterar tabelas de OS/evidencias/bulk.
- Prefixo exclusivo reports/{companyId}/individual-cache/{workOrderId}/.
- Versoes antigas/incompletas expiram em sete dias sem reutilizacao; cache hit
  renova esse prazo. Job proprio a cada 15 minutos, ate 100 candidatos por lote.
- Limpeza usa a mesma trava, revalida vencimento e prefixo antes de apagar.
  Erro de storage preserva a linha para nova tentativa. Nunca apaga OS, fotos,
  assinatura, arquivos de company, PDFs bulk ou relatorios individuais legados.
- Metadados sem FK de cascata propositalmente: excluir uma OS/empresa nao
  perde o caminho de sua copia antes de a manutencao poder limpa-la.
- PDFs gerados antes desta feature nao sao migrados nem apagados automaticamente.
- Cache nao concede acesso: cada solicitacao passa novamente pela autorizacao.
- Cleanup nao e uma transacao distribuida: se arquivo for removido e DB falhar,
  nova consulta detecta ausencia e regenera; a proxima limpeza pode repetir delete.

## Validacao isolada inicial

- Bateria final: 74 testes, zero falhas/erros/skips; `mvn package` aprovado em
  copia Linux limpa. Log: tmp/pdf-cache-final-20261022.log; XMLs e detalhes em
  tmp/pdf-cache-surefire-20261022. Nao e a suite completa de todo o backend.
- Inclui startup COMPLETO do Spring, contrato do controller, PDF/layout de
  tecnicos, paridade individual/bulk, otimizador, execucao, acesso de escrita,
  migracoes H2 e testes de cache com PostgreSQL real.
- Quatorze cenarios PostgreSQL: hit com nova assinatura, duas instancias/8
  threads e exatamente uma geracao, invalida por hash, objeto ausente,
  acesso revogado, falhas de render/upload/assinatura/existencia, rollback,
  cache incompleto nao reutilizado, retencao, cleanup com retry, prefixo
  protegido e separacao por empresa.
- MinIO REAL descartavel: PDF valido enviado uma unica vez nas duas consultas,
  bytes baixados iguais aos originais; vencimento removeu apenas o PDF derivado,
  preservando a evidencia de teste. Nada no MinIO DEV/producao foi apagado.
- Snapshot: 23 mutacoes consecutivas de dados/configuracoes alteraram a chave
  sem depender de updatedAt da OS; timestamp de auditoria isolado nao alterou.
  HTML hidratado comparado ao HTML original, PDF real gerado e texto conferido.
  Nao houve comparacao visual pixel a pixel nem benchmark de desempenho.
- Primeira tentativa de Maven no volume Windows foi encerrada por lentidao.
  Primeira bateria Linux teve dois erros nas fixtures (restub Mockito e MIME
  do arquivo sintetico), corrigidos; bateria final passou integralmente.
- Fixtures de banco e MinIO descartaveis, sem portas publicas ou volumes
  persistentes, independentes dos containers DEV. Nenhuma credencial real usada.
- `git diff --check` passou. Template/CSS/fontes, frontend/mobile e cleanup
  bulk nao foram editados. API DEV nao foi reconstruida/reiniciada nesta etapa.
- Atualizacao AST Graphify concluida: 18932 nos / 63046 arestas, 1172 arquivos
  nao cacheados e 22 avisos conhecidos de configuracoes sem nos. Log:
  tmp/graphify-pdf-cache-20261022.log. Sem clustering/extracao semantica/custo de API.

## Homologacao DEV integrada - 22/10/2026

Etapa posterior a validacao isolada acima. Backup PostgreSQL em
tmp/pdf-cache-dev-before-20261022.dump e imagem anterior preservada como
atlas-cmms-api:before-pdf-cache-20261022. Somente API DEV reconstruida/recriada;
Liquibase aplicou a tabela e o indice aditivos. Frontend, PostgreSQL e MinIO
originais nao reiniciados. Sem alteracao de producao, commit ou push.

- Duas OS sinteticas concluidas, cliente/local proprios, um e dois tecnicos,
  respostas, relato, quatro evidencias sinteticas preexistentes e assinatura
  sintetica sem validade. Nenhuma OS real editada. PDF solicitado pela sessao
  administrativa DEV no navegador, sem extrair token ou senha.
- Segunda abertura preservou fingerprint, caminho, ETag, data de modificacao
  e bytes do PDF; renovou retencao. Conteudo original restaurado reutilizou o
  mesmo arquivo inclusive apos restart da API.
- Alterar apenas resposta, relato, vinculo de foto ou assinatura gerou nova
  versao correta; updatedAt da OS permaneceu igual em todos esses cenarios.
- Remover somente um PDF derivado provocou regeneracao; evidencias intactas.
  Imagem indisponivel manteve best-effort e duas consultas nao reutilizaram
  uma copia incompleta. Acesso sem autenticacao retornou 403, nao uma URL.
- Quartz real executou uma limpeza pontual de copia QA vencida: metadado e
  objeto fisico removidos. Agendamento normal de 15 minutos preservado.
- Defeito encontrado e corrigido: perguntas com createdAt empatado podiam
  mudar de ordem apos UPDATE, invalidando sem mudanca de conteudo. Builder
  compartilhado dos PDFs agora ordena por createdAt e desempata por ID.
  Nao altera ordem cronologica nem o questionario da UI. Regressao automatizada
  e UPDATE sem alteracao no PostgreSQL real confirmaram reutilizacao estavel.
- Nova bateria final: 75 testes, zero falhas/erros/skips e Maven package
  BUILD SUCCESS. Inclui os 14 cenarios PostgreSQL e MinIO descartavel da etapa
  anterior. Log tmp/pdf-cache-dev-order-tests-20261022.log; XMLs em
  tmp/pdf-cache-dev-order-surefire-20261022. Nao e toda a suite do backend.
- Comparacao Poppler/PIL a 75 dpi: duas paginas de cada individual e quatro
  do bulk final identicas pixel a pixel as referencias geradas antes da feature.
  Bulk solicitado pela UI com cliente/data, incluindo Fabricio atribuido e
  Ronaldo executor/conclusao; tecnico unico permanece sem nomes repetidos.
  PDFs/PNGs e captura da UI preservados em tmp/pdf-cache-dev-*.
- Fixtures e 14 caminhos exatos de derivados QA removidos ao final, alem da
  copia vencida e da copia ausente usadas nos testes. Sete tabelas de negocio
  voltaram as mesmas contagens e fingerprints anteriores; todos os 59 objetos
  de origem conservaram chave, tamanho e ETag. Evidencias de integridade:
  tmp/pdf-cache-dev-footprint-{before,after}-20261022.csv e inventarios
  tmp/pdf-cache-dev-source-objects-{before,after}-20261022.jsonl.
- Containers/rede descartaveis removidos; alias MinIO temporario removido.
  Permanecem apenas os quatro containers DEV originais. Backup, logs e PDFs
  locais sao material de QA, nao devem entrar no commit nem ser publicados.
- Sem benchmark em carga/aparelho, alteracao de template/fontes/CSS, APK ou
  deploy de producao. Cache nao detecta overwrite externo de objeto sem mudar
  metadados de File; permanece valido o contrato de uploads imutaveis descrito.
- Graphify AST atualizado apos a correcao: 18944 nos / 63073 arestas, 1209
  arquivos nao cacheados. 48 avisos sem nos e 16 SQLs nao extraidos por ausencia
  de tree_sitter_sql; nao foram instaladas dependencias. Sem clustering,
  extracao semantica ou tokens/custo de API. Log
  tmp/graphify-pdf-cache-dev-order-20261022.log. Nota e inicio Obsidian atualizados.

## Publicacao futura

Esta feature e de backend, ao contrario do modal web anterior. Depois de
homologada e commitada, requer rebuild da API; Liquibase aplica a nova tabela.
Nao requer APK, migration destrutiva ou alteracao do frontend. Fazer backup e
seguir o procedimento normal do servidor antes de qualquer deploy. Nao foi
executado deploy de producao. O rebuild/restart da API DEV foi realizado na
homologacao integrada posterior, conforme registrado acima.
