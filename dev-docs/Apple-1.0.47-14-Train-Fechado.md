# Apple - correcao de train fechado

O upload do IPA 1.0.46 (13) foi rejeitado com erro 90186: a Apple informou que
o train 1.0.46 esta fechado para novos builds. A compilacao nao falhou nessa etapa;
o problema relatado foi a versao aceita pelo App Store Connect.

Preparacao corrigida: iOS 1.0.47 (14). Marketing version e build atualizados
no Info.plist e nas configuracoes Debug/Release do projeto Xcode. Configuracao
Expo compartilhada agora declara version 1.0.47, ios.buildNumber 14 e runtime
iOS 1.0.47, tambem alinhado no Expo.plist nativo.

Android nativo continua versionName 1.0.46, versionCode 41 e runtime 1.0.46.
O AAB ja entregue 1.0.46 (41) e imutavel e nao precisa ser gerado novamente
por causa desta alteracao Apple. A versao Expo global mudou para a preparacao
Apple; antes de um futuro build Android, alinhar a versao desse proximo release
com seu Gradle e escolher um versionCode ainda nao utilizado. Nao reconstruir
um novo AAB diferente usando novamente o codigo 41 se ele ja tiver sido enviado.

Usar o workflow existente no Bitrise com main atual, workspace/scheme AtlasCMMS,
Release, bundle com.cmms.erione, API https://cmms.erione.com.br/api e
ENABLE_FIREBASE=false. Nenhuma mudanca em YAML, certificados, profiles ou secrets.
Criar/usar a versao 1.0.47 no App Store Connect para a submissao correspondente.
Geracao de IPA e upload ficam a cargo do usuario/Bitrise, nao desta maquina Windows.

Este registro substitui a recomendacao anterior de envio de 1.0.46 (13).
Referencia: https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring
