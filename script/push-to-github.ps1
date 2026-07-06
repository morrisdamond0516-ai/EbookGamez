# Push local code changes to GitHub (Replit pulls from there).
# Usage:
#   .\script\push-to-github.ps1
#   .\script\push-to-github.ps1 "Fix cover publish flow"
#
# Does NOT sync database or uploads - only git-tracked code.

param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Test-Path ".git")) {
    Write-Error "No .git folder here. Run from the app repo root."
}

$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit - working tree clean."
    git push 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "GitHub is up to date." }
    exit 0
}

Write-Host "Changed files:"
git status --short

if (-not $Message) {
    $Message = Read-Host "Commit message"
}
if (-not $Message.Trim()) {
    Write-Error "Commit message required."
}

git add -A
git commit -m $Message
git push

Write-Host ""
Write-Host "Pushed to GitHub."
Write-Host "On Replit: open Shell and run:  git pull"
Write-Host "Then use Replit Deploy or Run to publish the app."
Write-Host ""
Write-Host 'Note: books, drafts, and cover files are NOT included. Database and uploads stay separate.'
