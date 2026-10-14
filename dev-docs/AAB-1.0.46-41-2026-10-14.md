# AAB Google Play - Erione CMMS 1.0.46 (41)

Artefato final validado e copiado, sem envio automatico a loja:

`C:\Users\Caio-Erione\Desktop\Projetos\APK  - iNSTRUÇÕES\Novos-Builds\AAB\erione-cmms-play-v1.0.46-41-20261014.aab`

- Package: com.cmms.erione.
- VersionName: 1.0.46; versionCode: 41; min SDK: 24; target SDK: 36.
- Ultimo codigo informado pelo usuario no Play: 40 / 1.0.45.
- API embutida: https://cmms.erione.com.br/api.
- Tamanho: 51707149 bytes.
- SHA-256 do arquivo: 663D4064EFFAD66AAB55DCFCA6F95F9AC45FCB8BA0960DA0FF15F795BCD5D59F.
- Certificado de UPLOAD SHA-256:
  0F:76:3B:CA:2A:66:CF:53:AD:56:AE:00:A2:F0:DD:DF:7B:04:5D:95:B5:59:6C:54:EF:4B:80:E7:71:1A:6E:F1.
- Certificado de UPLOAD SHA-1:
  9E:BE:11:58:FC:C5:59:3F:9C:BC:25:18:64:43:25:5E:24:23:9F:E3.
- Keystore atual documentada, alias erione-cmms-upload; nenhuma nova chave criada.
- Senha usada exclusivamente em memoria, ambiente do processo limpo ao terminar.
- Google Play App Signing nao foi alterado. Nao e o certificado debug do APK.

## Origem e verificacoes

Fonte mobile do working tree atual baseada no commit 40db5ee, mais os ajustes
locais descritos em Preparacao-Apple-Android-1.0.46-2026-10-14.md. Nenhum commit
novo ou push dos ajustes de preparacao foi feito nesta rodada.

Staging fisico novo: C:\gt\erione-apk-20261014-175308.
Sem expo prebuild, EAS, arquivo Firebase falso ou uso de fontes antigas.
ENABLE_FIREBASE=false; dependencias nativas Firebase Android ainda presentes
como no projeto existente, portanto nao afirmar ausencia total no Android.
OTA Android habilitado como na fonte oficial, runtime nativo alinhado a 1.0.46.

Java 17.0.20+8, Node 24.18.1, npm 10.9.3, Gradle 8.11.1, SDK 36.
`npm ci --include=dev --foreground-scripts`, patches, TypeScript e 34 testes
de execucao/conclusao aprovados. `:app:bundleRelease` e lintVitalRelease passaram.
Uma primeira tentativa revelou import incorreto no autolinking; a configuracao
final preserva o import Android original da biblioteca e exclui somente iOS.
Recompilacao final aprovada com essa configuracao.

Bundletool oficial 1.17.2: validate e dump manifest aprovados.
jarsigner -verify aprovado; keytool -printcert -jarfile confirma a upload key.
Manifest nao depuravel; bundle Hermes embutido; API de producao presente;
URLs localhost:8080 e LAN 192.168.*:8080 ausentes na verificacao dirigida.
Arquivos essenciais comparados por hash com a fonte; copia final com hash identico.

## Publicacao manual

Enviar este arquivo a uma faixa de teste interno no Play Console primeiro.
Confirmar que 41 nao foi usado em rascunhos ou outras faixas. Homologar login,
OS com um tecnico e varios, relato longo, fotos, assinatura e conclusao.
A API de producao tambem precisa conter o commit 40db5ee para o fluxo completo.
Somente depois promover a producao. Validacao local nao prova aceite da loja.

## Apple

Fonte Apple preparada posteriormente: 1.0.46 (13), workspace/scheme AtlasCMMS,
API de producao. Usuario confirmou build 12 ja enviado; Android/AAB inalterados.
Bundle iOS e exclusao Firebase validados localmente. CocoaPods, Xcode e IPA
dependem do macOS/Bitrise. Usuario autorizou commit/push dos ajustes de
preparacao. Confirmar sucesso do push antes de iniciar o workflow.
Nenhum envio automatico.
