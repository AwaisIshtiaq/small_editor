#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
rm -rf out/com
mkdir -p out
javac --release 17 --add-modules jdk.httpserver -cp "lib/*" -d out $(find src/main/java -name '*.java' | sort)
echo "compiled to $(pwd)/out"
