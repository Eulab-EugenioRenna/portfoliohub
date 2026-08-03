#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
artifact_dir="$project_root/artifacts"
archive="$artifact_dir/portfoliohub-aruba-gateway.zip"

mkdir -p "$artifact_dir"
rm -f "$archive"
cd "$project_root/apps/aruba-gateway"
zip -q -r "$archive" .htaccess index.php config.example.php README.md
echo "$archive"
