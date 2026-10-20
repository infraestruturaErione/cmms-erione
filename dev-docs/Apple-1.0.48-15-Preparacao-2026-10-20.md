# Apple 1.0.48 (15) - preparacao para Bitrise

## Versoes e escopo

O usuario confirmou no App Store Connect que o ultimo upload concluido foi
1.0.47 (14), em 14/10/2026. Proximo envio preparado: **iOS 1.0.48 (15)**.

Versao/build atualizados em `mobile/app.config.ts`, `Info.plist` e nas duas
configuracoes Xcode (Debug/Release). Runtime iOS 1.0.48 alinhado tambem no
`Supporting/Expo.plist`. Bundle ID continua `com.cmms.erione`.

Esta entrega inclui as melhorias mobile aprovadas no APK DEV UI-07, nao apenas
a troca de versao. Foram selecionados explicitamente 88 arquivos mobile e este
registro. Backend, frontend web, PDF, temporarios, backups, `.env`, credenciais,
novas chaves e demais alteracoes do working tree ficaram fora.

## Melhorias incluidas

- Identidade Erione com logo pequeno, resumo visual do dia e animacao curta
  respeitando reducao de movimento. Polling existente da Home preservado.
- Fluxo guiado de campo, leitura para acompanhantes e questionario vinculado a
  OS. Testes cobrem operador efetivo sem a antiga trava individual da pergunta.
- Questionario com feedback de salvamento e ordenacao de escritas. Voltar aguarda
  os envios atuais; erro preserva o texto e oferece protecao de saida. Progresso
  preenchido nao e apresentado como garantia de confirmacao no servidor.
- Camera de evidencias com previa, confirmar/refazer e captura em sequencia.
  Controles fora de CameraView; fluxo padrao dos outros uploads preservado.
- Busca de OS confirmada por Enter/lupa, sem request por cada letra. Ativas sem
  filtros visuais de status/prioridade; Historico mantem esses controles.
- Lista virtualizada, controle de paginas/requests e galeria com janela de
  imagens. Atualizacao preserva contexto e evita sobrescrever edicoes pendentes.
- Limpeza local de OS concluida somente apos verificar preservacao remota e
  ausencia de pendencias. Mantem resumo leve e consulta online posterior; remove
  apenas copias locais identificadas por conta/API/OS. Nao remove a OS no servidor,
  galeria pessoal, PDFs baixados, outras OS ou caches antigos sem identificacao.

Os testes nao substituem medicao de memoria ou validacao nativa no iPhone.
Nao foi adicionada fila offline duravel nem alterada a autorizacao do DELETE
remoto do backend. A limpeza local e um fluxo separado desse DELETE remoto.

## Validacao local

Validacao em copia limpa extraida do indice Git: 461 arquivos mobile, sem
depender de arquivos nao rastreados deste computador.

Pasta local de trabalho: `C:\gt\erione-ios-release-20261020\mobile`.

- `npm@10.9.3 ci --include=dev --foreground-scripts`: passou.
- `patch-package --error-on-fail`: os tres patches existentes passaram.
- `tsc --noEmit --pretty false`: passou.
- Jest: **39 suites / 402 testes passaram**, com cache novo. Excluido somente
  `StyledText-test.js`, cujo snapshot ja estava ausente antes desta entrega.
- Export Expo de producao para iOS/Hermes: passou (1854 modulos).
- Bundle de 7783912 bytes; SHA256
  `70C12CB0763B8227045C8FD885D5CBF813DCC9C93B7958A7D20CDF1661ECAB65`.
- API de producao encontrada no bundle; URLs DEV conhecidas e marcadores RNFB
  verificados nao aparecem. Configuracao publica Expo e plists consistentes.
- Autolinking iOS exclui os dois pacotes React Native Firebase, conforme a
  configuracao existente que ja acompanhou o build 14. Nenhuma nova mudanca nisso.
- Diff/check e verificacao direcionada de segredos nos trechos adicionados
  passaram; nenhum arquivo de segredo/ambiente foi selecionado.

O npm reportou 109 vulnerabilidades no conjunto atual de dependencias
(5 baixas, 29 moderadas, 72 altas, 3 criticas). Nao foram executados `audit fix`
nem upgrades de dependencias nesta preparacao. Logs locais: `npm-ci.log`,
`jest.log`, `expo-ios.log`, `ios-autolinking.json`, `expo-public.json` na copia.

## Executar no Bitrise

1. Selecionar **main no commit desta entrega** no workflow iOS ja existente.
2. Manter `API_URL=https://cmms.erione.com.br/api` e `ENABLE_FIREBASE=false`.
3. Manter instalacao npm em `mobile` e `pod install` em `mobile/ios`.
4. Usar workspace/scheme **AtlasCMMS**, configuracao **Release**, bundle ID
   `com.cmms.erione`; manter certificados, provisioning e assinatura existentes.
5. Confirmar no log/archive **1.0.48 (15)** antes de enviar e usar a versao
   correspondente no App Store Connect. Validar o fluxo no iPhone/TestFlight.

Nao existe `bitrise.yml` rastreado neste repositorio; a configuracao reutilizada
esta no painel Bitrise. Nenhum workflow foi criado ou disparado aqui. Nao rodar
`expo prebuild --clean` como parte desta entrega.

O `Podfile.lock` rastreado ainda tem referencias antigas a Firebase. Nao foi
reescrito manualmente: o passo de CocoaPods precisa reconciliar os pods com o
autolinking existente. Confirmar isso no Mac do Bitrise. Windows validou fonte,
testes, configuracao e bundle JS; **nao compilou, assinou nem enviou IPA**.

## Android ja entregue

O AAB ja gerado continua **1.0.47 (42)**, inalterado, na pasta central
`APK  - iNSTRUCOES/Novos-Builds/AAB` (nome real da pasta usa acentuacao).
SHA256: `8935BF47AA499F249CD6812B705F3AE1767AC7463148EC4D503C9C2EEF1B2438`.

Gradle, versionCode e runtime Android continuam 1.0.47 (42). A versao Expo global
agora e 1.0.48 para preparar Apple, como na entrega iOS anterior. Nao reconstruir
um AAB diferente com o codigo 42; alinhar a proxima versao Android e escolher um
novo versionCode quando houver outra entrega. Nenhuma publicacao foi realizada.
