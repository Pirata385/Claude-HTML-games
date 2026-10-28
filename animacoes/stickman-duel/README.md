# Raio × Sangue

A 90-second stickman fight short, in Portuguese, drawn and scored entirely in code.

**The story.** A ruined arena at sunset, in an ink-on-paper style. **Volt**, a stickman with lightning powers, lands in a bolt from the sky. **Carmim**, who bends his own blood, rises out of a pool on the floor. After the face-off they trade blows hand to hand, then escalate: a lightning bolt against a blood shield, flying blood crescents, a lightning blink and a palm strike that throws Carmim into a pillar. Carmim answers with a line of blood spikes and a whip that slams Volt into a crater. A storm breaks, both power up, and their attacks collide in a beam struggle that ends in an explosion. In the rain, wounded, they trade a last flurry and cross in a single strike. Volt drops to one knee, but it is Carmim who falls. The clouds part at dawn and Volt wins.

## How it works

- **Skeletal animation.** Each stickman is a 10-angle skeleton (torso, head, two arms, two legs). The `POSES` library holds named poses, and walking and running are computed as cycles. The choreography is a list of keyframes per fighter (`k(...)`) with position, jump height, body rotation, facing and an easing curve. In between, poses are interpolated, and the lowest point of the body is planted on the floor automatically.
- **Secondary motion.** Carmim's scarf, motion smears and the auto camera all sample the fighters at past moments. Everything is a pure function of time, so seeking anywhere gives the same frame.
- **Impact language.** Every hit in `IMPACTS` drives hit-stop (the fighters freeze for a few frames), screen shake, sparks and shockwaves, and a hit sound. Heavy hits also get **impact frames**: one or two high-contrast frames with inverted silhouettes and radial speed lines.
- **Sound.** Hits, whooshes (generated from the strike keyframes), lightning crackle, blood splashes, thunder, rain, the beam struggle and a drum-and-bass score at 150 bpm are all synthesised with WebAudio. They are queued a little ahead of the audio clock, which also drives the picture.

## Controls

- **▶ Assistir** starts the film. Browsers only allow sound after a click, so it doesn't autoplay.
- **Space** pauses, **R** restarts, **M** mutes. Click the progress bar to seek.
- `index.html?t=SECONDS` shows a still frame at that time, which is handy for checking a shot.
- **Menu** goes back to the root menu, on the Animações tab.
