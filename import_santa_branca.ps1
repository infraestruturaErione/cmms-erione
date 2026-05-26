param(
    [switch]$Execute,
    [string]$ApiUrl = "http://localhost:8080",
    [string]$AuvoDir = "C:\Users\CaioSouza\Desktop\saida_auvo\saida_auvo"
)

$ErrorActionPreference = "Stop"

$Email = $env:IMPORT_EMAIL
$Password = $env:IMPORT_PASSWORD
$GroupId = 122529
$CustomerName = "PREFEITURA MUNICIPAL DE SANTA BRANCA"

if (-not $Email -or -not $Password) {
    Write-Host "ERROR: Set IMPORT_EMAIL and IMPORT_PASSWORD environment variables." -ForegroundColor Red
    exit 1
}

Write-Host "Loading Auvo data..." -ForegroundColor Cyan
$auvoCustomers = Get-Content (Join-Path $AuvoDir "customers.json") -Encoding UTF8 | ConvertFrom-Json
$auvoEquipments = Get-Content (Join-Path $AuvoDir "equipments.json") -Encoding UTF8 | ConvertFrom-Json

$santaCustomers = $auvoCustomers | Where-Object { $_.groupsId -eq $GroupId }
$santaCustomerIds = $santaCustomers | Select-Object -ExpandProperty id
$santaEquipments = $auvoEquipments | Where-Object { $_.associatedCustomerId -in $santaCustomerIds }

Write-Host "`n========================" -ForegroundColor Yellow
if ($Execute) { Write-Host "  EXECUTION MODE" -ForegroundColor Green }
else { Write-Host "  DRY RUN MODE (use -Execute to apply)" -ForegroundColor Yellow }
Write-Host "========================" -ForegroundColor Yellow

Write-Host "Target: $CustomerName (group $GroupId)" -ForegroundColor Cyan
Write-Host "Sites (customers): $($santaCustomers.Count)"
Write-Host "Assets (equipment): $($santaEquipments.Count)"

# Phase 1a: Customer
Write-Host "`n[1a] Customer to create:" -ForegroundColor Green
Write-Host "  Name: $CustomerName"
Write-Host "  Desc: Importado do Auvo - grupo $GroupId - $($santaCustomers.Count) locais"

# Phase 1b: Locations
Write-Host "`n[1b] Locations to create: $($santaCustomers.Count)" -ForegroundColor Green
$locList = @()
foreach ($site in $santaCustomers) {
    $siteName = if ($site.address -match '^ID \d+ - (.+)') { $matches[1].Trim() }
                elseif ($site.address -match '^ID \d+') { $site.address }
                else { $site.description + " - " + ($site.address -replace ',.*', '') }

    $fullAddress = if ($site.adressComplement) {
        "$($site.adressComplement), $($site.address)"
    } else { $site.address }

    $locList += [PSCustomObject]@{
        AuvoId = $site.id
        Name = $siteName.Substring(0, [Math]::Min($siteName.Length, 100))
        Address = $fullAddress.Substring(0, [Math]::Min($fullAddress.Length, 255))
        Lat = $site.latitude
        Lng = $site.longitude
        Desc = $site.description
    }
}
$locList | Format-Table Name, Lat, Lng -AutoSize

# Phase 1c: Assets
Write-Host "`n[1c] Assets to create: $($santaEquipments.Count)" -ForegroundColor Green
$astList = @()
foreach ($eq in $santaEquipments) {
    $parentSite = $santaCustomers | Where-Object { $_.id -eq $eq.associatedCustomerId }
    $parentName = if ($parentSite) { $parentSite.address.Substring(0, [Math]::Min($parentSite.address.Length, 60)) } else { "Unknown" }
    $astList += [PSCustomObject]@{
        AuvoId = $eq.id
        Name = $eq.name
        Identifier = $eq.identifier
        Description = $eq.description
        Parent = $parentName
    }
}
$astList | Format-Table Name, Identifier, Parent -AutoSize

Write-Host "`n=== Summary ===" -ForegroundColor Green
Write-Host "  1 Customer: $CustomerName"
Write-Host "  $($locList.Count) Locations"
Write-Host "  $($astList.Count) Assets"

