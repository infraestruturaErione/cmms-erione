# Web - reformulacao visual da edicao de OS - 20/10/2026

## Escopo

Reformular somente a apresentacao do modal de edicao de uma OS existente,
seguindo a identidade visual Erione ja usada na criacao. Nenhuma nova regra
de negocio, endpoint, permissao, filtro, polling ou navegacao de OS.

Esta e uma nova alteracao do frontend web, posterior ao commit mobile
`8378510`. A conclusao de que o release mobile nao precisava deploy de servidor
continua valida para aquele commit. Para publicar ESTE modal posteriormente,
sera necessario atualizar o frontend web; nao API/backend, banco ou aplicativo.
Em 22/10/2026, o usuario autorizou commit/push dos oito arquivos desta feature.
Deploy em producao nao foi realizado; a entrega sera registrada separadamente
com o hash confirmado, apos o push.

## Melhorias implementadas

- Cabecalho azul-marinho com detalhe vermelho, logo existente e codigo da OS.
- Textos novos em portugues, incluindo titulo, subtitulo e acoes.
- Abas Geral, Planejamento e responsaveis e Anexos, com estado unico do Formik.
- Duas colunas a partir de md; coluna unica em telas estreitas. Dialogo usa
  altura util da viewport, inclusive dvh quando disponivel, sem rolagem horizontal
  da area de conteudo. Abas podem rolar horizontalmente em celulares.
- Cabecalho, abas e rodape ficam fora da area rolavel. Cancelar e Salvar
  alteracoes permanecem acessiveis; somente o conteudo central rola.
- Cards organizam Servico solicitado, Cliente e endereco, Questionario,
  Planejamento, Responsaveis e campos complementares.
- Datas foram separadas dos campos de equipe. Assinatura e campos personalizados
  continuam disponiveis conforme a configuracao da empresa. No refinamento,
  equipamento e status do ativo foram retirados da apresentacao padrao, mantendo
  seus valores no formulario e no contrato de envio.
- Tipo de tarefa ocupa uma linha inteira para melhorar a leitura de nomes
  longos; prioridade e assinatura ficam lado a lado no desktop.
- Uploads claros/compactos usando a variante existente do FileUpload, sem mudar
  a validacao de tipos/quantidades, o upload, o armazenamento ou o payload.
- Uma unica informacao do questionario vinculado ao tipo de tarefa. Ocultados
  neste modal os dois banners repetidos que falavam em "ao criar a OS".
  No refinamento, o seletor de itens adicionais foi ocultado neste modal. A
  estrutura e respostas existentes permanecem; nao se altera aplicacao de templates.
- Rodape valida os campos antes de enviar e abre a aba do primeiro erro. Enter
  nos campos simples segue a mesma validacao; texto multiline continua multiline.
- Bloqueio das acoes durante validacao/envio, sem dupla submissao. Erro de API
  continua sendo informado pelo handler existente, com os dados preenchidos.

## Preservacao da logica

O modal recebe os mesmos workOrderFields e workOrderValidation produzidos pela
CompanySettingsContext. Somente metadados de apresentacao sao ajustados.
Os antigos titulos de grupo sao substituidos por cards. No refinamento, ativo,
status do ativo e editor de itens deixam de aparecer no fluxo padrao, sem apagar
os valores correspondentes. Campos adicionais desconhecidos entram em Informacoes
complementares. Equipamento exigido pela configuracao, quando vazio ou invalido,
reaparece com aviso para evitar validacao oculta que impece salvar.

Os paineis permanecem montados durante a troca de abas. Ha uma unica instancia
do Formik, preservando valores de cliente/endereco, equipe, usuarios, datas,
questionario, anexos e campos personalizados.

A cascata Cliente -> Endereco/Equipamento e Endereco -> Equipamento continua no
handleChange compartilhado. Os controles de selecao originais, escopo por cliente,
opcoes de usuarios e validacoes da empresa nao foram reimplementados.

O handler da pagina continua executando formatValues, handleFileUpload,
patchTasksOfWorkOrder, editWorkOrder e o feedback de sucesso/falha existentes.
Nao muda ordem das chamadas nem dados do contrato. Nao houve salvamento de uma
OS real como parte dos testes automatizados.

