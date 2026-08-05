<#
.SYNOPSIS
    Popula o ambiente LOCAL com Clientes (cidades), Locais e Ativos realistas.

.DESCRIPTION
    Cria massa de dados via API REST (nao via SQL direto), para que tudo passe pelas
    mesmas validacoes, permissoes, customId e auditoria que o app usa de verdade.

    Modelo seguido (conforme dev-docs / vault):
        Customer = cliente / cidade / contratante
        Location = local fisico dentro desse cliente
        Asset    = camera / equipamento instalado no local

    Idempotente: registros ja existentes (mesmo nome) sao pulados.

.PARAMETER BaseUrl
    URL da API. Padrao: http://localhost:8080

.PARAMETER Email
    Login do admin.

.PARAMETER Password
    Senha do admin.

.PARAMETER IncludeEdgeCases
    Cria tambem registros de borda (ativo sem local, ativo de um cliente dentro de
    local de outro) usados para exercitar as validacoes de customer scope.

.EXAMPLE
    .\scripts\seed-dev-data.ps1

.EXAMPLE
    .\scripts\seed-dev-data.ps1 -IncludeEdgeCases
#>

[CmdletBinding()]
param(
    [string] $BaseUrl  = 'http://localhost:8080',
    [string] $Email    = 'caio.souza@erione.com.br',
    [string] $Password = '783513',
    [switch] $IncludeEdgeCases
)

$ErrorActionPreference = 'Stop'
$script:Token = $null

$script:Stats = [ordered]@{
    CustomersCreated = 0
    CustomersSkipped = 0
    LocationsCreated = 0
    LocationsSkipped = 0
    AssetsCreated    = 0
    AssetsSkipped    = 0
    Errors           = 0
}

function Write-Step  { param([string] $Message) Write-Host "`n=== $Message ===" -ForegroundColor Cyan }
function Write-Ok    { param([string] $Message) Write-Host "  [ok]   $Message" -ForegroundColor Green }
function Write-Skip  { param([string] $Message) Write-Host "  [skip] $Message" -ForegroundColor DarkGray }
function Write-Fail  { param([string] $Message) Write-Host "  [ERRO] $Message" -ForegroundColor Red }

function Invoke-Api {
    param(
        [Parameter(Mandatory)] [ValidateSet('GET', 'POST', 'PATCH', 'DELETE')] [string] $Method,
        [Parameter(Mandatory)] [string] $Path,
        [object] $Body
    )

    $uri = "$BaseUrl/$($Path.TrimStart('/'))"
    $headers = @{}
    if ($script:Token) { $headers['Authorization'] = "Bearer $script:Token" }

    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $headers
        ContentType = 'application/json; charset=utf-8'
    }

    if ($null -ne $Body) {
        # UTF-8 explicito: sem isso o PS 5.1 corrompe acentos no corpo da requisicao.
        $json = $Body | ConvertTo-Json -Depth 10 -Compress
        $params['Body'] = [System.Text.Encoding]::UTF8.GetBytes($json)
    }

    Invoke-RestMethod @params
}

function Get-ApiList {
    # Invoke-RestMethod devolve $null (nao array vazio) quando a API responde `[]`.
    # Sem o filtro, @($null) vira um array de 1 elemento nulo e quebra o codigo adiante.
    param([Parameter(Mandatory)] [string] $Path)
    $result = Invoke-Api -Method GET -Path $Path
    return @($result | Where-Object { $null -ne $_ })
}

function Get-ApiErrorMessage {
    param([System.Management.Automation.ErrorRecord] $ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) { return $ErrorRecord.Exception.Message }

    try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        $reader.Close()
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return "HTTP $([int]$response.StatusCode)"
        }
        return "HTTP $([int]$response.StatusCode) - $raw"
    } catch {
        return $ErrorRecord.Exception.Message
    }
}

function Connect-Api {
    Write-Step 'Autenticando'
    $body = @{ email = $Email; type = 'client'; password = $Password }
    try {
        $response = Invoke-Api -Method POST -Path 'auth/signin' -Body $body
        $script:Token = $response.accessToken
        Write-Ok "Autenticado como $Email"
    } catch {
        throw "Falha no login: $(Get-ApiErrorMessage $_)"
    }
}

# ---------------------------------------------------------------------------
# Massa de dados
# ---------------------------------------------------------------------------

