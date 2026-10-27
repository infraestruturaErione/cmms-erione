# Massa multicliente com fotos - bulk PDF - 27/10/2026

## Escopo e massa mantida no DEV

Complementa PDF-Bulk-Todas-OS-2026-10-27.md. Usuario pediu massa maior e varios
clientes para conferir concluidas/todas com imagens. Nao altera fontes da
aplicacao, permissoes, templates, containers, dependencias, APK ou producao.

Tres clientes QA MASSA ALFA/BETA/GAMA 20261027, todos na mesma cidade para
detectar ampliacao indevida do filtro por cidade. Dois locais por cliente,
30 OS (dez por cliente), cinco status, 60 tarefas e 60 comentarios (metade
relatos em campo e metade internos), nove assinaturas sinteticas.

111 JPEGs distintos 1600x1000, 12205153 bytes de origem, com identificacao
visivel de cliente/OS/foto. Prefixo exclusivo MinIO:
company 1/qa-massa-bulk-20261027/. Casos 0/1/4/8 evidencias por OS, repartidas
entre anexos diretos e comentario. Um mesmo arquivo no anexo e comentario
em um caso verifica deduplicacao. Seis fotos adicionais em questionarios
cobrem registros legados. Nao sao fotos de pessoas/locais reais.

Namespace de IDs -2026103999 a -2026103000; nenhuma sequencia real avancada.
Dados inseridos em transacao SQL controlada para nao disparar notificacoes,
webhooks ou logica operacional. Sao fixtures de relatorio WEB/PDF, nao teste
dos endpoints de criacao/conclusao nem de cache/limpeza mobile com ID positivo.
Relacionamentos de tecnicos usam usuarios DEV existentes; assinaturas falsas
marcadas SEM VALIDADE. Massa deixada no DEV, claramente nomeada, para revisao.

## Execucao e resultados

Sessao autenticada do navegador integrado, sem extrair token/senha. Seis
pedidos bulk pela UI normal: cada cliente em COMPLETED/COMPLETED_ON e
ALL/CREATED_AT, sempre 27/10/2026 a 27/10/2026. Seis individuais pelo menu
normal da OS servem como referencias (casos 02 concluido e 06 em andamento
de cada cliente, oito evidencias mais foto no questionario).

Resultados por cliente, identicos nos tres:
- COMPLETED: quatro OS, oito paginas, 17 fotos e tres assinaturas no PDF;
  cerca de 1,93 MB (decimal).
- ALL: oito OS, 16 paginas, 35 fotos e tres assinaturas; cerca de 3,93 MB.
- Uma OS no limite final 27/10 23:59:59.999 local entrou corretamente.
  Outra no inicio de 28/10 e outra imediatamente antes de 27/10 foram excluidas.
- Conjuntos de codigos/nomes exatos: sem vazamento entre clientes da mesma
  cidade, sem duplicar OS, sem comentarios internos.
- Respostas, notas e relatos presentes; perguntas sem resposta aceitas no
  relatorio de OS aberta; nenhuma assinatura fabricada onde era ausente.
- Fabricio principal/Ronaldo executor/conclusao preservados; nos demais
  casos nome do tecnico unico aparece uma vez por corpo.
- 210 ocorrencias de foto (bulks e referencias): conteudo JPEG de cada XObject
  desenhado bate exatamente com o SHA-256 da fonte esperada. Coordenadas das
  imagens dentro do MediaBox; nenhum objeto de foto apenas embutido sem desenho.
- 21 comparacoes por OS entre modos/individuais: mesmos pixels decodificados
  de fotos e assinatura. Nao significa identidade pixel a pixel das PAGINAS:
  capa/rodape e paginacao diferem conforme o tipo/tamanho do documento.
- 84 paginas renderizadas com Poppler a 55 dpi, inspecionadas em sete mosaicos;
  contagens e extracao automatizadas com pypdf. Evidencias em
  tmp/qa-massa-bulk-20261027/validation.json, manifesto, SQL e inventarios.

O primeiro roteiro UI encontrou uma transicao de menu MUI ainda interceptando
cliques seguintes. A automacao passou a esperar o Popover desmontar e conferir
cliente/datas visiveis antes de gerar. Nao foi alterado o produto por isso.
Comparacao aproximada de miniaturas foi substituida por SHA-256 dos bytes JPEG
dos XObjects (sem falso positivo entre imagens sinteticas parecidas).

## Achado visual real

Caso 02 com oito evidencias, mais uma foto de questionario e assinatura:
individual usa duas paginas; bulk usa tres, com assinatura isolada na ultima.
Reproduzido nos tres clientes e nos dois escopos. Conteudo nao foi perdido,
mas a paginacao do bloco no bulk merece refinamento. Nenhuma correcao de
layout feita nesta etapa para ocultar ou descaracterizar o achado.
Warnings do iText sobre ultima linha incompleta observados; nao foram
acompanhados por imagem ausente/fora da pagina nesses casos testados.

## Preservacao, entrega e limites

Sete tabelas de negocio ORIGINAIS (excluindo o namespace QA) mantiveram
contagens/fingerprints integrais anteriores. Os 59 objetos de origem anteriores
mantiveram chave/tamanho/ETag. QA acrescenta seus 111 objetos separadamente.
Nenhuma OS, foto ou assinatura real editada/excluida; sem commit/push.

PDFs em output/pdf/qa-massa-bulk-20261027/. ZIP com seis bulks e LEIA-ME;
referencias e mosaicos disponiveis separadamente. Derivados bulk preservados
na Central de relatorios com retencao normal de sete dias; fontes QA continuam
no PostgreSQL/MinIO. Alias temporario MinIO removido ao fim.

Nao e benchmark/carga, teste de aparelho, formato HEIC/EXIF variado, nem
promessa de ausencia de bugs para qualquer volume. Nao rerodou suites antigas
de codigo sem alteracoes: esta etapa e teste integrado com dados ampliados.
AST da aplicacao permanece 19017 nos / 63315 arestas da atualizacao anterior;
sem mudanca de fonte, apenas registro curado Graphify e nota/indice Obsidian.
