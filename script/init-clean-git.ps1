# Fresh git history for EbookGamez (current code only, no bloated Replit history).
# Run from repo root: powershell -ExecutionPolicy Bypass -File script/init-clean-git.ps1
#
# Optional: pass your GitHub remote URL to set origin and push:
#   .\script\init-clean-git.ps1 -RemoteUrl "https://github.com/YOUR_USER/EbookGamez.git" -ForcePush

param(
    [string]$RemoteUrl = "",
    [switch]$ForcePush
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

if (Test-Path .git) {
    Write-Host "Removing existing .git (starting fresh)..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .git
}

git init -b main
git add .
git status --short | Select-Object -First 30
$count = (git status --short | Measure-Object -Line).Lines
Write-Host "`nStaged $count paths (uploads/ and node_modules/ should be absent)."

git commit -m @"
Initial commit: EbookGamez application source

Clean history from local Cursor workspace. Replit checkpoints retain prior history.
"@

$size = (git count-objects -vH 2>$null | Select-String "size-pack").ToString()
Write-Host "`nNew repo object size: $size" -ForegroundColor Green

if ($RemoteUrl) {
    git remote add origin $RemoteUrl
    if ($ForcePush) {
        Write-Host "Force-pushing to origin main (replaces bloated GitHub history)..." -ForegroundColor Yellow
        git push -u origin main --force
    } else {
        git push -u origin main
    }
} else {
    Write-Host @"

Next steps:
  1. Create a repo on GitHub (or use an existing empty one).
  2. Run:
       git remote add origin https://github.com/YOUR_USER/EbookGamez.git
       git push -u origin main
     If GitHub already has the bloated Replit history, use:
       git push -u origin main --force
"@ -ForegroundColor Cyan
}
