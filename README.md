# mmkuznecov.github.io

Personal site + blog. Plain static HTML/CSS, no build step. Math is rendered in
the browser with [KaTeX](https://katex.org/).

## Structure

```
.
├── index.html                     # homepage
├── assets/
│   └── style.css                  # shared theme (homepage + blog)
├── posts/
│   ├── index.html                 # blog listing
│   └── <post-slug>/
│       ├── index.html             # the post (HTML + KaTeX math)
│       └── artifacts/             # plots, figures, data for this post
└── cv/
    └── Working_CV.pdf             # add your CV here (see cv/README.txt)
```

Paths are root-absolute (`/assets/...`, `/posts/...`), which is correct for a
user site served at `https://mmkuznecov.github.io/`.

## Add a new post

1. Create a folder `posts/my-post-slug/` with an `artifacts/` subfolder.
2. Copy `posts/several-views-on-cross-entropy/index.html` as a starting point
   and edit the `<article class="post">` content. Write math with `$...$`
   (inline) and `$$...$$` (display) — KaTeX renders it automatically.
3. Put any plots in `posts/my-post-slug/artifacts/` and reference them with a
   relative path, e.g. `<img src="artifacts/figure.png">`.
4. Add a `<li>` for the post in `posts/index.html`.

Plots for the first post were generated with matplotlib styled to the site's
dark theme; reuse that approach for consistency.

## Preview locally

Root-absolute paths need a server (opening the file directly won't resolve `/`):

```
python -m http.server 8000
# then open http://localhost:8000/
```

## Deploy

Push to the `main` branch of `mmkuznecov/mmkuznecov.github.io`. GitHub Pages
serves it at https://mmkuznecov.github.io/ — no build, no Actions.

## Notes

- The JetBrains Mono font is loaded from Google Fonts, so the old local
  `fonts/` directory and its broken `@font-face` are no longer needed.
- The homepage photo was removed; the `images/` directory is no longer used.