$Seed = @(
    @{
        Customer = @{
            name         = 'Prefeitura de Santa Branca'
            customerType = 'Prefeitura'
            description  = 'Contrato de monitoramento e manutencao de CFTV municipal'
            address      = 'Praca Ajudante Franca, 20 - Centro, Santa Branca - SP'
            phone        = '+55 12 3972-0500'
            email        = 'contato@santabranca.sp.gov.br'
            website      = 'https://www.santabranca.sp.gov.br'
            rate         = 180
            billingName  = 'Municipio de Santa Branca'
        }
        Locations = @(
            @{
                name = 'Paco Municipal'; address = 'Praca Ajudante Franca, 20 - Centro, Santa Branca - SP'
                latitude = -23.3969; longitude = -45.8853
                Assets = @(
                    @{ name = 'Camera Dome Entrada Principal'; model = 'VIP 3230 D'; manufacturer = 'Intelbras'; serialNumber = 'SB-PM-CAM-0001'; area = 'Recepcao'; status = 'OPERATIONAL'; description = 'Camera dome IP 2MP com infravermelho' }
                    @{ name = 'Camera Bullet Estacionamento'; model = 'VIP 3240 B'; manufacturer = 'Intelbras'; serialNumber = 'SB-PM-CAM-0002'; area = 'Estacionamento'; status = 'OPERATIONAL'; description = 'Camera bullet IP 2MP externa' }
                    @{ name = 'DVR Sala de Monitoramento'; model = 'MHDX 3116'; manufacturer = 'Intelbras'; serialNumber = 'SB-PM-DVR-0001'; area = 'Sala tecnica'; status = 'OPERATIONAL'; description = 'Gravador 16 canais com HD 4TB' }
                    @{ name = 'Nobreak Rack Principal'; model = 'SMS Net4+ 1500VA'; manufacturer = 'SMS'; serialNumber = 'SB-PM-NBK-0001'; area = 'Sala tecnica'; status = 'STANDBY'; description = 'Nobreak senoidal para rack de CFTV' }
                )
            }
            @{
                name = 'Escola Municipal Prof. Joao Alves'; address = 'Rua Sete de Setembro, 145 - Centro, Santa Branca - SP'
                latitude = -23.3982; longitude = -45.8871
                Assets = @(
                    @{ name = 'Camera Patio Coberto'; model = 'VIP 1230 D'; manufacturer = 'Intelbras'; serialNumber = 'SB-EM-CAM-0001'; area = 'Patio'; status = 'OPERATIONAL'; description = 'Camera dome sobre o patio coberto' }
                    @{ name = 'Camera Portao de Entrada'; model = 'VIP 1230 B'; manufacturer = 'Intelbras'; serialNumber = 'SB-EM-CAM-0002'; area = 'Entrada'; status = 'DOWN'; description = 'Camera sem imagem desde a ultima chuva forte' }
                    @{ name = 'Switch PoE 8 portas'; model = 'SF 900 PoE'; manufacturer = 'Intelbras'; serialNumber = 'SB-EM-SWT-0001'; area = 'Secretaria'; status = 'OPERATIONAL'; description = 'Switch PoE que alimenta as cameras da escola' }
                )
            }
            @{
                name = 'Praca da Matriz'; address = 'Praca Barao do Rio Branco - Centro, Santa Branca - SP'
                latitude = -23.3975; longitude = -45.8840
                Assets = @(
                    @{ name = 'Camera Speed Dome Praca'; model = 'VIP 5232 SD'; manufacturer = 'Intelbras'; serialNumber = 'SB-PR-CAM-0001'; area = 'Poste central'; status = 'OPERATIONAL'; description = 'Speed dome PTZ 32x em poste de 8m' }
                    @{ name = 'Caixa Hermetica Poste 1'; model = 'CH-3020'; manufacturer = 'Generico'; serialNumber = 'SB-PR-CXH-0001'; area = 'Poste central'; status = 'OPERATIONAL'; description = 'Caixa de protecao para fonte e conversor de midia' }
                )
            }
        )
    }
    @{
        Customer = @{
            name         = 'Prefeitura de Paraibuna'
            customerType = 'Prefeitura'
            description  = 'Manutencao preventiva e corretiva de cameras urbanas'
            address      = 'Praca Sao Sebastiao, 20 - Centro, Paraibuna - SP'
            phone        = '+55 12 3974-1000'
            email        = 'gabinete@paraibuna.sp.gov.br'
            website      = 'https://www.paraibuna.sp.gov.br'
            rate         = 165
            billingName  = 'Municipio de Paraibuna'
        }
        Locations = @(
            @{
                name = 'Paco Municipal de Paraibuna'; address = 'Praca Sao Sebastiao, 20 - Centro, Paraibuna - SP'
                latitude = -23.3861; longitude = -45.6622
                Assets = @(
                    @{ name = 'Camera Recepcao'; model = 'VHD 1220 D'; manufacturer = 'Intelbras'; serialNumber = 'PB-PM-CAM-0001'; area = 'Recepcao'; status = 'OPERATIONAL'; description = 'Camera dome HD interna' }
                    @{ name = 'DVR Prefeitura'; model = 'MHDX 1108'; manufacturer = 'Intelbras'; serialNumber = 'PB-PM-DVR-0001'; area = 'Sala tecnica'; status = 'OPERATIONAL'; description = 'Gravador 8 canais' }
                )
            }
            @{
                name = 'UBS Centro'; address = 'Rua Coronel Domingues, 300 - Centro, Paraibuna - SP'
                latitude = -23.3874; longitude = -45.6640
                Assets = @(
                    @{ name = 'Camera Sala de Espera'; model = 'VHD 3230 D'; manufacturer = 'Intelbras'; serialNumber = 'PB-UBS-CAM-0001'; area = 'Sala de espera'; status = 'OPERATIONAL'; description = 'Camera dome sobre a recepcao da UBS' }
                    @{ name = 'Camera Corredor Consultorios'; model = 'VHD 3230 D'; manufacturer = 'Intelbras'; serialNumber = 'PB-UBS-CAM-0002'; area = 'Corredor'; status = 'INSPECTION_SCHEDULED'; description = 'Camera com foco desregulado, inspecao agendada' }
                )
            }
            @{
                name = 'Garagem Municipal'; address = 'Av. dos Expedicionarios, 1200 - Vila Nova, Paraibuna - SP'
                latitude = -23.3902; longitude = -45.6685
                Assets = @(
                    @{ name = 'Camera Portao Veiculos'; model = 'VIP 3240 B'; manufacturer = 'Intelbras'; serialNumber = 'PB-GAR-CAM-0001'; area = 'Portao'; status = 'OPERATIONAL'; description = 'Camera bullet com leitura de placa' }
                    @{ name = 'Nobreak Garagem'; model = 'SMS Station II 1200VA'; manufacturer = 'SMS'; serialNumber = 'PB-GAR-NBK-0001'; area = 'Sala tecnica'; status = 'DOWN'; description = 'Nobreak com bateria vencida' }
                )
            }
        )
    }
    @{
        Customer = @{
            name         = 'Prefeitura de Jacarei'
            customerType = 'Prefeitura'
            description  = 'Contrato guarda-chuva de videomonitoramento urbano'
            address      = 'Praca dos Tres Poderes, 74 - Centro, Jacarei - SP'
            phone        = '+55 12 3955-9000'
            email        = 'ouvidoria@jacarei.sp.gov.br'
            website      = 'https://www.jacarei.sp.gov.br'
            rate         = 210
            billingName  = 'Municipio de Jacarei'
        }
        Locations = @(
            @{
                name = 'Centro de Controle Operacional'; address = 'Av. Major Acacio Ferreira, 854 - Jacarei - SP'
                latitude = -23.3053; longitude = -45.9658
                Assets = @(
                    @{ name = 'Videowall CCO'; model = 'VW-55-4x2'; manufacturer = 'Samsung'; serialNumber = 'JC-CCO-VDW-0001'; area = 'Sala de operacao'; status = 'OPERATIONAL'; description = 'Videowall 4x2 do centro de controle' }
                    @{ name = 'Servidor de Gravacao 01'; model = 'PowerEdge R450'; manufacturer = 'Dell'; serialNumber = 'JC-CCO-SRV-0001'; area = 'Data center'; status = 'OPERATIONAL'; description = 'Servidor de VMS com 64TB' }
                    @{ name = 'Servidor de Gravacao 02'; model = 'PowerEdge R450'; manufacturer = 'Dell'; serialNumber = 'JC-CCO-SRV-0002'; area = 'Data center'; status = 'MODERNIZATION'; description = 'Servidor em processo de upgrade de storage' }
                )
            }
            @{
                name = 'Terminal Rodoviario'; address = 'Av. Getulio Vargas, 100 - Centro, Jacarei - SP'
                latitude = -23.3040; longitude = -45.9671
                Assets = @(
                    @{ name = 'Camera Plataforma 1'; model = 'DS-2CD2143G2'; manufacturer = 'Hikvision'; serialNumber = 'JC-TRM-CAM-0001'; area = 'Plataforma'; status = 'OPERATIONAL'; description = 'Camera dome 4MP' }
                    @{ name = 'Camera Plataforma 2'; model = 'DS-2CD2143G2'; manufacturer = 'Hikvision'; serialNumber = 'JC-TRM-CAM-0002'; area = 'Plataforma'; status = 'OPERATIONAL'; description = 'Camera dome 4MP' }
                    @{ name = 'Camera Bilheteria'; model = 'DS-2CD1343G0'; manufacturer = 'Hikvision'; serialNumber = 'JC-TRM-CAM-0003'; area = 'Bilheteria'; status = 'EMERGENCY_SHUTDOWN'; description = 'Desligada apos surto eletrico' }
                    @{ name = 'Switch PoE Terminal'; model = 'DGS-1210-28P'; manufacturer = 'D-Link'; serialNumber = 'JC-TRM-SWT-0001'; area = 'Rack'; status = 'OPERATIONAL'; description = 'Switch 24 portas PoE+' }
                )
            }
        )
    }
)

