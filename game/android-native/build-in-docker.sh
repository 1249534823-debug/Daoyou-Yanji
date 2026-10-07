#!/usr/bin/env bash
set -euo pipefail
: "${ANDROID_TOOLS_DIR:?Set ANDROID_TOOLS_DIR to SDK/Gradle cache directory}"
project_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
docker run --rm --cpus=1 --memory=2g \
  -v "$ANDROID_TOOLS_DIR:/tools" -v "$project_dir:/work" -w /work \
  -e ANDROID_HOME=/tools/sdk -e GRADLE_USER_HOME=/tools/gradle-cache \
  eclipse-temurin:17-jdk-jammy \
  /tools/gradle-8.11.1/bin/gradle --no-daemon \
  :app:assembleDebug :app:assembleRelease :app:lint :app:assembleDebugAndroidTest
