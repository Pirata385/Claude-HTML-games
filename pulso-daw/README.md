# Pulso — Estúdio Musical (DAW)

A complete music studio (DAW) that runs in one self-contained `index.html`, with no install and no external files. Every sound is synthesised live with the Web Audio API. The interface is in Portuguese.

## Features

- **Multiple tracks** of three kinds:
  - **Bateria (drums):** a step grid with 8+ rows per kit. There are 12 synthesised sounds (kick, snare, clap, closed/open hi-hat with choke, low and high tom, rim, cowbell, crash, shaker, conga), and any row can play an audio sample instead. There are four kits (808, Acoustic, Lo-Fi, Electronic). Each row has its own tuning, decay, volume and mute, plus pattern tools: fill every 4 or 2 steps, off-beats, random, shift left/right and clear.
  - **Synth:** a piano roll driven by a two-oscillator subtractive/FM synth. It has a sub-oscillator, noise, a filter with its own envelope, ADSR, vibrato and octave control. There are 12 presets: electric piano, sub bass, acid bass, saw lead, pluck, pad, strings, organ, FM bell, brass, 8-bit chip and super saw.
  - **Sampler:** a piano roll that plays a sample chromatically. There are four built-in samples, all generated in code (vocal "ah", chord stab, kalimba, vinyl hit). You can also load your own audio file or record from the microphone. Settings: root note, start point, reverse, loop, filter and ADSR.
- **Step grid:** click or drag to paint steps. Right-click or long-press a step to cycle its velocity. The playhead follows the music.
- **Piano roll:** draw, select (box and Shift), erase and pan tools. Drag a note to move it, or drag its right edge to resize it. Alt-drag duplicates. Snap ranges from 1/64 to a full bar, including triplets. There is a velocity lane, quantize, transpose, copy/paste/duplicate, zoom, and a scale highlight (major, minor, pentatonic, dorian, blues) for any root note.
- **Transport:** play/pause/stop, BPM (40–240) with tap tempo, swing, loop length of 1/2/4/8 bars, metronome and a position display.
- **Live playing and recording:** play the selected track from the computer keyboard (two octaves; `[` and `]` change octave) or from a **Web MIDI** keyboard. Arm **Rec** to record notes into the loop while it plays; notes snap to the grid.
- **Per-track mixing:** volume, pan, a DJ-style filter (low-pass ↔ high-pass), distortion, reverb send, delay send, mute and solo, and a level meter.
- **Mixer view:** a channel strip for every track plus the master, with vertical faders and stereo meters.
- **Master effects:** convolution **reverb** (size and darkness), tempo-synced **ping-pong delay** (feedback and tone), a 3-band **EQ**, a **compressor**, a safety limiter, and a spectrum/oscilloscope analyser.
- **Project files:**
  - **Autosave** in the browser, with 150 steps of undo/redo.
  - **Save/open** a `.json` project. Your own samples are embedded in it.
  - **Export WAV**: an offline render of 1–8 loops, including effect tails.
  - **Export MIDI**: one track per instrument, with drums on channel 10 using General MIDI notes.
- A demo song is loaded on first visit.
- **Audio status button (🔊/🔇)** in the top bar. It turns red when the browser has blocked or paused audio; tap it to re-enable sound and hear a test beep. On iPhone/iPad the app uses the "playback" audio session, so sound plays even with the silent switch on.
- Works with mouse, keyboard and touch. The layout adapts from wide desktop screens down to phones.

## Shortcuts

| Key | Action |
| --- | --- |
| Space | Play / pause |
| Enter | Stop and return to the start |
| Shift R | Arm recording |
| Z S X D C V… / Q 2 W 3 E R… | Play notes (lower / upper octave) |
| `[` `]` | Keyboard octave down / up |
| Ctrl Z / Ctrl Shift Z | Undo / redo |
| Ctrl A / C / V / D | Select all / copy / paste / duplicate notes |
| Delete | Delete selected notes |
| ↑ ↓ (Shift) | Transpose selection by a semitone (an octave) |
| ← → | Move selection by one grid step |
| Alt ↑ ↓ | Select previous / next track |

## Files

- `index.html` — the whole application (HTML, CSS and JS).
