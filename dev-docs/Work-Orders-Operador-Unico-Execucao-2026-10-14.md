# Work Orders: operador unico de execucao

Data: 2026-10-14. Implementacao local, ainda sem commit, deploy ou migration no banco real.

## Diagnostico e regra

Antes, canBeEditedBy autorizava varios atribuidos a escrever a mesma execucao. A permissao de participar nao representava posse operacional. Nenhuma trava persistente distinguia quem iniciou de quem apenas consultou.

A OS continua unica: primaryUser, assignedTo e team permanecem independentes. O primeiro usuario elegivel que inicia adquire executionOwner e executionClaimedAt. GET nunca adquire. Nenhum timeout ou mudanca de foco libera a posse.

Eventos de aquisicao: POST /work-orders/{id}/execution/start (acao explicita para assumir inclusive OS legadas), depart, check-in, status IN_PROGRESS/EN_ROUTE e inicio do timer. Responder questionario, enviar relato ou anexar evidencia nao adquire implicitamente.

Elegibilidade combina acesso existente (company, Customer Scope e role), canBeEditedBy e isAssignedTo. Este ultimo ja inclui primaryUser, assignedTo e membros da team. Requester nao executa; administrador nao atribuido nao ganha posse por ser administrador.

O acompanhante conserva o acesso de leitura existente, mas uma tentativa de escrita operacional recebe HTTP 409 com code, workOrderId e identificacao do operador. Usuarios sem acesso continuam recebendo os erros de autorizacao existentes.

## Atomicidade e ciclo de vida

WorkOrderRepository.findForExecution usa PESSIMISTIC_WRITE, limitado a company. A entidade e refreshed depois da query: o contexto pode ter carregado uma copia anterior antes de esperar pela trava. Toda verificacao e escrita operacional compartilha a transacao externa; os guards exigem transacao MANDATORY.

Assim, duas transacoes concorrentes aguardam a mesma linha, apenas uma grava owner nulo, e a outra rele o vencedor antes de escrever. Nao foi adicionado @Version global.

PATCH administrativo e atualizacao da equipe liberam o owner de uma OS aberta se ele deixar de estar em todas as atribuicoes elegiveis. Estar ainda em primaryUser, assignedTo ou team conserva a posse. Mudancas isoladas de role, enabled ou escopo nao implementam um novo mecanismo de transferencia automatica.

Na conclusao, owner e completedBy permanecem separados. Nomes dos usuarios explicitamente atribuidos (primary + assignedTo sem duplicacao) e da equipe sao congelados em completedAssignedUserNames/completedTeamName. Equipe nao gera atribuicoes individuais ficticias.

Retry COMPLETE do mesmo operador retorna antes de alterar assinatura, feedback, timestamps, workflows, notificacoes, agenda ou webhook. Acompanhante continua bloqueado. OS legada ja concluida sem owner nao recebe um owner ficticio para atender retries.

Reabertura administrativa explicita reutiliza change-status com OPEN, sob a mesma trava. Libera owner e dados da conclusao para novo inicio; preserva questionario, relatos, evidencias e registros de deslocamento/check-in/check-out existentes. Valores anteriores de posse, conclusao e snapshots permanecem na auditoria Envers. Nao representa uma nova OS nem reinicia silenciosamente todos os registros de atendimento.

## API auditada e protegida

| Caminho / componente | Regra |
| --- | --- |
| execution/start, depart, check-in | Aquisicao explicita ou reutilizacao pelo mesmo operador |
| check-out, change-status operacional | Operador; COMPLETE tem retry idempotente |
| TaskController: respostas, notas e fotos | Operador |
| TaskController: exclusao de item com resposta/notas/fotos | Permissao administrativa existente mais operador |
| CommentService: criar/editar/excluir relato [Relato em campo] | Operador; editar entrada/saida do prefixo tambem verifica |
| FileController: upload vinculado a task, renomear/excluir fotos de task/relato | Operador de todas as OS operacionais referenciadas |
| LaborController: timer e horas manuais | Inicio pode adquirir; demais escritas exigem operador |
| AdditionalCostController | Escrita exige operador |
| PartQuantityController: consumo e alteracoes | Escrita exige operador; gating nao foi alterado |
| Assinatura, nome/documento do assinante e quilometragem | Protegidos no change-status |
| Arquivos diretamente na OS | Referencia administrativa: admin continua autorizado; tecnico precisa ser operador |
| Comentarios comuns | Discussao, nao relato operacional: direitos existentes preservados |
| Relations e estrutura administrativa | Direitos administrativos existentes preservados |

