#!/usr/bin/env bash

# Exit on error
set -e

DATASET_NAME=$1

if [ -z "$DATASET_NAME" ]; then
  echo "Error: Dataset name is required."
  echo "Usage: $0 <dataset-name>"
  echo "Example: $0 HDFS"
  exit 1
fi

echo "To download the '$DATASET_NAME' dataset, please:"
echo "1. Visit the Logpai Loghub repository: https://github.com/logpai/loghub"
echo "2. Download the corresponding '$DATASET_NAME' raw log file."
echo "3. Save or extract the raw log file directly to the 'data/' directory:"
echo "   data/$DATASET_NAME.log"
echo ""
echo "TODO: Implement automatic downloading scripts for standard datasets."
