# Água-Tinta — Android (APK)

A thin native wrapper: one `Activity` with a full-screen `WebView` that serves the game from the APK's assets
under `https://appassets.androidplatform.net/` (so `localStorage` saves, fonts and Web Audio work as on the web).
No Gradle and no extra libraries; the game files in `../` are copied in at build time, so the APK always
matches the web version.

What the wrapper adds:
- immersive full screen (system bars hidden, swipe to peek), screen kept on, any orientation;
- sound starts without an extra tap; vibration permission for haptics;
- the game is saved when the app goes to the background or Back is pressed (Back sends the app to the
  background instead of closing it);
- the in-game *Fullscreen* button works; the *Games menu* links (web-collection only) are hidden.

## Build

Needs a JDK (17+) and an Android SDK with `platforms;android-34` and `build-tools;35.0.0`
(build-tools 34's `d8` crashes on classes compiled by JDK 21).

```sh
ANDROID_HOME=/path/to/sdk ./build.sh        # -> android/aguatinta.apk
```

The APK is signed with `$AGUATINTA_KEYSTORE` (default `~/.android/aguatinta.keystore`, created on the first
run). Use the same keystore for every build, otherwise Android refuses to install an update over the old one
(uninstall first, which deletes the save).

`build/`, `*.apk` and `*.keystore` are git-ignored.
