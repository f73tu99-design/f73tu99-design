# Setup & maintenance

This file is for you, not for visitors. Only `README.md` is rendered on your
profile page — everything else in this repo is invisible to the outside world.

## How the animation actually works

GitHub's markdown sanitiser strips `<script>`, `<style>` and most CSS out of
README HTML, so a README cannot animate anything by itself.

The workaround every animated profile uses: an SVG loaded through
`<img src="./assets/hero.svg">` is rendered as **its own document**. Inside
that document, `<style>` blocks, `@keyframes` and SMIL all run normally. So the
README is just a stack of centred `<img>` tags, and every moving part lives
inside the SVG files.

Consequences worth knowing:

- No JavaScript will ever run in these panels. Don't try.
- External fonts won't load. The panels use generic `ui-monospace` /
  `ui-sans-serif` stacks so they render consistently everywhere.
- Every panel declares `@media (prefers-reduced-motion: reduce)` to switch
  animations off. With animations off, elements fall back to their natural
  state, which is fully visible — the panels stay readable, just static.

## Which files are generated

| File | Source |
|---|---|
| `assets/stats.svg` | generated — `scripts/generate.mjs` |
| `assets/languages.svg` | generated — `scripts/generate.mjs` |
| `assets/activity.svg` | generated — `scripts/generate.mjs` |
| `assets/snake.svg`, `assets/snake-dark.svg` | generated — `Platane/snk` action |
| everything else in `assets/` | hand-authored, edit freely |

Hand-editing a generated file is pointless — the next workflow run overwrites it.

## The token, and why it matters here

All 15 of your repos are private. GitHub reports private work only as
`restrictedContributionsCount`, an opaque aggregate — it will not itemise it
into commits/PRs/issues even for you. That is why the stats panel shows a
**private vs public split** rather than a commit count that would read `0`.

More importantly: the Actions built-in `GITHUB_TOKEN` can only see **public**
data. Left as-is, the scheduled run would render your panels nearly empty.

To show your real numbers:

1. Create a token at <https://github.com/settings/tokens>
   - Classic token with `read:user` — counts your private contributions.
   - Add `repo` as well if you want private repos included in the language
     split. (This only ever publishes aggregate byte counts per language —
     never repo names, paths or code.)
2. Add it to this repo under **Settings → Secrets and variables → Actions**
   as `METRICS_TOKEN`.

The workflow prefers `METRICS_TOKEN` and falls back to `GITHUB_TOKEN`, so it
keeps working either way — it just shows less without the PAT.

## Running it locally

```bash
GITHUB_TOKEN=$(gh auth token) GH_LOGIN=f73tu99-design node scripts/generate.mjs
```

To eyeball the panels without pushing, open `preview.html` after regenerating
it — it inlines every SVG as a data URI, which matches how GitHub renders them.

## Editing

- **Accent colour** lives in one place: `accent` in `scripts/theme.mjs` for the
  generated panels, and the literal `#4ec9b0` in the hand-authored SVGs.
  `grep -rl '#4ec9b0' assets scripts` finds every occurrence.
- **Your name** is marked `<!-- EDIT: display name -->` in `assets/hero.svg`.
- **Stack lists** are plain `<text>` elements in `assets/stack.svg`.
- **Tier labels** (`Blade · TS`, `PHP · Laravel`, `MySQL`) are in
  `assets/hero.svg`; `MySQL` is an assumption from your Laravel usage — change
  it if you're on Postgres or something else.

## Gotcha that will bite you

Never put a CSS `transform` animation on an element that also carries an SVG
`transform="translate(...)"` attribute. The CSS transform **replaces** the
attribute rather than composing with it, and the element jumps to the wrong
place the moment the animation finishes. Put positioning on an outer `<g>` and
the animation on an inner `<g>`.
