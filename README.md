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
  Plotly 2.35.2 (MIT) and IBM Plex fonts (SIL OFL 1.1). Licence texts are in
  `vendor/LICENSES.txt`.

The thesis PDF is the examined record and carries a static version of every
figure here. These pages are generated from the thesis repository by
`scripts/supplementary/build.py`; do not edit this repository by hand.

## Citing

Cite the archived release by its DOI (Zenodo). GitHub's "Cite this repository"
button reads the same metadata from `CITATION.cff`.

## Licence

See `LICENSE.md`.