O Form compartilhado ganhou dois parametros opcionais de layout, mantendo o
renderizador padrao nas demais telas. Sua promise de submit agora e retornada ao
Formik, para aguardar o salvamento real; FileUpload recebe isSubmitting como
disabled. O seletor de tarefas respeita a opcao existente hideCategoryChecklistAlert,
sem mudar o banner padrao nos outros consumidores que nao a usam.

## Arquivos da implementacao

- frontend/src/content/own/WorkOrders/components/EditWorkOrderTabbedModal.tsx
- frontend/src/content/own/WorkOrders/components/EditWorkOrderTabbedModal.test.js
- frontend/src/content/own/WorkOrders/index.tsx
- frontend/src/content/own/components/form/index.tsx
- frontend/src/content/own/components/form/CustomSelect2.tsx
- frontend/src/content/own/components/form/CustomSelect2.test.js
- frontend/src/i18n/translations/pt_BR.ts

O diff maior no Form compartilhado inclui reindentacao pelo Prettier apos
encapsular os campos no novo hook opcional de layout; nao sao renderizadores
duplicados. Alteracoes anteriores nao relacionadas no working tree preservadas.

## Validacao

- Build local npm run build: passou, com os avisos existentes CRA/Browserslist.
- Suite completa frontend final: 25 suites / 219 testes passaram, incluindo
  13 testes do modal novo e dois testes adicionais do banner compartilhado.
- Novos testes cobrem troca de abas e contrato dos valores, cascata de cliente,
  campos configurados/ocultos, erros em outra aba via botao e Enter, anexos,
  trava durante envio, rejeicao mantendo dados, cancelar/reabrir e retrocompatibilidade
  do layout padrao. API, seletores de entidades e uploads sao simulados.
- Portal/transicao do Dialog isolado na suite nova para nao depender de timers
  de animacao do MUI; verificacao visual real e complementar.
- Lint quiet dos componentes alterados passou. Build Docker final tambem passou,
  usando o Dockerfile existente, sem mudar flags ou dependencias.
- Jest usou cache dentro de tmp para evitar EPERM do cache sandbox. Execucao
  completa usa forceExit; warnings de act/SSR e Babel herdados foram mantidos.
- tsc 4.7 instalado nao consegue interpretar tipos do i18next 25 existente.
  Checagem adicional com TypeScript 5.8.3 ja disponivel no mobile nao encontrou
  erros nos arquivos alterados, mas a checagem global reportou 21 erros em
  Workflows e Vendors nao alterados. Nao houve upgrade de dependencia ou correcao
  fora do escopo; nao afirmar que o tsc global passou.
- Diff/check passou. Nenhuma alteracao em mobile, API, manifests de dependencias
  ou configuracao de ambiente foi feita nesta etapa.

Logs locais: tmp/wo-edit-build.log, tmp/wo-edit-all-final-tests.log,
tmp/wo-edit-tsc.log, tmp/wo-edit-tsc-modern.log, tmp/wo-edit-eslint.log e
tmp/wo-edit-docker-final.log.
Atualizacao AST da primeira implementacao concluida: 18813 nos / 62635 arestas,
1160 arquivos nao cacheados e 22 avisos conhecidos de configuracoes sem nos.
Log: tmp/graphify-edit-modal-20261020.log. O refinamento tem atualizacao separada.

## Verificacao visual e DEV

Container frontend DEV rebuildado e recriado com `docker compose up -d
--no-deps frontend`; localhost:3000 respondeu 200. API, PostgreSQL e MinIO
mantiveram os containers anteriores em execucao, sem reinicio.

Verificacao na sessao DEV fornecida pelo usuario, OS 2352 / WO000096 CampReina.
Foram abertas as tres abas e conferidos titulo, descricao, cliente, endereco,
datas, responsaveis e anexos. Nao foi salva alteracao nem enviado arquivo.

