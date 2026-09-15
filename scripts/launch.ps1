# Startet den Dev-Server (falls nötig) und öffnet das Management Tool als eigenes App-Fenster.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url  = 'http://localhost:5180'
$log  = Join-Path $PSScriptRoot 'server.log'

function Test-Server {
  try { (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
}

if (-not (Test-Server)) {
  if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm install' -WorkingDirectory $root -WindowStyle Hidden -Wait
  }
  # Server unsichtbar im Hintergrund, Ausgabe ins Log
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npm run dev > `"$log`" 2>&1" -WorkingDirectory $root -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(45)
  while (-not (Test-Server)) {
    if ((Get-Date) -gt $deadline) {
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show("Der Server ist nicht gestartet.`nDetails: $log", 'Management Tool') | Out-Null
      exit 1
    }
    Start-Sleep -Milliseconds 400
  }
}

# App-Modus: eigenes Fenster ohne Adressleiste
$candidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($browser) {
  Start-Process -FilePath $browser -ArgumentList "--app=$url", '--window-size=1400,900'
} else {
  Start-Process $url
}
