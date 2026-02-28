
#!/usr/bin/env bash
set -euo pipefail

safe_total=0
external_total=0

while IFS= read -r address; do
  [ -z "$address" ] && continue

  echo "Running for $address"

  # capture output; assume totals is the last line and looks like: "2 0"
  output=$(node scripts/total-external-transfers.js "$address")
  totals_line=$(printf '%s\n' "$output" | tail -n 1)

  read -r safe external <<< "$totals_line"

  safe_total=$((safe_total + safe))
  external_total=$((external_total + external))

  echo "Running totals: $safe_total $external_total"
done < unwrappers-list.txt

echo "Final totals: $safe_total $external_total"