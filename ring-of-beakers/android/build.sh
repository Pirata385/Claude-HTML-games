#!/bin/bash
# Builds RingOfBeakers.apk from the game in the folder above (index.html + js/).
# Needs the open-source Android tools packaged by Debian/Ubuntu:
#   sudo apt-get install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange openjdk-17-jdk
# Output: android/build/RingOfBeakers.apk
set -eo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
GAME="$(dirname "$HERE")"
OUT="$HERE/build"
JAR=/usr/lib/android-sdk/platforms/android-23/android.jar
PASS=ringofbeakers

for tool in javac aapt apksigner zipalign dalvik-exchange; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool (see the apt-get line at the top of this script)" >&2; exit 1; }
done
[ -f "$JAR" ] || { echo "Missing $JAR (apt-get install android-sdk-platform-23)" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/assets/game" "$OUT/dex"

# The game itself: only what the page loads (no tests, no docs, not this folder).
cp "$GAME/index.html" "$OUT/assets/game/"
cp -r "$GAME/js" "$OUT/assets/game/"

# The Java wrapper (Java 8 bytecode, for the dx dexer).
javac -nowarn --release 8 -classpath "$JAR" -d "$OUT/classes" "$HERE"/src/net/ringofbeakers/game/*.java
dalvik-exchange --dex --output="$OUT/dex/classes.dex" "$OUT/classes"

# Package: resources.arsc must stay uncompressed for targetSdk 30+.
aapt package -f -0 arsc -M "$HERE/AndroidManifest.xml" -S "$HERE/res" -A "$OUT/assets" -I "$JAR" -F "$OUT/unsigned.apk"
(cd "$OUT/dex" && aapt add ../unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# Always sign with the same key, or phones refuse to install over the old version (and saves would be lost).
apksigner sign --ks "$HERE/release.keystore" --ks-key-alias rob --ks-pass pass:$PASS --key-pass pass:$PASS \
  --out "$OUT/RingOfBeakers.apk" "$OUT/aligned.apk"
apksigner verify "$OUT/RingOfBeakers.apk"
rm -f "$OUT/unsigned.apk" "$OUT/aligned.apk" "$OUT/RingOfBeakers.apk.idsig"

echo "Built $OUT/RingOfBeakers.apk"
