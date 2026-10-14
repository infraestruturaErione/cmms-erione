# APK de teste Erione CMMS - 2026-10-14

## Arquivo entregue

```text
C:\Users\Caio-Erione\Desktop\Projetos\APK  - iNSTRUÇÕES\Novos-Builds\APK\erione-cmms-prod-teste-v1.0.46-41-20261014-150956.apk
```

- Tamanho: 100028675 bytes (aproximadamente 100 MB / 95,4 MiB).
- SHA-256 do APK: BC6E2F35EA616CC8340791D229157A791950CF51BC86C9657943129D7F00444C.
- API incorporada: https://cmms.erione.com.br/api.
- Nome: Erione CMMS; applicationId: com.cmms.erione.
- versionName 1.0.46; versionCode 41; minSdk 24; target/compile SDK 36.
- ABIs: arm64-v8a, armeabi-v7a, x86 e x86_64.
- Release nao depuravel, com Hermes/JS incorporado; nao depende de Expo Go ou Metro no PC.
- Certificado de teste SHA-256: FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C.

Nao e um AAB nem uma publicacao Google Play. A assinatura e a mesma dos APKs internos anteriores, nao a chave de upload ou a chave de distribuicao do Google. Pode nao instalar por cima da versao da Play Store se o certificado for diferente. Nao desinstalar automaticamente: preservar e sincronizar dados locais primeiro.

## Fonte incorporada

Fonte unica: C:\Users\Caio-Erione\Desktop\Projetos\cmms-erione\mobile, incluindo working tree nao commitado. Base Git: 6e1f4924cdd53dd702a5edb4ad63b53339e68cb4. Staging novo e fisico: C:\gt\erione-apk-20261014-150956.

Nesta rodada, HomeScreen.tsx ganhou a data criadaAt existente no card comum da Home (em atendimento e proximas OS), usando getFormattedDate da empresa e a legenda Criada em. Nenhuma ordenacao, filtro ou rolagem foi alterada.

Inclui tambem as alteracoes locais anteriores de operador unico, leitura do acompanhante, aviso no questionario/card, modelos/slices e fluxo de conclusao. Os hashes de HomeScreen, WODetailsScreen, TasksScreen, WorkOrdersScreen, SingleTask, workOrderExecution, api e slice workOrder foram comparados entre fonte e staging antes da entrega.

Alteracao SOMENTE no staging: expo.modules.updates.ENABLED=false no AndroidManifest.xml, para nao receber bundle OTA antigo durante a homologacao. O arquivo nativo oficial, versoes, certificados de loja, package, iOS e Bitrise nao foram alterados. ENABLE_FIREBASE=false foi definido no processo; dependencias Firebase existentes continuam no binario, nao foi prometida remocao delas nem criado google-services.json falso.

## Build e validacoes

- Node 24.18.1; npm 10.9.3 selecionado via npx; instalacao limpa npm ci --include=dev --foreground-scripts.
- Patches aplicados: react-native-actions-sheet 0.8.29, react-native-image-viewing 0.2.2 e whatwg-url-without-unicode 8.0.0-3.
- TypeScript aprovado na fonte e staging; 32 testes selecionados de execucao/conclusao aprovados.
- JDK 17.0.20, Gradle 8.11.1, SDK 36, NDK 27.3.13750724 e CMake 3.22.1 existentes.
- Comando: gradlew.bat :app:assembleRelease --no-daemon -Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1536m" --max-workers=2.
- BUILD SUCCESSFUL, exit 0, 7m11s na rodada final; lintVitalAnalyzeRelease/lintVitalRelease incluidos, sem -x lint.
- aapt confirmou package, nome, versao, SDK, ABIs e ausencia de application-debuggable.
- apksigner confirmou assinatura APK v2 e certificado interno esperado.
- Bundle assets/index.android.bundle presente e em bytecode Hermes; URL de producao presente; API localhost:8080 e API LAN 192.168.*:8080 ausentes na verificacao dirigida.
- Manifest binario confirmou OTA desativada. Icone nativo e asset oficial foram inspecionados: Erione, nao Atlas.
- Hash do arquivo copiado coincide com o APK validado no staging ASCII.

Bloqueios de ambiente resolvidos: PowerShell 5.1 tratava warning de SDK como erro de shell; rodada final usou PowerShell 7.6.5 e conferiu o exit code real. Ninja encontrou caminho maior que 260 caracteres no cache Gradle longo. GRADLE_USER_HOME=C:\g reutilizou o cache curto; .cxx gerado nesta tarefa foi preservado em .cxx-long-path-backup antes da reconfiguracao. Nao foram apagados caches compartilhados, volumes ou dados.

Warnings de dependencias permanecem no log, incluindo deprecacoes Android, formato XML de SDK e D8/Play Services. A instalacao npm tambem reportou vulnerabilidades preexistentes; nenhum npm audit fix ou upgrade amplo foi aplicado. Build aprovado nao substitui teste real de login, OS, fotos, questionario e assinatura no aparelho.

Logs no staging: npm-ci.log, assemble-release.log (primeira tentativa), assemble-release-final.log (rodada aprovada). Scripts temporarios em tmp/ nao devem ser commitados.

## Producao

Consultar Atualizacao-Producao-Operador-Unico-2026-10-14.md para backup e comandos. Nenhum deploy, commit/push ou operacao de OS em producao foi executado nesta tarefa.

As mudancas de API/web ainda nao foram enviadas ao Git. Git pull sozinho nao recebe o working tree local. O fluxo novo de operador unico exige backend/migration correspondentes antes de ser homologado contra producao. Operacoes no APK apontado para producao geram dados reais; usar OS identificadas de homologacao.
