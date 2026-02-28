#!/usr/bin/env bash

while IFS= read -r address; do
  # Skip empty lines
  [ -z "$address" ] && continue

  echo "Running for $address"
  node scripts/analyze-address.js "$address"

done < addresses-to-analyze.txt