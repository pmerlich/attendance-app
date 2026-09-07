param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$DatabaseName = "DB",
  [switch]$Remote,
  [switch]$Confirm,
  [string]$PersistTo,
  [string]$ConfigPath = "dist/server/wrangler.json"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedBackup = if ([IO.Path]::IsPathRooted($BackupFile)) { $BackupFile } else { Join-Path $repoRoot $BackupFile }
if (-not (Test-Path -LiteralPath $resolvedBackup)) { throw "Backup file not found: $resolvedBackup" }
$item = Get-Item -LiteralPath $resolvedBackup
if ($item.Length -eq 0) { throw "Backup file is empty: $resolvedBackup" }

# This project has no committed wrangler.toml/json (see docs/codex-rules/AUDIT_REPORT_EN.md,
# Infrastructure as Code) - the D1 binding is only known via the config `npm run build`
# generates at dist/server/wrangler.json. --local execution cannot resolve the "DB" binding
# without it; run `npm run build` first if this file is missing.
$resolvedConfig = if ([IO.Path]::IsPathRooted($ConfigPath)) { $ConfigPath } else { Join-Path $repoRoot $ConfigPath }
if (-not (Test-Path -LiteralPath $resolvedConfig)) { throw "Wrangler config not found: $resolvedConfig - run 'npm run build' first (it generates this file)." }

# --Remote restores into the live production D1 database and OVERWRITES whatever is already
# there for any row the backup file touches. Default to --local (safe: talks only to the
# Miniflare emulator used by `npm run dev`, never Cloudflare) and require an explicit,
# separate -Confirm switch before ever touching --Remote - a single mistyped flag must not be
# enough to restore into production.
if ($Remote -and -not $Confirm) {
  throw "Refusing to restore into the REMOTE (production) database without -Confirm. This OVERWRITES live data for every row the backup file touches. Test with the default (-Local-style, i.e. omit -Remote) first, and only re-run with -Remote -Confirm once you are certain - ideally against a staging database, not the production one, for a first-time drill."
}

$targetArgs = @($DatabaseName, "--config", $resolvedConfig)
if ($Remote) { $targetArgs += "--remote" } else { $targetArgs += "--local" }
if ($PersistTo) { $targetArgs += @("--persist-to", $PersistTo) }
$targetArgs += @("--file", $resolvedBackup, "--yes")

Write-Output ("Restoring " + $resolvedBackup + " (" + $item.Length + " bytes) into '" + $DatabaseName + "' [" + $(if ($Remote) { "REMOTE - production" } else { "local" }) + "]...")

& npx wrangler d1 execute @targetArgs
if ($LASTEXITCODE -ne 0) { throw "D1 restore failed with exit code $LASTEXITCODE" }

Write-Output "Restore command completed. Spot-check row counts per table against the source backup before trusting this restore (see docs/OPERATIONS.md)."