if (-not $Execute) {
    Write-Host "`nDry-run complete. Re-run with -Execute to apply." -ForegroundColor Yellow
    Write-Host "  .\import_santa_branca.ps1 -Execute"
    exit 0
}

# === EXECUTE ===
Write-Host "`nExecuting import..." -ForegroundColor Green

# Auth
$authBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $authResponse = Invoke-RestMethod -Uri "$ApiUrl/auth/signin" -Method Post -Body $authBody -ContentType "application/json"
    $token = $authResponse.accessToken
    Write-Host "  Authenticated" -ForegroundColor Green
} catch {
    Write-Host "  Auth failed: $_" -ForegroundColor Red
    exit 1
}
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# Create Customer
Write-Host "`nCreating customer..." -ForegroundColor Cyan
$custPayload = @{ name = $CustomerName; description = "Importado do Auvo - grupo $GroupId - $($santaCustomers.Count) locais" }
try {
    $createdCustomer = Invoke-RestMethod -Uri "$ApiUrl/customers" -Method Post -Headers $headers -Body ($custPayload | ConvertTo-Json)
    $customerId = $createdCustomer.id
    Write-Host "  OK Customer ID $customerId" -ForegroundColor Green
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    exit 1
}

# Create Locations
$createdLocations = @()
$failedLocations = @()
Write-Host "`nCreating $($locList.Count) locations..." -ForegroundColor Cyan
foreach ($loc in $locList) {
    $locPayload = @{
        name = $loc.Name
        address = $loc.Address
        latitude = $loc.Lat
        longitude = $loc.Lng
        customers = @(@{ id = $customerId })
    }
    try {
        $createdLoc = Invoke-RestMethod -Uri "$ApiUrl/locations" -Method Post -Headers $headers -Body ($locPayload | ConvertTo-Json)
        $createdLocations += @{ AuvoId = $loc.AuvoId; ErioneId = $createdLoc.id; Name = $createdLoc.name }
        Write-Host "  [OK] $($createdLoc.name) (ID $($createdLoc.id))" -ForegroundColor Green
    } catch {
        $failedLocations += @{ AuvoId = $loc.AuvoId; Name = $loc.Name; Error = $_.Exception.Message }
        Write-Host "  [FAIL] $($loc.Name): $_" -ForegroundColor Red
    }
}

# Create Assets
$createdAssets = @()
$failedAssets = @()
Write-Host "`nCreating $($astList.Count) assets..." -ForegroundColor Cyan
foreach ($ast in $astList) {
    $locInfo = $createdLocations | Where-Object { $_.AuvoId -eq $ast.AuvoId }
    $assetPayload = @{
        name = $ast.Name
        description = $ast.Description
        customers = @(@{ id = $customerId })
    }
    if ($locInfo) {
        $assetPayload.location = @{ id = $locInfo.ErioneId }
    }
    try {
        $createdAsset = Invoke-RestMethod -Uri "$ApiUrl/assets" -Method Post -Headers $headers -Body ($assetPayload | ConvertTo-Json)
        $createdAssets += @{ AuvoId = $ast.AuvoId; ErioneId = $createdAsset.id; Name = $createdAsset.name }
        Write-Host "  [OK] $($createdAsset.name) (ID $($createdAsset.id))" -ForegroundColor Green
    } catch {
        $failedAssets += @{ AuvoId = $ast.AuvoId; Name = $ast.Name; Error = $_.Exception.Message }
        Write-Host "  [FAIL] $($ast.Name): $_" -ForegroundColor Red
    }
}

# Final report
Write-Host "`n=== IMPORT RESULT ===" -ForegroundColor Green
Write-Host "Customer: $CustomerName (ID $customerId)"
Write-Host "Locations: $($createdLocations.Count) created, $($failedLocations.Count) failed"
Write-Host "Assets: $($createdAssets.Count) created, $($failedAssets.Count) failed"

if ($failedLocations.Count -gt 0) { $failedLocations | Format-Table Name, Error -AutoSize }
if ($failedAssets.Count -gt 0) { $failedAssets | Format-Table Name, Error -AutoSize }

Write-Host "Done." -ForegroundColor Green

