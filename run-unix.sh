#!/usr/bin/env bash
set -e

echo "Running Node.js script..."
node ./.config/main-unix.js

echo
echo "==============================================="
echo "Process completed."
echo "==============================================="
# В Linux/macOS нет аналога pause,
# поэтому имитируем его чтением ввода.
read -n 1 -s -r -p "Press any key to continue..."
echo
