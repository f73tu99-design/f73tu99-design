// Shared design tokens. Change ACCENT here and every generated panel follows.
export const T = {
  bg:     '#141a21',
  panel:  '#1c232d',
  line:   '#2b3440',
  line2:  '#38424f',
  text:   '#f0f6fc',
  text2:  '#c9d1d9',
  muted:  '#8b949e',
  dim:    '#7d8590',
  accent: '#4ec9b0',
  mono:   'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace',
  sans:   'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
};

/** XML-escape anything bound for SVG text or attributes. */
export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** 1234 -> "1.2k" ; 1234567 -> "1.2m" */
export const nfmt = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
};

/** The stylesheet every generated panel shares. */
export const baseCSS = () => `
    .m{font-family:${T.mono}} .s{font-family:${T.sans}}
    .lbl{fill:${T.accent};font-size:10px;letter-spacing:.17em;opacity:.8}
    .sec{fill:${T.dim};font-size:10px;letter-spacing:.18em}
    .cap{fill:${T.dim};font-size:9.5px;letter-spacing:.04em}
    .val{fill:${T.text};font-size:14.5px}
    .r{animation:fadeUp .7s cubic-bezier(.2,.7,.3,1) both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
    .growX{transform-box:fill-box;transform-origin:left center;animation:growX .9s cubic-bezier(.2,.8,.3,1) both}
    @keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    .growY{transform-box:fill-box;transform-origin:bottom center;animation:growY .8s cubic-bezier(.2,.8,.3,1) both}
    @keyframes growY{from{transform:scaleY(.02)}to{transform:scaleY(1)}}
    .draw{stroke-dasharray:1200;stroke-dashoffset:1200;animation:draw 1.6s cubic-bezier(.4,0,.2,1) .5s both}
    @keyframes draw{to{stroke-dashoffset:0}}
    .breathe{animation:breathe 3.2s ease-in-out infinite}
    @keyframes breathe{0%,100%{opacity:.55}50%{opacity:1}}
    .glowt{animation:glowt 3.4s ease-in-out infinite}
    @keyframes glowt{0%,100%{opacity:.16}50%{opacity:.42}}
    @media (prefers-reduced-motion:reduce){*{animation:none !important}}`;

/**
 * Card chrome shared by every panel: background, faint dot grid, accent
 * hairline across the top, 1px border, and a glow filter. `id` namespaces the
 * defs so two cards can sit in one document without colliding.
 */
export const frame = (w, h, id) => `
  <defs>
    <clipPath id="${id}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14"/></clipPath>
    <pattern id="${id}-grid" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${T.text}" fill-opacity=".055"/>
    </pattern>
    <linearGradient id="${id}-hl" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${T.accent}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${T.accent}" stop-opacity=".55"/>
      <stop offset="100%" stop-color="${T.accent}" stop-opacity="0"/>
    </linearGradient>
    <filter id="${id}-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <g clip-path="url(#${id})">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${T.bg}"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${id}-grid)"/>
    <rect x="0" y="0" width="${w}" height="1.5" fill="url(#${id}-hl)"/>
  </g>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="none" stroke="${T.line}"/>`;

/** Top-right section index, e.g. section(900, '05', 'SIGNAL'). */
export const section = (w, idx, name, pad = 24) =>
  `  <text class="m sec r" x="${w - pad}" y="34" text-anchor="end" style="animation-delay:.05s">${idx} &#8212; ${esc(name)}</text>`;

export const svg = (w, h, aria, body) =>
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(aria)}">
  <style>${baseCSS()}
  </style>
${body}
</svg>
`;
