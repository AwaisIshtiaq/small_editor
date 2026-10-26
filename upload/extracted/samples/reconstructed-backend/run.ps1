$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
java --add-modules jdk.httpserver -cp "out;lib/*" com.example.pdfpoc.Main
