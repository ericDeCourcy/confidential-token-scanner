#!/bin/bash
while IFS= read -r line; do
    echo $line
    node "$(dirname "$0")/../analyze-address.js" $line cUSDC
done < "$(dirname "$0")/cUSDC_wrappers.txt"