Uploads ainda nao associados nao sao classificados como execucao. A autorizacao e aplicada ao vincular o arquivo e ao modificar/excluir evidencias associadas. cleanup-unused conserva seu ciclo transacional anterior.

CustomerScopeService, Role model, mecanismos de acesso de leitura, modulos ocultos e configuracao de empresa nao foram modificados. DTOs operacionais continuam passando pelo filtro de escopo existente.

## Web, mobile e PDF

Web/mobile mostram operador, acao para assumir e acompanhamento somente leitura. Escritas operacionais e respostas do questionario sao bloqueadas visualmente para acompanhante, sem depender disso para seguranca. Erros de conflito dispararam refresh da OS; TasksScreen tambem atualiza as respostas. Polling existente nao foi alterado.

Administracao permanece separada: categoria, prioridade, atribuicoes e referencias continuam administrativas. Admin pode reabrir uma OS concluida de forma explicita. As telas nao inferem operador a partir de primaryUser ou da posicao em assignedTo.

Mobile mostra Criada em usando createdAt e formatter/timezone da empresa, na lista e detalhes. A ordenacao atual id DESC foi preservada: criteria envia DESC sem sortField, cujo default backend e id. Nenhuma coluna nova para data de criacao.

PDF individual e em massa usam o mesmo fragmento: trabalhador principal, operador, usuarios explicitamente atribuidos, equipe e concluido por ficam separados. Sem owner nao se afirma que primaryUser executou. Snapshots sao usados para atribuicoes de OS concluidas. CSS permite quebra de nomes longos. Otimizacao das imagens nao foi alterada.

## Persistencia

Migration nova: api/src/main/resources/db/changelog/2026_10_14_00000000001_workorder_execution_owner.xml, incluida em db/master.xml.

Adiciona owner nullable com FK para own_user, timestamp nullable e snapshots; inclui colunas e modified flags da auditoria. Nao altera migrations historicas, nao faz backfill ficticio, nao remove tabelas ou dados. Testada isoladamente com Liquibase/H2, inclusive preservacao de linha legada e FK invalida.

Deploy requer backend + migration + frontend e novo aplicativo mobile coordenados. Cliente antigo continua seguro porque API recusa escrita sem posse; porem pode nao oferecer a acao explicita necessaria para uma OS legada ja em andamento.

## Arquivos da feature

Backend (api/src/main/java/com/grash):

- controller/AdditionalCostController.java, CommentController.java, FileController.java, LaborController.java, PartQuantityController.java, TaskController.java, WorkOrderController.java.
- dto/workOrder/WorkOrderShowDTO.java; exception/GlobalExceptionHandlerController.java e WorkOrderExecutionException.java; mapper/WorkOrderMapper.java.
- model/WorkOrder.java, model/envers/WorkOrderAud.java; repository/CommentRepository.java e WorkOrderRepository.java.
- service/CommentService.java, TeamService.java, WorkOrderService.java e WorkOrderReportService.java.

Recursos:

- api/src/main/resources/db/master.xml e a migration nova acima.
- api/src/main/resources/templates/fragments/work-order-report-body.html e work-order-report-styles.html.

Frontend:

- frontend/src/content/own/WorkOrders/Details/WorkOrderDetails.tsx.
- frontend/src/models/owns/workOrder.ts; slices/workOrder.ts; utils/axios.ts; utils/workOrderExecution.ts e workOrderExecution.test.js.

Mobile:

- mobile/components/SingleTask.tsx; models/workOrder.ts; slices/workOrder.ts; utils/api.ts e workOrderExecution.ts.
- mobile/screens/workOrders/TasksScreen.tsx, WODetailsScreen.tsx, WorkOrdersScreen.tsx e __tests__/workOrderExecution.test.js.

Testes backend (api/src/test/java/com/grash):

- controller/WorkOrderExecutionCompletionRetryTest.java, WorkOrderExecutionEndpointsTest.java.
- service/WorkOrderExecutionConcurrencyTest.java, WorkOrderExecutionMigrationTest.java.
- service/WorkOrderServiceWriteAccessTest.java, WorkOrderReportServiceTest.java.
- controller/FileCleanupEvidenceIntegrationTest.java, FileControllerCleanupTest.java e FileControllerUploadRollbackTest.java: apenas ajuste de construtor para CommentRepository.

Arquivos e diretorios preexistentes nao relacionados continuam fora desta feature. Nenhum commit/push foi feito.

