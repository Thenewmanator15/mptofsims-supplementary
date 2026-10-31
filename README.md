# MP-ToF-SIMS supplementary material

Interactive versions of figures from the PhD thesis *Efficient High Speed
Modulation Techniques for a Sensing Application* (Mathew P. Newman, The
University of Manchester), with the reduced data each one draws.

**Open `index.html` through a web server**, or visit the published site. Browsers
block the pages' data requests from `file://`, so a double-clicked page shows a
load error:

```sh
python -m http.server 8000     # then http://localhost:8000
```

## What is here

- One folder per figure. Each page states whether its data are **measured or
  illustrative**, lists the caveats that apply before quoting a number, and gives
  its provenance: the source file, its SHA-256, and the code that reduced it.
- `vendor/`: the only third-party code, copied in so the site needs no network:
  Plotly 2.35.2 in its strict build (MIT) and IBM Plex fonts (SIL OFL 1.1). Licence
  texts are in `vendor/LICENSES.txt`.

The thesis PDF is the examined record and carries a static version of every
figure here. These pages are generated from the thesis repository by
`scripts/supplementary/build.py`; do not edit this repository by hand.

## Content Security Policy

Every page carries a Content Security Policy in a `<meta>` tag straight after
`<meta charset>`. Scripts, styles, fonts, images and data may come only from this
site, and no inline script or inline style runs: page styles live in `.css`
files, never in `<style>` blocks or `style=` attributes.

The figure pages allow two things more, both for the pinned Plotly 2.35.2:

- **Four fixed inline styles.** `style-src` lists the SHA-256 hashes of four
  strings Plotly writes into the page as it draws, with `'unsafe-hashes'` so the
  hashes also cover `style=` attributes: the empty string (Plotly fills empty
  `<style>` elements with `insertRule`, and gives colour bars `style=""`), the
  `image-rendering` declarations on heatmap images, `font-size:70%`
  (superscripts in log-axis tick labels), and the MapLibre stylesheet bundled in
  Plotly. Any other inline style is blocked.
- **`data:` and `blob:` images**, for heatmaps and the PNG export button.

No page allows `'unsafe-eval'`. The pages load Plotly's *strict* build, whose WebGL
plots (`scattergl`) are drawn by precompiled code; the regular build makes that code
at run time with `new Function`, which the policy would block.

After changing the Plotly version, open every page with the browser console open
and fix any Content Security Policy error before publishing; the hashes change
whenever these strings do.

## Citing

Cite the archived release by its DOI (Zenodo). GitHub's "Cite this repository"
button reads the same metadata from `CITATION.cff`.

## Licence

See `LICENSE.md`.
