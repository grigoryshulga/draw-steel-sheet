# Brand assets

`public/brand/dostat-listy-mark.svg` is the site's emblem: an open tome with a
scroll and a sword laid across it. `dostat-listy-wordmark.svg` is the full
lockup with the “Достать листы!” lettering. Both are vectorised (traced) from the
approved AI-generated artwork, so they do not rely on installed fonts. Ink uses `currentColor`; the red and gold follow `--logo-accent` and
`--logo-gold`. `favicon.svg` is the emblem for browser tabs. PNG exports at 16,
32, 180, 192 and 512 pixels are generated from the emblem SVG.
`src/components/SiteLogo.tsx` exposes the `mark` and `wordmark` variants; use
`className` to set dimensions. Its colors follow `html[data-mode]`.

The site's primary identity is “Достать листы!”. The emblem and wordmark are
original to this app and do not reproduce Draw Steel or MCDM marks.
