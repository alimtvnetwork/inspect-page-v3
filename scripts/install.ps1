# Inspect Page — Chrome extension installer (PowerShell).
#
# Behavior mirrors install.sh:
#   - URL-pinned when fetched from a release asset URL
#   - Latest from main otherwise (resolved via GitHub API)
#
# Usage:
#   iwr https://github.com/alimtvnetwork/inspect-page/releases/download/ext-v2.7.7/install.ps1 -UseBasicParsing | iex
#   iwr https://raw.githubusercontent.com/alimtvnetwork/inspect-page/main/scripts/install.ps1 -UseBasicParsing | iex
#
# Env overrides:
#   $env:IP_REPO     = 'owner/repo'   (default: alimtvnetwork/inspect-page)
#   $env:IP_VERSION  = 'ext-v2.7.7'   (force a specific tag)
#   $env:IP_DEST     = 'C:\path'      (default: %USERPROFILE%\inspect-page)

$ErrorActionPreference = 'Stop'

function Write-Log($msg)  { Write-Host "[inspect-page] $msg" -ForegroundColor Cyan }
function Write-Fail($msg) { Write-Host "[inspect-page] $msg" -ForegroundColor Red; exit 1 }

$Repo    = if ($env:IP_REPO)    { $env:IP_REPO }    else { '' }
$Dest    = if ($env:IP_DEST)    { $env:IP_DEST }    else { Join-Path $env:USERPROFILE 'inspect-page' }
$Version = if ($env:IP_VERSION) { $env:IP_VERSION } else { '' }

# 1. Self-URL inspection. When run via `iwr ... | iex`, the source URL is
#    available in $MyInvocation.MyCommand.Definition (PowerShell stores the
#    fetched script text plus, in some hosts, the source URL via PSCommandPath).
#    As a backstep, scan the parent command line for the URL.
$selfUrl = ''
try { $selfUrl = $PSCommandPath } catch {}
if (-not $selfUrl) {
    try {
        $ppid = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
        $selfUrl = (Get-CimInstance Win32_Process -Filter "ProcessId=$ppid").CommandLine
    } catch {}
}
if ($selfUrl -match 'github\.com/([\w.-]+/[\w.-]+)/releases/download/(ext-v[\d\w\.\+-]+)/install\.ps1') {
    if (-not $Repo)    { $Repo    = $Matches[1] }
    if (-not $Version) { $Version = $Matches[2] }
    Write-Log "URL-pinned: repo=$Repo version=$Version"
} elseif ($selfUrl -match 'raw\.githubusercontent\.com/([\w.-]+/[\w.-]+)/[^/]+/scripts/install\.ps1') {
    if (-not $Repo) { $Repo = $Matches[1] }
    Write-Log "Latest channel: repo=$Repo"
}

if (-not $Repo) { Write-Fail "Cannot determine repository. Set `$env:IP_REPO='owner/repo'." }

if (-not $Version) {
    Write-Log "Resolving latest ext-v* release from GitHub API…"
    $api = "https://api.github.com/repos/$Repo/releases"
    $releases = Invoke-RestMethod -Uri $api -UseBasicParsing -Headers @{ 'User-Agent' = 'inspect-page-installer' }
    $latest = $releases | Where-Object { $_.tag_name -like 'ext-v*' } | Select-Object -First 1
    if (-not $latest) { Write-Fail "could not resolve latest ext-v* release" }
    $Version = $latest.tag_name
    Write-Log "Latest version: $Version"
}

$Semver  = $Version -replace '^ext-v', ''
$Zip     = "inspect-page-v$Semver.zip"
$Url     = "https://github.com/$Repo/releases/download/$Version/$Zip"
$SumsUrl = "https://github.com/$Repo/releases/download/$Version/checksums.txt"

$Tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "inspect-page-$([guid]::NewGuid())") -Force
try {
    Write-Log "Downloading $Zip…"
    Invoke-WebRequest -Uri $Url -OutFile (Join-Path $Tmp $Zip) -UseBasicParsing

    Write-Log "Verifying SHA256…"
    try {
        Invoke-WebRequest -Uri $SumsUrl -OutFile (Join-Path $Tmp 'checksums.txt') -UseBasicParsing
        $line = Get-Content (Join-Path $Tmp 'checksums.txt') | Where-Object { $_ -match " $Zip$" } | Select-Object -First 1
        if ($line) {
            $expected = ($line -split '\s+')[0]
            $actual   = (Get-FileHash -Algorithm SHA256 (Join-Path $Tmp $Zip)).Hash.ToLower()
            if ($expected -ne $actual) { Write-Fail "checksum mismatch: expected $expected, got $actual" }
            Write-Log "SHA256 OK ($actual)"
        }
    } catch {
        Write-Log "checksums.txt not available — skipping verification"
    }

    $DestVer = "$Dest-$Semver"
    if (Test-Path $DestVer) { Remove-Item $DestVer -Recurse -Force }
    New-Item -ItemType Directory -Path $DestVer -Force | Out-Null
    Expand-Archive -Path (Join-Path $Tmp $Zip) -DestinationPath $DestVer -Force

    # Stable symlink so Chrome keeps the same folder path across upgrades.
    if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
    try {
        New-Item -ItemType SymbolicLink -Path $Dest -Target $DestVer -Force | Out-Null
    } catch {
        Write-Log "symlink failed (needs admin or Developer Mode) — copying instead"
        Copy-Item -Path $DestVer -Destination $Dest -Recurse -Force
    }

    @"

✅ Inspect Page $Version installed.

Extracted to:    $DestVer
Stable path:     $Dest

Next steps:
  1. Open  chrome://extensions  (works in Chrome, Edge, Brave, Arc, Opera)
  2. Toggle  Developer mode  (top-right)
  3. Click  Load unpacked  and select:  $Dest

To upgrade later, re-run this script — the stable path is updated in place
so you do not need to remove the extension from Chrome.
"@ | Write-Host
}
finally {
    Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
}