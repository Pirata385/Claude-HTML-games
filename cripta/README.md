# Cripta — Embaralhador de Imagens

A deterministic image scrambler in a single self-contained `index.html`. You upload an image and Cripta shuffles its pixels and changes its colours, driven by a **seed** and an optional **password**. It gives you a **key** that restores the image **pixel-perfect**. Everything runs locally in the browser; nothing is uploaded. The interface is in Portuguese.

## How it works

1. **Embaralhar (scramble):** pick an image, choose a style, and keep or type a seed. Optionally set a password.
2. Download the scrambled **PNG** and keep the **key**. You can copy it, download it as `.txt`, download both, share them, or embed the key inside the PNG.
3. **Desembaralhar (unscramble):** load the scrambled PNG and paste the key, or open the `.txt`; a key embedded in the PNG is read automatically. Type the password if the key needs one.
4. Cripta checks the result against a checksum stored in the key. It reports one of these:
   - a perfect restoration;
   - a wrong password;
   - a wrong image size;
   - an image that was recompressed or edited (the result is then approximate).

The same image, seed, password and style always give the same result.

## Styles

| Style | What it does |
| --- | --- |
| Ruído (noise) | Moves every pixel to a random place, then encrypts the colours (XOR keystream). The result is pure static. |
| Mosaico (mosaic) | Shuffles 32 px tiles and rotates/flips them like a puzzle. It doesn't change colours, so it survives recompression best. |
| Glitch | Shuffles rows and columns, slides them cyclically, and remaps colours. |
| Cores (colours) | Only the colours change: a per-channel secret colour table plus per-pixel channel swaps. |
| Fortaleza (fortress) | Tiles, pixel shuffle, colour cipher and diffusion, in 2 rounds. |

Under **Opções avançadas** you can combine the nine operations freely:

- position operations: blocks (4–128 px, optional rotate/flip), rows and columns, slide, pixels;
- colour operations: channel swap, colour remap, invert, cipher, diffusion;
- 1–4 rounds.

Position operations always run before colour operations.

## Quality of life

- **Getting images in:** drag and drop, paste (images or keys, with Ctrl+V), the phone camera, or a built-in sample image.
- **Live preview:** the image is scrambled again as you change options. The work runs in a Web Worker, so the interface doesn't freeze.
- **Viewer:** original/scrambled/compare (with a slider), fit or 1:1 zoom, and crisp pixels when zoomed in.
- **Testing:** a one-click "test in the Unscramble tab" that sends the image and key over.
- **History:** a local list of the keys you copied or downloaded, with scrambled thumbnails. It never stores passwords or originals, and it can be turned off or cleared.
- **Safety checks:**
  - large images are downscaled (above 36 MP on desktop, 16 MP on phones);
  - transparency is flattened onto white;
  - a warning appears for JPG/WebP inputs;
  - a banner appears if the browser adds anti-fingerprinting noise to canvas reads, because that would make restoration impossible.
- Light and dark theme. Shortcuts: `1`/`2`/`3` switch tabs, `Ctrl+S` downloads, `?` opens help.

## Technical notes

- **Keys** look like `CRIPTA1.` + base64url JSON. The JSON holds:
  - the seed, the operation list, the rounds and the image size;
  - whether a password is needed (`p`);
  - CRC-32 checksums of the original (`a`) and scrambled (`b`) RGB data;
  - the file name.
- **Passwords** are never stored. The master secret is SHA-256(seed, password); a password is stretched with 20 000 SHA-256 rounds. Each operation gets its own xoshiro128** generator, seeded from SHA-256(master, round, operation).
- **Exactness:** every operation is an exact bijection. Unscrambling runs the inverses in reverse order. Scrambled PNGs are read back with `createImageBitmap(..., { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })` so the values are exact.
- **Not audited cryptography:** Cripta is meant for privacy and fun. For real secrets, use Ruído or Fortaleza with a strong password, and send the PNG as a file (messaging apps recompress photos).

## Files

- `index.html` — the whole application (HTML, CSS and JS).