# ---------------------------------------------------------------------------
# Execucao
# ---------------------------------------------------------------------------

Connect-Api

Write-Step 'Lendo cadastro existente'
$existingCustomers = Get-ApiList -Path 'customers/mini'
$existingLocations = Get-ApiList -Path 'locations/mini'
$existingAssets    = Get-ApiList -Path 'assets/mini'
Write-Host "  clientes=$($existingCustomers.Count) locais=$($existingLocations.Count) ativos=$($existingAssets.Count)"

$customerIdByName = @{}
foreach ($c in $existingCustomers) { $customerIdByName[$c.name] = $c.id }
$locationIdByName = @{}
foreach ($l in $existingLocations) { $locationIdByName[$l.name] = $l.id }
$assetNames = @{}
foreach ($a in $existingAssets) { $assetNames[$a.name] = $a.id }

foreach ($entry in $Seed) {
    $customerData = $entry.Customer
    $customerName = $customerData.name

    Write-Step "Cliente: $customerName"

    if ($customerIdByName.ContainsKey($customerName)) {
        Write-Skip "cliente ja existe (id $($customerIdByName[$customerName]))"
        $customerId = $customerIdByName[$customerName]
        $script:Stats.CustomersSkipped++
    } else {
        try {
            $created = Invoke-Api -Method POST -Path 'customers' -Body $customerData
            $customerId = $created.id
            $customerIdByName[$customerName] = $customerId
            Write-Ok "cliente criado (id $customerId)"
            $script:Stats.CustomersCreated++
        } catch {
            Write-Fail "cliente '$customerName': $(Get-ApiErrorMessage $_)"
            $script:Stats.Errors++
            continue
        }
    }

    foreach ($locationData in $entry.Locations) {
        $locationName = $locationData.name

        if ($locationIdByName.ContainsKey($locationName)) {
            Write-Skip "local '$locationName' ja existe (id $($locationIdByName[$locationName]))"
            $locationId = $locationIdByName[$locationName]
            $script:Stats.LocationsSkipped++
        } else {
            $locationBody = @{
                name      = $locationName
                address   = $locationData.address
                latitude  = $locationData.latitude
                longitude = $locationData.longitude
                customers = @(@{ id = $customerId })
            }
            try {
                $createdLocation = Invoke-Api -Method POST -Path 'locations' -Body $locationBody
                $locationId = $createdLocation.id
                $locationIdByName[$locationName] = $locationId
                Write-Ok "local '$locationName' criado (id $locationId)"
                $script:Stats.LocationsCreated++
            } catch {
                Write-Fail "local '$locationName': $(Get-ApiErrorMessage $_)"
                $script:Stats.Errors++
                continue
            }
        }

        foreach ($assetData in $locationData.Assets) {
            $assetName = $assetData.name

            if ($assetNames.ContainsKey($assetName)) {
                Write-Skip "ativo '$assetName' ja existe"
                $script:Stats.AssetsSkipped++
                continue
            }

            $assetBody = @{
                name         = $assetName
                description  = $assetData.description
                model        = $assetData.model
                manufacturer = $assetData.manufacturer
                serialNumber = $assetData.serialNumber
                barCode      = $assetData.serialNumber
                area         = $assetData.area
                status       = $assetData.status
                location     = @{ id = $locationId }
                customers    = @(@{ id = $customerId })
            }
            try {
                $createdAsset = Invoke-Api -Method POST -Path 'assets' -Body $assetBody
                $assetNames[$assetName] = $createdAsset.id
                Write-Ok "ativo '$assetName' criado (id $($createdAsset.id))"
                $script:Stats.AssetsCreated++
            } catch {
                Write-Fail "ativo '$assetName': $(Get-ApiErrorMessage $_)"
                $script:Stats.Errors++
            }
        }
    }
}

