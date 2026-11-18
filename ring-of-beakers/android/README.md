# Ring of Beakers for Android

A small Android app that runs the game full screen and offline. It is a single WebView activity; the game files (`../index.html`, `../js/` and the soundtrack in `../music/`, about 44 MB) are copied into the APK when it is built, so this folder holds no copy of the game.

## Build

On Debian or Ubuntu, install the open-source Android tools once:

```
sudo apt-get install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange openjdk-17-jdk
```

Then:

```
bash ring-of-beakers/android/build.sh
```

The APK is written to `ring-of-beakers/android/build/RingOfBeakers.apk` (the `build/` folder is ignored by git).

## Releasing an update

1. Pull the latest game.
2. In `AndroidManifest.xml`, raise `android:versionCode` by one and set a new `android:versionName`.
3. Run `build.sh`.

Always sign with `release.keystore` (the script does). Android only installs an update over the old app when the key is the same; with a different key the old app has to be uninstalled first, and its saves go with it.

## Files

```
AndroidManifest.xml     package net.ringofbeakers.game, version, landscape lock, min Android 6.0
src/.../MainActivity.java   the WebView wrapper
res/drawable-xxxhdpi/icon.png   the launcher icon
tools/make-icon.py      redraws the icon (needs Pillow): python3 tools/make-icon.py res/drawable-xxxhdpi/icon.png
release.keystore        the signing key (alias rob, store and key password ringofbeakers)
build.sh                builds and signs the APK
```

## How the wrapper behaves

- The game is served from `https://appassets.androidplatform.net/game/` out of the APK's assets, so local storage (the save slots) works as on the web.
- Always landscape (`sensorLandscape`: it still flips when the phone is turned round), full screen, screen kept on.
- Leaving the app (home, app switcher, screen off, a call) pauses the game: it saves, its sound and music stop and every JavaScript timer and animation frame stops (`WebView.pauseTimers`). Coming back carries on from the same moment. To reach the sound, the app adds a small script to the top of `index.html` as it serves it (the game's files are not changed): it keeps track of the game's `AudioContext` (effects, bird calls) and `<audio>` elements (the recorded music), pauses whatever is playing, holds back any `play()` while the app is away, and plays it again on return.
- Files stored uncompressed in the APK (the `.mp3`s) are served with byte ranges (`206 Partial Content`), so the music knows its length, can seek and can loop.
- `window.prompt` and `confirm` show native dialogs (renaming birds, save export and import).
- The back button acts as Escape in the game; on the title screen it closes the app. So does the title screen's "All games" button, since the collection's menu is not in the APK.

## The key is public

This repository is public, so anyone can sign an APK with this key. That is fine for a hobby game, but it means a phone cannot tell a build made from here apart from someone else's build that uses the same key. Only install APKs you built yourself or got from someone you trust.