Verificado diretamente em 530 px: dialogo 512 px, clientWidth e scrollWidth
iguais; botao Salvar entre y=451 e y=498 dentro da viewport de 524 px.
Tambem testada a aplicacao real em iframe responsivo de mesma origem, com
larguras internas de 390, 1024 e 1366 px. Coluna unica no celular, duas no
desktop; cabecalho e rodape continuam separados da rolagem central. A pagina
auxiliar apenas ajusta dimensoes/escala, nao simula dados nem salva a OS.
Nao e homologacao em aparelho fisico ou em todos os navegadores.

Captura da versao final no notebook: `tmp/wo-edit-desktop-final.png`.
Pagina auxiliar: `tmp/wo-edit-responsive-20261020.html`, temporaria e fora do
commit. O modal real fica disponivel no aplicativo DEV, nao apenas no prototipo.

## Refinamento solicitado pelo usuario

- Corrigido conflito entre altura de 38 px do tema global de Tabs e espacamento
  local: altura automatica, abas de 40 px, indicador herdado oculto e fundo azul
  Erione no item selecionado. Divisor fica abaixo dos botoes, sem atravessa-los.
- Override restrito ao modal, sem alterar PureLightTheme ou outras telas. Mantidos
  roles/ARIA e foco visivel; seta e Enter testados na aplicacao real.
- Nome curto Planejamento em celular, mantendo nome acessivel completo. Duas
  colunas no notebook; coluna unica e campos empilhados no celular.
- Servico: titulo e descricao; depois tipo de tarefa em linha propria; prioridade
  e assinatura agrupadas. Cliente/endereco e Questionario da OS em cards distintos.
- Removidos do fluxo padrao Ativo, Status do ativo e o card editavel de itens do
  checklist. Valores anteriores de asset/assetStatus/tasks preservados no Formik.
- Questionario da OS mostra Vinculado ao tipo de tarefa e o nome REAL do
  defaultChecklist da categoria selecionada. CARTAO DE MEMORIA e exemplo de
  template, nao texto fixo. Sem botao de edicao dos itens nesta tela.
- Caso metadados ainda nao estejam no Redux, usa GET existente de categorias na
  abertura; nao busca por caractere digitado nem cria endpoint. Falha de consulta
  tem mensagem e Tentar novamente, sem afirmar erroneamente que nao ha template.
- Tipo sem questionario padrao informa isso explicitamente; itens e respostas
  existentes continuam preservados. Handler de salvamento original nao foi alterado.
- Auditoria somente leitura de TaskController confirmou que o sync existente
  preserva value/notes/images das tarefas correspondentes e nao apaga tarefas
  usadas ausentes da lista. Nao houve modificacao de backend nesta etapa.
- Suite completa atual: 25 suites / 224 testes passaram, sendo 18 testes do
  modal. Cobertura adicional: nome real ao trocar tipo, tipo sem template,
  carregamento automatico, falha/retry e equipamento obrigatorio apos cascata.
- Docker build e ESLint quiet passaram. Checagem adicional TS5.8 continua com
  21 erros preexistentes em Workflows/Vendors, nenhum nos arquivos desta feature.
- Container frontend DEV atualizado com --no-deps; API/PostgreSQL/MinIO nao
  reiniciados. Testada OS real 2352 sem salvar nem enviar arquivo, no notebook
  de 1366 px e celular de 390 px via iframe, e diretamente na viewport de 530 px.
- Capturas: tmp/wo-edit-refine-desktop.png e tmp/wo-edit-refine-questionnaire.png.
- Referencias: https://mui.com/material-ui/react-tabs/ e
  https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ . APIs conferidas na MUI5 instalada;
  documentacao atual consultada apenas para principios de organizacao/acessibilidade.
- Na validacao de implementacao, ainda sem commit/push ou deploy em producao;
  nenhuma alteracao mobile, API, banco, PDF ou env.
- Atualizacao AST do refinamento concluida: 18823 nos / 62649 arestas,
  1159 arquivos nao cacheados e 22 avisos conhecidos de configuracoes sem nos.
  Log: tmp/graphify-edit-refine-20261020.log. Sem clustering ou custo de API.