if ($IncludeEdgeCases) {
    Write-Step 'Casos de borda (para exercitar customer scope e validacoes)'

    $santaBrancaId = $customerIdByName['Prefeitura de Santa Branca']
    $paraibunaId   = $customerIdByName['Prefeitura de Paraibuna']

    # 1) Ativo de estoque: vinculado ao cliente, mas SEM local.
    #    Serve para checar o comportamento quando a OS tem local escolhido e o ativo nao tem local.
    $stockAsset = 'Camera Reserva (estoque, sem local)'
    if (-not $assetNames.ContainsKey($stockAsset) -and $santaBrancaId) {
        try {
            $body = @{
                name         = $stockAsset
                description  = 'Ativo de reserva no almoxarifado, ainda nao instalado'
                model        = 'VIP 3230 D'
                manufacturer = 'Intelbras'
                serialNumber = 'SB-EST-CAM-9001'
                status       = 'STANDBY'
                customers    = @(@{ id = $santaBrancaId })
            }
            $created = Invoke-Api -Method POST -Path 'assets' -Body $body
            Write-Ok "ativo sem local criado (id $($created.id))"
            $script:Stats.AssetsCreated++
        } catch {
            Write-Fail "ativo sem local: $(Get-ApiErrorMessage $_)"
            $script:Stats.Errors++
        }
    } else {
        Write-Skip 'ativo sem local ja existe'
    }

    # 2) Local compartilhado por dois clientes (acontece em contrato consorciado).
    $sharedLocation = 'Central de Videomonitoramento Consorciada'
    if (-not $locationIdByName.ContainsKey($sharedLocation) -and $santaBrancaId -and $paraibunaId) {
        try {
            $body = @{
                name      = $sharedLocation
                address   = 'Rod. dos Tamoios, km 40 - Divisa Santa Branca / Paraibuna - SP'
                latitude  = -23.3915
                longitude = -45.7730
                customers = @(@{ id = $santaBrancaId }, @{ id = $paraibunaId })
            }
            $created = Invoke-Api -Method POST -Path 'locations' -Body $body
            $locationIdByName[$sharedLocation] = $created.id
            Write-Ok "local compartilhado criado (id $($created.id))"
            $script:Stats.LocationsCreated++
        } catch {
            Write-Fail "local compartilhado: $(Get-ApiErrorMessage $_)"
            $script:Stats.Errors++
        }
    } else {
        Write-Skip 'local compartilhado ja existe'
    }
}

Write-Step 'Resumo'
foreach ($key in $script:Stats.Keys) {
    Write-Host ("  {0,-18} {1}" -f $key, $script:Stats[$key])
}

$finalCustomers = Get-ApiList -Path 'customers/mini'
$finalLocations = Get-ApiList -Path 'locations/mini'
$finalAssets    = Get-ApiList -Path 'assets/mini'
Write-Host "`n  Total na base: clientes=$($finalCustomers.Count) locais=$($finalLocations.Count) ativos=$($finalAssets.Count)" -ForegroundColor Yellow

if ($script:Stats.Errors -gt 0) {
    Write-Host "`nConcluido com $($script:Stats.Errors) erro(s). Veja as linhas [ERRO] acima." -ForegroundColor Red
    exit 1
}
Write-Host "`nConcluido sem erros." -ForegroundColor Green
