/**
 * Wraps the raw Platane/snk output in the same card chrome as every other
 * panel, so the contribution graph stops looking like a guest. Idempotent:
 * a snake that is already framed is left alone.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { frame, section, svg } from './theme.mjs';

const file = new URL('../assets/snake.svg', import.meta.url);
let src = await readFile(file, 'utf8');

// Already framed? Pull the raw snake back out and re-wrap it, so a theme
// change propagates instead of being skipped.
const framed = src.match(/<svg data-framed="1"[^>]*>([\s\S]*?)<\/svg>\s*<\/svg>\s*$/);
if (framed) {
  const vb = (src.match(/<svg data-framed="1"[^>]*viewBox="([^"]+)"/) || [])[1] || '-16 -32 880 192';
  src = `<svg viewBox="${vb}">${framed[1]}</svg>`;
}

const m = src.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);
if (!m) throw new Error('snake.svg: unexpected markup, refusing to frame');

const viewBox = (m[1].match(/viewBox="([^"]+)"/) || [])[1] || '-16 -32 880 192';

// Re-theme snk's palette variables so the graph matches the card whatever
// colours the action was asked for. Unknown variables are left untouched.
const palette = {
  cs: '#4ec9b0',                 // the snake
  ce: '#363f4a', c0: '#363f4a',  // empty days
  c1: '#1f4d44', c2: '#2a7a6a', c3: '#3aa68e', c4: '#4ec9b0',
};
const inner = m[2].replace(/--(c[s0-4e]):([^;}]+)/g, (all, name) =>
  palette[name] ? `--${name}:${palette[name]}` : all
);

const W = 900;
const H = 300;
const body = `${frame(W, H, 'sn-card')}
  <text class="m lbl r" x="44" y="34" style="animation-delay:.05s">CONTRIBUTION GRAPH &#183; LAST 52 WEEKS</text>
${section(W, '08', 'CONTRIBUTIONS', 44)}
  <text class="m cap r" x="44" y="52" style="animation-delay:.12s">THE SNAKE EATS WHAT I SHIPPED</text>
  <svg data-framed="1" x="10" y="74" width="880" height="192" viewBox="${viewBox}">${inner}</svg>`;

await writeFile(file, svg(W, H, "Animated snake eating this year's contribution graph, one square per day.", body), 'utf8');
console.log('framed assets/snake.svg');
