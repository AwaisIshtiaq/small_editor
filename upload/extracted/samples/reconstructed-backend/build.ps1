$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (Test-Path out/com) { Remove-Item -Recurse -Force out/com }
New-Item -ItemType Directory -Force -Path out | Out-Null
$sources = Get-ChildItem -Recurse -Filter *.java src/main/java | ForEach-Object { $_.FullName }
javac --release 17 --add-modules jdk.httpserver -cp "lib/*" -d out $sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "compiled to $PSScriptRoot\out"
