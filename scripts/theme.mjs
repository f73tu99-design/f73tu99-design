// Shared design tokens. Change ACCENT here and every generated panel follows.
export const T = {
  bg:     '#0d1117',
  panel:  '#11161d',
  line:   '#21262d',
  line2:  '#2d3542',
  text:   '#e6edf3',
  text2:  '#adbac7',
  muted:  '#7d8590',
  dim:    '#636e7b',
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
    .cap{fill:${T.dim};font-size:9.5px;letter-spacing:.04em}
    .val{fill:${T.text};font-size:14.5px}
    .r{animation:fadeUp .7s cubic-bezier(.2,.7,.3,1) both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
    .growX{transform-box:fill-box;transform-origin:left center;animation:growX .9s cubic-bezier(.2,.8,.3,1) both}
    @keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    .growY{transform-box:fill-box;transform-origin:bottom center;animation:growY .8s cubic-bezier(.2,.8,.3,1) both}
    @keyframes growY{from{transform:scaleY(.02)}to{transform:scaleY(1)}}
    @media (prefers-reduced-motion:reduce){*{animation:none !important}}`;

/** Card chrome: background + 1px border, sized to the viewBox. */
export const frame = (w, h, id) => `
  <defs><clipPath id="${id}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14"/></clipPath></defs>
  <g clip-path="url(#${id})"><rect x="0" y="0" width="${w}" height="${h}" fill="${T.bg}"/></g>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="none" stroke="${T.line}"/>`;

export const svg = (w, h, aria, body) =>
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(aria)}">
  <style>${baseCSS()}
  </style>
${body}
</svg>
`;
