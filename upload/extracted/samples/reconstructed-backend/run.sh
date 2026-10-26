#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) SEP=';' ;;
  *) SEP=':' ;;
esac
exec java --add-modules jdk.httpserver -cp "out${SEP}lib/*" com.example.pdfpoc.Main
