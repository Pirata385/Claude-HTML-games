#!/usr/bin/env bash
# Builds aguatinta.apk from the game folder (../) with the plain Android SDK tools, no Gradle.
# Needs: JDK 17+, ANDROID_HOME pointing to an SDK with platforms;android-34 and build-tools;35.0.0.
# Signing key: $AGUATINTA_KEYSTORE (default ~/.android/aguatinta.keystore, created on first run).
# Keep the same keystore to install updates over an existing install.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
GAME="$(cd "$HERE/.." && pwd)"
: "${ANDROID_HOME:?set ANDROID_HOME to your Android SDK}"
BT="$ANDROID_HOME/build-tools/${BUILD_TOOLS:-35.0.0}"
JAR="$ANDROID_HOME/platforms/android-${PLATFORM:-34}/android.jar"
KS="${AGUATINTA_KEYSTORE:-$HOME/.android/aguatinta.keystore}"
KS_PASS="${AGUATINTA_KS_PASS:-aguatinta}"
OUT="$HERE/build"
rm -rf "$OUT" && mkdir -p "$OUT"/{res,gen,classes,assets/game,dex}

# 1. game files -> assets/game (code, styles, fonts, licence only)
cp "$GAME/index.html" "$OUT/assets/game/"
cp -r "$GAME/css" "$GAME/js" "$GAME/fonts" "$OUT/assets/game/"

# 2. resources + manifest
"$BT/aapt2" compile --dir "$HERE/res" -o "$OUT/res/res.zip"
"$BT/aapt2" link -I "$JAR" --manifest "$HERE/AndroidManifest.xml" \
  -o "$OUT/base.apk" --java "$OUT/gen" -A "$OUT/assets" "$OUT/res/res.zip" --auto-add-overlay

# 3. java -> dex
javac -source 8 -target 8 -Xlint:-options -bootclasspath "$JAR" -classpath "$JAR" -d "$OUT/classes" \
  $(find "$HERE/src" "$OUT/gen" -name '*.java')
"$BT/d8" --release --lib "$JAR" --min-api 24 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q -j "$OUT/base.apk" classes.dex)

# 4. align + sign
"$BT/zipalign" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias aguatinta \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Agua-Tinta" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --ks-key-alias aguatinta \
  --out "$HERE/aguatinta.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify "$HERE/aguatinta.apk"
echo "OK -> $HERE/aguatinta.apk ($(du -h "$HERE/aguatinta.apk" | cut -f1))"
