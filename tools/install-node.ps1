# ---------------------------------------------------------------------------
# install-node.ps1
# Makes sure Node.js is available so the tool can run, WITHOUT needing admin
# rights or a system-wide install. It:
#   1. uses Node already on the PATH if present;
#   2. otherwise uses a portable copy previously downloaded to the user folder;
#   3. otherwise downloads the latest LTS portable Node into the user folder.
# It is safe to run every time (it does nothing if Node is already available).
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

# 1. Already on PATH?
try {
  $onPath = (Get-Command node -ErrorAction Stop).Source
  if ($onPath) { Write-Host "Node.js found on PATH: $onPath"; exit 0 }
} catch {}

# 2. Portable copy already present?
$base = Join-Path $env:LOCALAPPDATA 'node-portable'
$existing = Get-ChildItem $base -Directory -Filter 'node-v*-win-*' -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -First 1
if ($existing -and (Test-Path (Join-Path $existing.FullName 'node.exe'))) {
  Write-Host "Using portable Node.js: $($existing.FullName)"; exit 0
}

# 3. Download a portable copy (needs internet, no admin rights).
$arch = 'x64'
if ($env:PROCESSOR_ARCHITECTURE -match 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -match 'ARM64') { $arch = 'arm64' }

Write-Host "Node.js not found - downloading a portable copy (LTS, win-$arch). This happens only once..."
$index = Invoke-WebRequest 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 60 |
  Select-Object -ExpandProperty Content | ConvertFrom-Json
$lts = $index | Where-Object { $_.lts -and ($_.files -contains "win-$arch-zip") } | Select-Object -First 1
if (-not $lts) { Write-Error "Could not find a suitable Node.js LTS build."; exit 1 }

$ver = $lts.version
$zipName = "node-$ver-win-$arch.zip"
$url = "https://nodejs.org/dist/$ver/$zipName"
New-Item -ItemType Directory -Force -Path $base | Out-Null
$zipPath = Join-Path $env:TEMP $zipName

Write-Host "Downloading $url ..."
Invoke-WebRequest $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
Write-Host "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $base -Force
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

$dir = Join-Path $base "node-$ver-win-$arch"
& (Join-Path $dir 'node.exe') --version | Out-Null
Write-Host "Installed portable Node.js $ver at $dir"
exit 0
