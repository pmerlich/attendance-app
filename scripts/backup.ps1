param(
  [string]$DatabaseName = "site-creator-d1",
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$targetDirectory = if ([IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $repoRoot $OutputDirectory }
New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputFile = Join-Path $targetDirectory ("menahel-avoda-d1-" + $timestamp + ".sql")

& npx wrangler d1 export $DatabaseName --remote --output $outputFile
if ($LASTEXITCODE -ne 0) { throw "D1 export failed with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $outputFile)) { throw "D1 export did not create $outputFile" }

$item = Get-Item -LiteralPath $outputFile
Write-Output ("Backup created: " + $item.FullName + " (" + $item.Length + " bytes)")