# Água-Tinta — Aquário ASCII

*pesca e aquário em ASCII* — a two-colour ASCII fishing and aquarium game (pt-BR / English).

> Work in progress. The full description, controls and settings will be written by QA. The binding design is
> [`DESIGN.md`](DESIGN.md).

## Run

Open `index.html` in a browser (works from `file://`, offline). Add `?debug=1` to the URL for the `AQ.debug` helpers.

## Test

```sh
node aquario-ascii/tests/run.js            # all tests (exits non-zero on failure)
node aquario-ascii/tests/run.js store rng  # only files whose name contains a filter
```

Tests load the pure modules (`js/core`, `js/data`, `js/logic`) in Node through `tests/loader.js`, in the script order
of `index.html`.

## Credits

Font: JetBrains Mono NL (SIL Open Font License 1.1), see `fonts/LICENSE-JetBrainsMono.txt`.
