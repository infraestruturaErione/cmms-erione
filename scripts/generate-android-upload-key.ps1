param(
    [string]$OutputDirectory = 'C:\Users\Caio-Erione\Documents\Erione-CMMS-GooglePlay',
    [string]$Keytool = 'C:\Users\Caio-Erione\AppData\Local\Temp\erione-android-toolchain\jdk\jdk-17.0.20+8\bin\keytool.exe'
)

$ErrorActionPreference = 'Stop'

$alias = 'erione-cmms-upload'
$keystorePath = Join-Path $OutputDirectory 'erione-cmms-upload-key.jks'
$certificatePath = Join-Path $OutputDirectory 'erione-cmms-upload-certificate.pem'
$instructionsPath = Join-Path $OutputDirectory 'INSTRUCOES-CHAVE-UPLOAD.md'
$resultPath = Join-Path $OutputDirectory 'generation-result.txt'
$backupDirectory = Join-Path $OutputDirectory ('backup-local\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Get-Fingerprint {
    param(
        [string]$Text,
        [string]$Algorithm
    )

    $match = [regex]::Match($Text, "(?m)^\s*${Algorithm}:\s*(.+)$")
    if (-not $match.Success) {
        throw "Fingerprint $Algorithm nao encontrado na saida do keytool."
    }
    return $match.Groups[1].Value.Trim()
}

if (-not (Test-Path -LiteralPath $Keytool)) {
    throw "keytool nao encontrado em: $Keytool"
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
if ((Test-Path -LiteralPath $keystorePath) -or (Test-Path -LiteralPath $certificatePath)) {
    throw 'A keystore ou o certificado de destino ja existe. Nenhum arquivo foi sobrescrito.'
}

Write-Host ''
Write-Host 'Geracao da nova upload key do Erione CMMS' -ForegroundColor Cyan
Write-Host 'As senhas serao solicitadas pelo keytool e permanecerao mascaradas.'
Write-Host 'Use uma senha forte e guarde-a em um gerenciador de senhas separado.' -ForegroundColor Yellow
Write-Host ''

& $Keytool `
    -genkeypair `
    -keystore $keystorePath `
    -storetype JKS `
    -alias $alias `
    -keyalg RSA `
    -keysize 4096 `
    -validity 9125 `
    -dname 'CN=Erione CMMS Upload, OU=Mobile, O=Erione, L=Sao Paulo, ST=Sao Paulo, C=BR'
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao gerar a upload key. Codigo: $LASTEXITCODE"
}

Write-Host ''
Write-Host 'Digite novamente a senha da keystore para exportar o certificado publico.' -ForegroundColor Cyan
& $Keytool `
    -exportcert `
    -rfc `
    -keystore $keystorePath `
    -alias $alias `
    -file $certificatePath
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao exportar o certificado. Codigo: $LASTEXITCODE"
}

Write-Host ''
Write-Host 'Digite novamente a senha da keystore para validar os fingerprints.' -ForegroundColor Cyan
$keystoreOutput = & $Keytool -list -v -keystore $keystorePath -alias $alias
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao ler a keystore. Codigo: $LASTEXITCODE"
}
$certificateOutput = & $Keytool -printcert -file $certificatePath
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao ler o certificado PEM. Codigo: $LASTEXITCODE"
}

$keystoreText = $keystoreOutput -join [Environment]::NewLine
$certificateText = $certificateOutput -join [Environment]::NewLine
$keystoreSha1 = Get-Fingerprint -Text $keystoreText -Algorithm 'SHA1'
$keystoreSha256 = Get-Fingerprint -Text $keystoreText -Algorithm 'SHA256'
$certificateSha1 = Get-Fingerprint -Text $certificateText -Algorithm 'SHA1'
$certificateSha256 = Get-Fingerprint -Text $certificateText -Algorithm 'SHA256'

if ($keystoreSha1 -ne $certificateSha1 -or $keystoreSha256 -ne $certificateSha256) {
    throw 'O certificado PEM nao corresponde a keystore gerada.'
}

New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
Copy-Item -LiteralPath $keystorePath -Destination (Join-Path $backupDirectory (Split-Path $keystorePath -Leaf))
Copy-Item -LiteralPath $certificatePath -Destination (Join-Path $backupDirectory (Split-Path $certificatePath -Leaf))

$instructions = @"
# Nova upload key - Erione CMMS

Gerada em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Arquivos

- Keystore: $keystorePath
- Certificado publico: $certificatePath
- Alias: $alias
- Algoritmo: RSA 4096 bits
- Validade: 9125 dias
- SHA-1: $keystoreSha1
- SHA-256: $keystoreSha256

## Backup local

- $backupDirectory

Copie a keystore, o certificado e este arquivo de instrucoes para um backup externo criptografado. Guarde as senhas exclusivamente em um gerenciador de senhas. Nunca coloque a keystore, o PEM ou propriedades de assinatura no Git.

## Validacao publica do certificado

    & '$Keytool' -printcert -file '$certificatePath'

## Redefinicao no Google Play Console

1. Abra Erione CMMS no Google Play Console.
2. Acesse Testar e lancar > Configuracao > Integridade do app > Assinatura de apps.
3. Na secao Certificado da chave de upload, selecione Solicitar redefinicao da chave de upload.
4. Envie somente o arquivo $certificatePath.
5. Aguarde a aprovacao e a data de ativacao informada pelo Google.
6. Nao gere nem envie um novo AAB com esta chave antes da aprovacao.

A chave de assinatura do aplicativo mantida pelo Google Play nao deve ser alterada nem atualizada.
"@
[IO.File]::WriteAllText($instructionsPath, $instructions, [Text.UTF8Encoding]::new($false))

$result = @"
KEYSTORE=$keystorePath
CERTIFICATE=$certificatePath
ALIAS=$alias
SHA1=$keystoreSha1
SHA256=$keystoreSha256
BACKUP=$backupDirectory
INSTRUCTIONS=$instructionsPath
"@
[IO.File]::WriteAllText($resultPath, $result, [Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'Upload key criada e validada com sucesso.' -ForegroundColor Green
Write-Host "SHA-1:   $keystoreSha1"
Write-Host "SHA-256: $keystoreSha256"
Write-Host ''
Read-Host 'Pressione Enter para fechar esta janela'
