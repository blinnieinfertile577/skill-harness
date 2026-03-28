$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$claudeTarget = Join-Path $HOME '.claude\agents'
$codexTarget = Join-Path $HOME '.codex\agents'
python (Join-Path $scriptDir 'scripts\bootstrap_dependencies.py')
New-Item -ItemType Directory -Force -Path $claudeTarget | Out-Null
New-Item -ItemType Directory -Force -Path $codexTarget | Out-Null
Copy-Item -Path (Join-Path $scriptDir '.claude\agents\*.md') -Destination $claudeTarget -Force
python (Join-Path $scriptDir 'scripts\render_codex_agents.py')
python (Join-Path $scriptDir 'scripts\check_dependencies.py')
Write-Output "Installed Claude agents to $claudeTarget"
Write-Output "Rendered Codex agents to $codexTarget"
