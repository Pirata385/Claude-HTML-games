# Tico e a Geladeira

A comic and tragic cartoon short, about 1 min 45 s long. It is told without dialogue, through gags, onomatopoeia and sound, in the style of classic 1950s cartoons: warm painted backgrounds, thick outlines, squash and stretch, takes, smears and an iris-in and iris-out. The on-screen text is in Portuguese.

**The story.** Tico, a rat, peeks out of his hole as a human (seen only from the waist down) opens a fridge full of food, takes the milk and closes it again. Tico's eyes pop and his tongue rolls out to the floor. Then the attempts begin, each one more ingenious than the last and each one a failure:

1. **The tower.** He stacks a book, a matchbox, a spool, a teacup and a thimble, climbs up and grabs the handle. The tower collapses, he waves goodbye and falls, and the teacup lands on top of him.
2. **The catapult.** A ruler on a cork and a thread tied to a can on the table. The launch works perfectly: he splats flat on the door, slides down, falls like a sheet of paper and has to reinflate.
3. **The lasso.** With the thimble as a cowboy hat, he lassoes the handle and pulls with all his strength. The loop slips off and he rolls like a ball straight back into his hole.
4. **The dynamite.** The fuse fizzles out. He goes to take a close look. KABOOM. The fridge doesn't have a scratch.

Defeated under a little rain cloud, he angrily kicks the door, hurts his foot, and the door creaks open by itself. Inside, a glowing slice of cheesecake: heart eyes, floating on the smell, three bites. The human comes back, sees the door ajar and bumps it shut with a hip. The light goes out. In the dark, only Tico's eyes and his chattering teeth are left. He shrugs and takes another bite. Iris out on the fridge at night.

## How it works

- **Rat rig.** Tico is a parametric cartoon rig, not a skeleton: position, squash and stretch, lean, where the head looks, two rubber-hose arms and legs (with walk, run, tiptoe and spin cycles), eye size, eyelids, pupils, eyebrows and a set of mouths. Gag effects are layered on top: stars, soot, hearts, a lightbulb, a rain cloud, steam, a teacup on his head, wrapped in thread, eyes alone in the dark.
- **Keyframes.** `r(time, props, ease)` sets his keyframes. Props carry over from the previous key: numbers are interpolated with an easing curve, everything else switches on the key. Props (`pk`), the human (`h`), the fridge door, the camera and every effect follow the same idea, so any frame can be drawn from the time alone.
- **Smears.** Fast moves draw smear copies and speed lines automatically, from samples at earlier moments.
- **Sound.** The music (a xylophone theme over an oom-pah bass, sneaky pizzicato, a heavenly choir, a waltz and a sad trombone) and the effects (zips, boings, the "awooga" horn, crashes, the splat, the explosion, creaks, chomps, chattering teeth) are synthesised with WebAudio and queued a little ahead of the audio clock.

## Controls

- **▶ Assistir** starts the film. Browsers only allow sound after a click, so it doesn't autoplay.
- **Space** pauses, **R** restarts, **M** mutes. Click the progress bar to seek.
- `index.html?t=SECONDS` shows a still frame at that time.
- **Menu** goes back to the root menu, on the Animações tab.
