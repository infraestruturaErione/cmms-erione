# Auditoria MVP Operacional - 2026-08-04

## Objetivo

Validar o fluxo minimo operacional entre administracao web e aplicativo do tecnico:

1. administrador cria e atribui uma OS;
2. somente o tecnico atribuido recebe e acessa a OS;
3. o tecnico registra deslocamento, check-in, checklist, relato, evidencia e check-out;
4. a conclusao persiste assinatura e dados do responsavel;
5. a administracao consulta o atendimento completo na web;
6. alteracoes de atribuicao chegam ao app sem recarregar a pagina.

## Correcoes aplicadas

### Atualizacao em tempo real

- O backend passou a publicar alteracoes da OS no topico `/work-orders/{userId}`.
- A atribuicao e a retirada de um tecnico notificam os usuarios envolvidos.
- O mobile assina os topicos de notificacoes e de ordens de servico usando um cliente STOMP com reconexao.
- O reducer do mobile preserva o criterio ativo e refaz a busca atual quando uma OS muda.
- A Home possui polling de seguranca a cada 30 segundos enquanto estiver em foco.
- O WebSocket aceita as origens configuradas em `EXTRA_CORS_ORIGINS`, incluindo o Expo Web em `http://localhost:8081`.
- O broker simples inclui o destino `/work-orders`.

### Assinatura

- O componente mobile salva o desenho no Formik ao finalizar o traco (`onEnd`).
- O tecnico nao depende mais de tocar em um segundo botao de salvar antes de concluir.
- `signature`, `signerName`, `signerDocument` e `mileageTraveled` foram confirmados na resposta da API e na tela web.

> **Correcao (2026-08-05):** essa afirmacao estava incompleta. Um novo teste
> ponta a ponta em 2026-08-05 mostrou que `signerName`, `signerDocument` e
> `mileageTraveled` eram gravados no banco pelo `PATCH /work-orders/{id}/change-status`
> mas **nao** voltavam em `GET /work-orders/{id}` (vinham `undefined`) — so
> `signature` de fato ia e voltava. Causa: os 3 campos existiam na entidade
> `WorkOrder` e no DTO de entrada (`WorkOrderChangeStatusDTO`), mas nunca foram
> adicionados ao DTO de saida (`WorkOrderShowDTO`). Corrigido nesta mesma data —
> ver secao `2026-08-05` em `Log-Alteracoes.md`.

### Seguranca do checklist e anexos

- Leitura de checklist por OS ou por item agora valida o acesso real a Work Order.
- Alteracao e exclusao de item exigem que a OS possa ser editada pelo usuario.
- Upload associado a um item valida a OS antes de enviar o arquivo ao storage.
- O backend ignora o `folder` informado pelo cliente no upload autenticado e usa `company {id}` calculado pelo usuario autenticado.
- Comentarios/relatos ja reutilizavam `checkAccessToWorkOrderId` e foram mantidos.

## Validacao ponta a ponta

### OS de auditoria concluida

- ID interno: `602`.
- ID visivel: `WO000022`.
- Titulo: `AUDITORIA MVP - fluxo tecnico 2026-08-04 20:39`.
- Resultado: `COMPLETE`.
- Categoria com checklist automatico e requisitos de relato, foto e assinatura.
- Deslocamento, check-in e check-out gravados com coordenadas.
- Checklist: cinco de cinco itens preenchidos.
- Relato em campo criado pelo tecnico.
- Evidencia de imagem enviada ao MinIO e URL validada com HTTP 200.
- Assinatura, nome, documento, feedback e quilometragem persistidos.
- Web exibiu `5 de 5 etapas prontas`, relato, evidencia e assinatura.

### OS de auditoria em tempo real

- ID interno: `603`.
- ID visivel: `WO000023`.
- Titulo: `AUDITORIA REALTIME - 20:43:40`.
- Ao retirar o tecnico, a OS sumiu da Home sem reload e o contador caiu de 2 para 1.
- Ao atribuir novamente, a OS reapareceu sem reload e o contador voltou de 1 para 2.
- A OS permanece aberta e atribuida ao tecnico de teste para inspecao.

### Testes de escopo

- Tecnico em OS nao atribuida:
  - lista de checklist: HTTP 403;
  - item individual: HTTP 403;
  - alteracao de item: HTTP 403;
  - upload ligado ao item: HTTP 403.
- Tecnico em OS atribuida:
  - leitura do checklist: HTTP 200.
- O acesso direto a uma Work Order nao atribuida tambem permaneceu em HTTP 403.

## Builds e servicos

- Backend: `docker compose build api` passou com Maven `BUILD SUCCESS`.
- Backend recriado e iniciado sem migrations novas: 796 changesets ja aplicados, zero executados.
- Frontend: imagem Docker compilada com sucesso nesta sessao.
- Mobile: `tsc --noEmit` passou.
- Containers preservados e em execucao: API, frontend, PostgreSQL e MinIO.
- Expo Web permaneceu disponivel em `http://localhost:8081` durante os testes.

## APK/AAB - estado para continuar em 2026-08-05

- O APK e o AAB nao foram concluidos por decisao do usuario; a compilacao fica para amanha.
- Nenhum processo Gradle/Java do build ficou ativo.
- O EAS CLI foi instalado em cache local, mas a maquina nao esta autenticada no Expo/EAS.
- Foi preparado um toolchain portatil em `%TEMP%\erione-android-toolchain` com JDK 17, Android SDK 35, NDK 27.3 e CMake 3.22.1.
- Foi criada a copia de build `C:\erione-mobile-build`, procedimento ja usado anteriormente para evitar locks/caminho longo no Gradle.
- O primeiro build no repositorio falhou por lock de cache do Gradle no Windows.
- O build na copia curta preparou os caches, mas uma tentativa recebeu uma opcao `-D` interpretada como tarefa; a repeticao correta foi interrompida para continuar amanha.
- Metadados restaurados conforme o ultimo AAB documentado:
  - package: `com.cmms.erione`;
  - versao: `1.0.41`;
  - versionCode: `34`;
  - runtimeVersion: `1.0.41`.
- O perfil `previewAndroid` usa `API_URL=https://cmms.erione.com.br/api`.
- O `.env` local continua com `http://localhost:8080` para Expo Web e nao foi trocado por IP de rede.

### Checklist de amanha

1. confirmar credencial/keystore de assinatura para APK e AAB;
2. confirmar o proximo `versionCode` disponivel no Google Play/EAS;
3. gerar APK de teste e AAB de producao;
4. validar assinatura com `apksigner`/`jarsigner` e calcular SHA-256;
5. instalar em aparelho de teste sem remover o app operacional antes de confirmar compatibilidade de assinatura;
6. executar login, sincronizacao de OS, checklist, foto, assinatura e conclusao no aparelho;
7. somente depois considerar envio ao Google Play.

## Dados e limites

- Nenhum volume, banco, bucket ou arquivo existente foi apagado.
- Nenhuma migration foi criada ou executada.
- Nenhuma alteracao foi enviada para producao.
- A senha do usuario tecnico de teste foi redefinida pela API para permitir a auditoria; o segredo nao foi registrado neste documento.
- As OS `WO000022` e `WO000023` sao dados de auditoria e nao foram apagadas.
- Customer Scope, relacionamentos cliente/local/ativo e validacoes de associacao nao foram ampliados nesta leva.