Graphify atualizado por AST com `update <caminho absoluto> --no-cluster`: 18146 nodes e 61307 edges. O grafo curado anterior foi preservado pelo backup automatico. GRAPH_REPORT.md informa a atualizacao e distingue as comunidades/HTML antigos; nao houve extracao semantica paga de documentos.

## Validacao local

Backend: JDK 17.0.20, Maven wrapper 3.8.6.

```powershell
# Na pasta api
.\mvnw.cmd -q '-Dtest=WorkOrderServiceWriteAccessTest,WorkOrderExecutionConcurrencyTest,WorkOrderExecutionMigrationTest,WorkOrderExecutionCompletionRetryTest,WorkOrderExecutionEndpointsTest,WorkOrderReportServiceTest,CustomerScopeSpecificationIntegrationTest,CommentServiceDeduplicationTest,FileCleanupEvidenceIntegrationTest,FileControllerCleanupTest,FileControllerUploadRollbackTest' test
.\mvnw.cmd -q -DskipTests package
# Na pasta mobile
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/jest/bin/jest.js --runInBand screens/workOrders/__tests__/workOrderExecution.test.js screens/workOrders/__tests__/workOrderCompletion.test.js
# Na pasta frontend
$env:CI='true'
npm.cmd run build
node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand src/utils/workOrderExecution.test.js
```

Resultados confirmados: backend 68 testes, sem failures/errors; pacote backend compilado; TypeScript mobile sem erros; testes mobile selecionados 26/26. Concorrencia usa duas transacoes reais H2 com entidades pre-carregadas antes da disputa, por assignedTo e por equipe. PDF e renderizado em memoria e o texto extraido e conferido.

Suite completa mobile: 8 suites, 89 assertions aprovadas, mas exit 1 por Cannot log after tests are done em carregamento assincrono de icones Expo. Nao foi suprimido nem corrigido fora do escopo.

Build frontend de producao com CI=true aprovado; teste da feature 2/2 aprovado (exit 0, com aviso de handles abertos do Jest/CRA). A tentativa inicial no sandbox encontrou EPERM de realpath; repetir fora do sandbox resolveu sem suprimir lint.

TypeScript standalone do frontend tem incompatibilidade preexistente entre TS 4.7.3 e tipos i18next 25.7.1; diagnostico com TS mais recente tambem encontrou erros preexistentes em Settings/Features/Workflows. Dependencias e esse modulo nao foram alterados.

Limites: nao houve deploy, acesso a producao, execucao em PostgreSQL real, teste simultaneo em aparelhos, build APK/AAB/IPA ou compilacao Xcode. A garantia automatizada nao substitui homologacao do fluxo inteiro em dois aparelhos. Layout PDF tem teste de renderizacao/texto, sem revisao visual manual desta alteracao.

## Checklist da implementacao

- [x] Uma OS continua unica.
- [x] Continua aceitando varios assignedTo.
- [x] Continua aceitando equipe.
- [x] Somente um operador executa por vez.
- [x] Primeiro tecnico elegivel que inicia ganha.
- [x] Acompanhante possui leitura.
- [x] Backend impede escrita operacional do acompanhante.
- [x] Customer Scope preservado.
- [x] Permissoes administrativas preservadas.
- [x] Todos os explicitamente atribuidos aparecem no relatorio, sem duplicacao.
- [x] Equipe aparece no relatorio quando existe.
- [x] Operador aparece no relatorio quando existe.
- [x] createdAt aparece claramente no mobile.
- [x] Conclusao permanece idempotente para retry do operador.
- [x] Concorrencia foi testada com transacoes reais H2.

## Homologacao antes de producao

### Avisos mobile de acompanhamento - complemento

O questionario possui aviso explicito de somente leitura, distinguindo outro operador, OS concluida, execucao nao iniciada e restricao de acesso. No card da lista de OS abertas com outro operador, a faixa de proxima acao mostra Somente leitura / Em execucao por [nome] e orienta tocar para acompanhar. O card continua navegavel; nao muda permissao administrativa, atribuicao, filtros, sincronizacao ou conclusao. O proprio operador conserva a faixa operacional; OS concluida nao e descrita como em execucao. TypeScript mobile e 32 testes selecionados aprovados. Nao houve APK novo nem medicao de memoria/rolagem em aparelho; virtualizacao nao foi implementada neste complemento.

Validar em PostgreSQL e dois clientes: atribuicao direta/equipe, start simultaneo, consulta sem claim, acompanhante com estado antigo tentando todas as escritas, operador realizando deslocamento/questionario/relato/fotos/check-out/assinatura/conclusao, retry COMPLETE, reatribuicao e reabertura administrativa. Conferir PDF individual/em massa e mobile Android/iOS.
