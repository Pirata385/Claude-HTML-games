# Hexel — Pixels em Hexágonos

A web app that turns the pixels of any image into hexagons. It is a single self-contained `index.html` and works on desktop and mobile. Everything is processed locally in the browser; no image is uploaded anywhere. The interface is in Portuguese.

## Features

- **Getting images in:** pick a file, drag and drop, paste from the clipboard (Ctrl+V), or take a photo with the camera on phones. A procedurally drawn sample image is included. The last image and settings are remembered.
- **Grid:**
  - Hexagon size, with a live count of hexagons.
  - Pointy-top or flat-top orientation, or any rotation of the whole grid.
  - Horizontal and vertical offset.
  - Colour sampling from the whole cell, from the cell's core, or from the centre pixel.
  - An option to keep only whole hexagons.
  - Transparent PNG areas are respected.
- **10 styles:** flat, bevel, 3D cubes, gem, facets, rings, circles, beads (Perler/Hama-like), studs, and outline. Each style can be combined with:
  - spacing, rounded corners and per-hexagon rotation;
  - variable size by brightness or darkness (halftone);
  - light direction and intensity;
  - opacity;
  - borders: darker, lighter or a fixed colour.
- **Colour:** brightness, contrast, saturation, hue, temperature and gamma. Filters: greyscale, sepia, duotone and invert. Also posterize, seeded random variation, and a single "ink" colour mode.
- **Palette:**
  - automatic reduction to 2–64 colours (k-means);
  - 14 ready palettes (PICO-8, Game Boy, C64, NES, CGA, sepia, pastel, neon…);
  - your own custom HEX list;
  - optional **dithering** that spreads error across the hexagonal grid;
  - click any palette colour to replace it everywhere.
- **Background:** solid colour, transparent, the original image, or a blurred original.
- **16 presets**, including Classic, Honeycomb, Stained glass, 3D Cubes, Halftone, PICO-8, Game Boy and Beads. You can save your own presets and roll a random "surprise" style.
- **Quality-of-life features:**
  - live preview;
  - before/after comparison slider;
  - zoom and pan (mouse wheel, pinch, double-click);
  - an eyedropper with a copyable HEX code;
  - undo/redo of settings;
  - double-click a slider to reset it, or tap its value to type a number;
  - collapsible sections;
  - light and dark theme;
  - keyboard shortcuts.
- **Export:**
  - **PNG, JPG, WebP or vector SVG**, at 0.5×–4× scale or a custom width;
  - copy the result to the clipboard, or share it on mobile;
  - download the palette as `.gpl` (GIMP/Aseprite) or `.txt`;
  - **batch** processing of many images with the current settings.

## Shortcuts

| Key | Action |
| --- | --- |
| Ctrl O / Ctrl V / Ctrl S | Open / paste / download |
| Ctrl Z / Ctrl Shift Z | Undo / redo |
| C | Before/after comparison |
| I | Eyedropper |
| R | Random style |
| F / 0 / + / − | Fit / actual size / zoom |
| `[` `]` | Smaller / larger hexagons |

## Files

- `index.html` — the whole application (HTML, CSS and JS).
