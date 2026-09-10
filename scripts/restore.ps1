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

# `wrangler d1 export` (used by both `npm run backup` and the scheduled GitHub Actions backup)
# emits `CREATE TABLE <name> (...)` with neither `DROP TABLE` nor `IF NOT EXISTS`. Replaying it
# as-is against any database that already has the schema - which is every real target: a fresh
# `npm run dev` after first use, and always production - fails immediately with "table already
# exists" before a single row is restored. A restore is documented (see comment above and
# docs/OPERATIONS.md) as overwriting whatever the backup touches, so make that true: detect
# every table the backup defines and prepend an explicit `DROP TABLE IF EXISTS` for each one,
# ahead of the backup's own statements, into a temporary copy - the original backup file is
# never modified.
# `wrangler d1 export` writes plain UTF-8 with no BOM, and the backup routinely carries non-ASCII
# (Hebrew) text. Windows PowerShell's Get-Content/Set-Content -Encoding utf8 do not round-trip
# that safely: a BOM-less file read without an explicit encoding falls back to the system
# codepage, silently mangling every non-ASCII character, and utf8 on write adds a BOM. Use .NET's
# UTF8Encoding($false) (no BOM) directly on both ends so accented/Hebrew text survives untouched.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$backupContent = [IO.File]::ReadAllText($resolvedBackup, $utf8NoBom)
$tableMatches = [regex]::Matches($backupContent, 'CREATE TABLE\s+["''\[]?(\w+)["''\]]?\s*\(')
$tableNames = $tableMatches | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
if (-not $tableNames) { throw "No CREATE TABLE statements found in backup file - cannot determine which tables to replace: $resolvedBackup" }
Write-Output ("Backup defines " + $tableNames.Count + " table(s); each will be dropped and recreated from the backup: " + ($tableNames -join ", "))
$dropStatements = ($tableNames | ForEach-Object { 'DROP TABLE IF EXISTS "' + $_ + '";' }) -join "`n"
$preparedFile = Join-Path ([IO.Path]::GetTempPath()) ("restore-" + [Guid]::NewGuid().ToString("N") + ".sql")
[IO.File]::WriteAllText($preparedFile, ($dropStatements + "`n" + $backupContent), $utf8NoBom)

try {
  $targetArgs = @($DatabaseName, "--config", $resolvedConfig)
  if ($Remote) { $targetArgs += "--remote" } else { $targetArgs += "--local" }
  if ($PersistTo) { $targetArgs += @("--persist-to", $PersistTo) }
  $targetArgs += @("--file", $preparedFile, "--yes")

  Write-Output ("Restoring " + $resolvedBackup + " (" + $item.Length + " bytes) into '" + $DatabaseName + "' [" + $(if ($Remote) { "REMOTE - production" } else { "local" }) + "]...")

  & npx wrangler d1 execute @targetArgs
  if ($LASTEXITCODE -ne 0) { throw "D1 restore failed with exit code $LASTEXITCODE" }
} finally {
  Remove-Item -LiteralPath $preparedFile -Force -ErrorAction SilentlyContinue
}

Write-Output "Restore command completed. Spot-check row counts per table against the source backup before trusting this restore (see docs/OPERATIONS.md)."
