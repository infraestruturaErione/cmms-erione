# Preparacao Android e Apple - 1.0.46

## Versoes

- Google Play: usuario informou ultimo pacote 1.0.45 (40).
- Android preparado: 1.0.46 (41), com.cmms.erione, target SDK 36.
- Usuario confirmou por prints do App Store Connect: 1.0.46 (12) ja enviado.
- iOS preparado agora: 1.0.46 (13), com.cmms.erione; build atualizado no
  app.config.ts, Info.plist e configuracoes Xcode Debug/Release.
- Android permanece 1.0.46 (41). Confirmar que 41 nao foi usado em outro track.
- Base funcional: commit 40db5ee, incluindo tecnico unico sem botao extra de assumir.

## Ajustes locais de preparacao

- Runtime OTA Android nativo: 1.0.41 -> 1.0.46.
- Runtime OTA iOS nativo: 1.0.43 -> 1.0.46.
- Esses valores agora correspondem ao app.config.ts; evita compatibilidade OTA
  declarada com versoes antigas. Nao foi enviada nenhuma atualizacao OTA.
- Firebase excluido do autolinking iOS em react-native.config.js. Android preservado.
- AuthContext usa adaptador: Firebase existente no Android; no-op de analytics
  especifico para iOS, sem importar/inicializar modulo Firebase nesse bundle.
- NFC/leitura de codigo de barras nao foram adicionados. Camera/galeria preservadas.
- API de producao: https://cmms.erione.com.br/api.
- Nenhuma mudanca em certificados, profiles, assinatura Apple ou YAML do Bitrise.

## Validacoes locais

- npm ci limpo e patch-package aprovados.
- TypeScript aprovado apos ajustes.
- 34 testes de execucao/conclusao aprovados.
- Expo export iOS de producao aprovado: Hermes, 1814 modulos.
- URL de producao presente no bundle iOS; referencias RNFBAppModule e
  RNFBAnalyticsModule ausentes; autolinking iOS nao inclui esses modulos.
- Scheme AtlasCMMS e workspace mobile/ios/AtlasCMMS.xcworkspace existentes.
- Info.plist e configuracoes Xcode Debug/Release: 1.0.46 (13).

## Bitrise / pendencias Apple

Usuario autorizou commit/push dos ajustes desta preparacao. O codigo funcional
do commit 40db5ee ja esta na main. Usar a revisao de preparacao apos confirmar
sucesso do push; nao acionar automaticamente o Bitrise.
Nao executar expo prebuild; usar pasta ios existente, API_URL de producao e
ENABLE_FIREBASE=false. O usuario aciona o workflow existente manualmente.

No macOS/Bitrise executar npm ci --include=dev --foreground-scripts em mobile,
depois pod install em mobile/ios e archive Release com scheme AtlasCMMS.
O Podfile.lock atual ainda registra RNFBApp/RNFBAnalytics da resolucao anterior;
pod install deve atualizar essa resolucao apos a exclusao de autolinking.
Conferir ausencia de Firebase nos pods resultantes antes de aprovar o archive.
Nao apagar lockfile ou editar suas centenas de linhas manualmente para simular
um pod install. CocoaPods/Xcode/IPA nao foram executados nesta maquina Windows.
Teste de fotos, assinatura, teclado e conclusao no iPhone permanece necessario.

O AAB de loja deve usar a upload key documentada, nunca a assinatura interna do
APK. Senhas somente em memoria; nenhum segredo neste documento ou no Git.
Geracao e validacao locais nao comprovam aceite/publicacao nas lojas.
