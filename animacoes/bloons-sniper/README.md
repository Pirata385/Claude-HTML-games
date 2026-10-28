# Operação Vermelho

A one-minute fan short set in the Bloons TD6 universe, in Portuguese, with sound synthesised live in the browser.

**The story.** It is a rainy night in Monkey City. Falcão, a Sniper Monkey lying on a rooftop, takes instructions over the radio from Central, a Monkey Intelligence Bureau agent in a dark room full of monitors. The film cuts between the two as the tension builds: a red target, two kilometres, one shot. When Falcão finally fires, the bullet crosses the city in slow motion and pops a red **party balloon** at a child's birthday party. The letterbox bars open, the colours turn bright, and the rest is comedy: confetti, a crying kid, a facepalm, a sad trombone, and the real red Bloon floating right past the sniper while the lives counter drops from 150 to 149.

## How it works

- Everything is drawn in code on a 1280×720 virtual stage, scaled to fit the window. There are no image or audio files.
- The film is a list of 14 shots (`SHOTS`), each a function of its local time. Subtitles (`SUBS`) appear with a typewriter effect, and characters move their mouths while their lines are typing.
- The sound (rain, a low drone, radio clicks, thunder, heartbeat, gunshot, the pop, "Happy Birthday", a sad trombone and pizzicato) is made with WebAudio and scheduled against the audio clock, so the picture follows the sound when you pause or seek.

## Controls

- **▶ Assistir** starts the film. Browsers only allow sound after a click, so the film doesn't autoplay.
- **Space** pauses, **R** restarts, **M** mutes. Click the progress bar to seek.
- **Menu** goes back to the root menu, on the Animações tab.

Bloons TD6 is a game by Ninja Kiwi. This is an unofficial fan animation, and its characters are original drawings in the game's style.
