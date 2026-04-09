#!/bin/bash

# Ensure we have the latest tags
git fetch --tags origin

# Get the latest tag matching v0.*.0
# sort -V natural sorts version numbers
LATEST_TAG=$(git tag -l "v0.*.0" | sort -V | tail -n 1)

if [ -z "$LATEST_TAG" ]; then
  NEXT_TAG="v0.1.0"
else
  # Extract the middle digit
  if [[ $LATEST_TAG =~ v0\.([0-9]+)\.0 ]]; then
    MIDDLE_NUM="${BASH_REMATCH[1]}"
    NEXT_NUM=$((MIDDLE_NUM + 1))
    NEXT_TAG="v0.${NEXT_NUM}.0"
  else
    NEXT_TAG="v0.1.0"
  fi
fi

echo "🚀 Creating tag ${NEXT_TAG}..."
git tag "${NEXT_TAG}"

echo "⬆️ Pushing tag ${NEXT_TAG} to origin..."
git push origin "${NEXT_TAG}"

echo "✅ Successfully created and pushed ${NEXT_TAG}"
