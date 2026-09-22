/**
 * Pulls real numbers from the GitHub GraphQL API and renders three themed SVG
 * panels into assets/. Run by .github/workflows/profile-metrics.yml.
 *
 *   GITHUB_TOKEN  required  (the workflow's built-in token is enough)
 *   GH_LOGIN      optional  (defaults to the profile owner)
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { T, esc, nfmt, frame, section, svg } from './theme.mjs';

const LOGIN = process.env.GH_LOGIN || 'f73tu99-design';
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = new URL('../assets/', import.meta.url);

if (!TOKEN) {
  console.error('GITHUB_TOKEN is not set - refusing to run so we do not overwrite good panels with empty ones.');
  process.exit(1);
}

const QUERY = `
query($login:String!, $from:DateTime!, $to:DateTime!) {
  user(login:$login) {
    followers { totalCount }
    repositories(first:100, ownerAffiliations:OWNER, isFork:false, orderBy:{field:PUSHED_AT, direction:DESC}) {
      totalCount
      nodes {
        stargazerCount
        languages(first:12, orderBy:{field:SIZE, direction:DESC}) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection(from:$from, to:$to) {
      restrictedContributionsCount
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function fetchMetrics() {
  const to = new Date();
  const from = new Date(to.getTime() - 364 * 864e5);

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': `${LOGIN}-profile-metrics`,
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { login: LOGIN, from: from.toISOString(), to: to.toISOString() },
    }),
  });

  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  if (!json.data || !json.data.user) throw new Error(`No such user: ${LOGIN}`);

  const u = json.data.user;
  const cc = u.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);

  // Aggregate bytes-per-language across every non-fork repo we own.
  const langs = new Map();
  for (const repo of u.repositories.nodes) {
    for (const edge of repo.languages.edges) {
      const prev = langs.get(edge.node.name) || { size: 0, color: edge.node.color || T.dim };
      prev.size += edge.size;
      langs.set(edge.node.name, prev);
    }
  }

  return {
    login: LOGIN,
    followers: u.followers.totalCount,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    commits: cc.totalCommitContributions,
    prs: cc.totalPullRequestContributions,
    issues: cc.totalIssueContributions,
    reviews: cc.totalPullRequestReviewContributions,
    total: cc.contributionCalendar.totalContributions,
    // GitHub reports private work only as an opaque aggregate. Surfacing the
    // split is honest; showing "0 commits" next to "2812 contributions" is not.
    restricted: cc.restrictedContributionsCount,
    publicContrib: Math.max(0, cc.contributionCalendar.totalContributions - cc.restrictedContributionsCount),
    streak: currentStreak(days),
    days,
    languages: [...langs.entries()]
      .map(([name, v]) => ({ name, size: v.size, color: v.color }))
      .sort((a, b) => b.size - a.size),
  };
}

/**
 * Days up to and including today with at least one contribution. An empty
 * today does not break the streak - the day is not over yet.
 */
function currentStreak(days) {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) n++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return n;
}

/* -- panel 1: headline stats ------------------------------------------ */
function renderStats(d) {
  const W = 440;
  const H = 224;
  const barW = W - 48;

  // Split bar. Guard against a zero total so the bar never renders as NaN.
  const pubFrac = d.total ? d.publicContrib / d.total : 0;
  const pubW = Math.round(barW * pubFrac);
  const privW = barW - pubW;

  // Only itemised counts GitHub will actually populate are worth a cell.
  // Private work is reported as an aggregate, so it gets the split bar instead.
  const cells = [
    ['repos', nfmt(d.repos)],
    ['stars', nfmt(d.stars)],
    ['followers', nfmt(d.followers)],
  ];

  const grid = cells
    .map(([label, value], i) => {
      const x = 24 + i * 136;
      return `  <g class="r" style="animation-delay:${(0.36 + i * 0.06).toFixed(2)}s">
    <text class="m val" x="${x}" y="196">${esc(value)}</text>
    <text class="m cap" x="${x}" y="211">${esc(label)}</text>
  </g>`;
    })
    .join('\n');

  const body = `${frame(W, H, 'st-card')}
  <text class="m lbl r" x="24" y="34" style="animation-delay:.05s">GITHUB SIGNAL</text>
${section(W, '05', 'SIGNAL')}

  <text class="s glowt" x="24" y="86" font-size="32" font-weight="650" fill="${T.accent}" filter="url(#st-card-glow)">${nfmt(d.total)}</text>
  <text class="s r" x="24" y="86" font-size="32" font-weight="650" fill="${T.text}" style="animation-delay:.14s">${nfmt(d.total)}</text>
  <text class="m r" x="24" y="105" font-size="10.5" fill="${T.muted}" style="animation-delay:.20s">contributions &#183; last 12 months</text>

  <g class="r" style="animation-delay:.24s">
    <rect x="${W - 140}" y="60" width="116" height="30" rx="8" fill="${T.panel}" stroke="${T.line}"/>
    <text class="m" x="${W - 126}" y="79" font-size="11" fill="${T.accent}">${d.streak}</text>
    <text class="m" x="${W - 126 + String(d.streak).length * 7.2 + 7}" y="79" font-size="10" fill="${T.muted}">day streak</text>
  </g>

  <rect x="24" y="126" width="${barW}" height="6" rx="3" fill="${T.panel}"/>
  <g clip-path="url(#st-bar)">
    <rect class="growX" x="24" y="126" width="${privW}" height="6" fill="${T.accent}" fill-opacity=".38" style="animation-delay:.26s"/>
    <rect class="growX" x="${24 + privW}" y="126" width="${pubW}" height="6" fill="${T.accent}" style="animation-delay:.34s"/>
  </g>
  <defs><clipPath id="st-bar"><rect x="24" y="126" width="${barW}" height="6" rx="3"/></clipPath></defs>

  <g class="r" style="animation-delay:.30s">
    <circle cx="28" cy="150" r="3.5" fill="${T.accent}" fill-opacity=".38"/>
    <text class="m" x="38" y="154" font-size="10.5" fill="${T.muted}">${nfmt(d.restricted)} private</text>
    <circle cx="150" cy="150" r="3.5" fill="${T.accent}"/>
    <text class="m" x="160" y="154" font-size="10.5" fill="${T.muted}">${nfmt(d.publicContrib)} public</text>
  </g>

  <line x1="24" y1="170" x2="${W - 24}" y2="170" stroke="${T.line}"/>
${grid}`;

  const aria = `GitHub statistics for ${d.login}: ${d.total} contributions in the last 12 months, of which ${d.restricted} are private and ${d.publicContrib} public. ${d.repos} repositories, ${d.stars} stars, ${d.followers} followers, ${d.streak} day streak.`;
  return svg(W, H, aria, body);
}

/* -- panel 2: language split ------------------------------------------ */
function renderLanguages(d) {
  const W = 440;
  const H = 224;
  const top = d.languages.slice(0, 6);
  const sum = top.reduce((a, l) => a + l.size, 0);

  if (!sum) {
    const body = `${frame(W, H, 'lg-card')}
  <text class="m lbl r" x="24" y="34" style="animation-delay:.05s">LANGUAGES &#183; BY BYTES</text>
${section(W, '06', 'LANGUAGES')}
  <rect x="24" y="56" width="${W - 48}" height="10" rx="5" fill="${T.panel}"/>
  <text class="m r" x="24" y="110" font-size="12" fill="${T.muted}" style="animation-delay:.18s">no public code yet</text>
  <text class="m r" x="24" y="130" font-size="10.5" fill="${T.dim}" style="animation-delay:.24s">this panel fills itself in on your first public push</text>`;
    return svg(W, H, 'Language breakdown: no public repositories yet.', body);
  }

  const barW = W - 48;
  let x = 24;
  const segs = top
    .map((l, i) => {
      const w = Math.max(3, (l.size / sum) * barW);
      const seg = `    <rect class="growX" x="${x.toFixed(1)}" y="56" width="${w.toFixed(1)}" height="10" fill="${esc(l.color)}" style="animation-delay:${(0.18 + i * 0.07).toFixed(2)}s"/>`;
      x += w;
      return seg;
    })
    .join('\n');

  const legend = top
    .map((l, i) => {
      const cx = 24 + (i % 2) * 200;
      const cy = 104 + Math.floor(i / 2) * 32;
      const pct = ((l.size / sum) * 100).toFixed(1);
      return `  <g class="r" style="animation-delay:${(0.32 + i * 0.05).toFixed(2)}s">
    <circle cx="${cx + 4}" cy="${cy - 4}" r="4" fill="${esc(l.color)}"/>
    <text class="m" x="${cx + 16}" y="${cy}" font-size="11.5" fill="${T.text2}">${esc(l.name)}</text>
    <text class="m" x="${cx + 176}" y="${cy}" font-size="11" fill="${T.dim}" text-anchor="end">${pct}%</text>
  </g>`;
    })
    .join('\n');

  const body = `${frame(W, H, 'lg-card')}
  <defs><clipPath id="lg-bar"><rect x="24" y="56" width="${barW}" height="10" rx="5"/></clipPath></defs>
  <text class="m lbl r" x="24" y="34" style="animation-delay:.05s">LANGUAGES &#183; BY BYTES</text>
${section(W, '06', 'LANGUAGES')}
  <rect x="24" y="56" width="${barW}" height="10" rx="5" fill="${T.panel}"/>
  <g clip-path="url(#lg-bar)">
${segs}
  </g>
${legend}`;

  const aria = `Language breakdown for ${d.login}: ${top.map((l) => `${l.name} ${((l.size / sum) * 100).toFixed(0)} percent`).join(', ')}.`;
  return svg(W, H, aria, body);
}

/* -- panel 3: last 30 days -------------------------------------------- */
function renderActivity(d) {
  const W = 900;
  const H = 212;
  const days = d.days.slice(-30);
  const max = Math.max(1, ...days.map((x) => x.contributionCount));
  const left = 44;
  const right = W - 44;
  const gap = 5;
  const barW = (right - left - gap * (days.length - 1)) / days.length;
  const baseY = 168;
  const maxH = 84;
  const xOf = (i) => left + i * (barW + gap);
  const geom = days.map((day, i) => {
    const c = day.contributionCount;
    const h = c ? Math.max(3, (c / max) * maxH) : 2;
    return { c, x: xOf(i).toFixed(1), y: (baseY - h).toFixed(1), w: barW.toFixed(1), h: h.toFixed(1) };
  });

  const bars = geom
    .map((g, i) => {
      const fill = g.c ? 'url(#ac-bar)' : T.line2;
      const op = g.c ? (0.45 + 0.55 * (g.c / max)).toFixed(2) : '1';
      return `  <rect class="growY" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="3" fill="${fill}" fill-opacity="${op}" style="animation-delay:${(0.15 + i * 0.018).toFixed(3)}s"><title>${esc(days[i].date)}: ${g.c}</title></rect>`;
    })
    .join('\n');

  // Same geometry, no animation: a clip so the shimmer only lights the bars.
  const barClip = geom.map((g) => `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="3"/>`).join('');

  const sum = days.reduce((a, x) => a + x.contributionCount, 0);

  // 7-day trailing mean, looking back into the full year so the first points
  // of the window are not artificially low.
  const all = d.days;
  const start = all.length - days.length;
  const pts = days.map((_, i) => {
    const idx = start + i;
    const win = all.slice(Math.max(0, idx - 6), idx + 1);
    const v = win.reduce((a, x) => a + x.contributionCount, 0) / win.length;
    return [xOf(i) + barW / 2, baseY - (v / max) * maxH];
  });
  const avgPath = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = pts.length
    ? `${avgPath} L${pts[pts.length - 1][0].toFixed(1)} ${baseY} L${pts[0][0].toFixed(1)} ${baseY} Z`
    : '';
  const [ex, ey] = pts.length ? pts[pts.length - 1] : [right, baseY];

  // Peak callout above the tallest bar.
  const peakIdx = days.findIndex((x) => x.contributionCount === max);
  let peak = '';
  if (peakIdx >= 0 && days[peakIdx].contributionCount > 0) {
    const px = xOf(peakIdx) + barW / 2;
    const top = baseY - maxH;
    const w = 14 + String(max).length * 7;
    peak = `  <g class="r" style="animation-delay:.95s">
    <line x1="${px.toFixed(1)}" y1="${(top - 4).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(top - 10).toFixed(1)}" stroke="${T.accent}" stroke-opacity=".6"/>
    <rect x="${(px - w / 2).toFixed(1)}" y="${(top - 26).toFixed(1)}" width="${w}" height="16" rx="8" fill="${T.panel}" stroke="${T.accent}" stroke-opacity=".6"/>
    <text class="m" x="${px.toFixed(1)}" y="${(top - 14.5).toFixed(1)}" font-size="9.5" fill="${T.accent}" text-anchor="middle">${max}</text>
  </g>`;
  }

  const fmt = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const first = days.length ? fmt(days[0].date) : '';
  const last = days.length ? fmt(days[days.length - 1].date) : '';

  const body = `${frame(W, H, 'ac-card')}
  <defs>
    <linearGradient id="ac-bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.accent}"/><stop offset="100%" stop-color="${T.accent}" stop-opacity=".35"/>
    </linearGradient>
    <linearGradient id="ac-area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.accent}" stop-opacity=".22"/><stop offset="100%" stop-color="${T.accent}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ac-shine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${T.text}" stop-opacity="0"/><stop offset="50%" stop-color="${T.text}" stop-opacity=".45"/><stop offset="100%" stop-color="${T.text}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="ac-bars">${barClip}</clipPath>
  </defs>
  <style>
    .shine{animation:shine 7s linear 1.2s infinite}
    @keyframes shine{from{transform:translateX(0)}to{transform:translateX(${W + 160}px)}}
    .pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.4s ease-out infinite}
    @keyframes pulse{0%{transform:scale(.5);opacity:.75}100%{transform:scale(2.8);opacity:0}}
  </style>
  <text class="m lbl r" x="${left}" y="34" style="animation-delay:.05s">ACTIVITY &#183; LAST 30 DAYS</text>
${section(W, '07', 'ACTIVITY', 44)}
  <text class="m cap r" x="${left}" y="52" style="animation-delay:.12s">${sum} CONTRIBUTIONS &#183; PEAK ${max} &#183; </text>
  <line class="r" x1="${left + 236}" y1="49" x2="${left + 254}" y2="49" stroke="${T.accent}" stroke-width="1.6" style="animation-delay:.12s"/>
  <text class="m cap r" x="${left + 260}" y="52" style="animation-delay:.12s">7-DAY AVERAGE</text>
  <line x1="${left}" y1="${baseY + 1}" x2="${right}" y2="${baseY + 1}" stroke="${T.line}"/>
${bars}
  <rect class="shine" x="-160" y="${baseY - maxH - 30}" width="160" height="${maxH + 32}" fill="url(#ac-shine)" clip-path="url(#ac-bars)"/>
  <path class="r" d="${areaPath}" fill="url(#ac-area)" style="animation-delay:.9s"/>
  <path d="${avgPath}" fill="none" stroke="${T.accent}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" opacity=".18" filter="url(#ac-card-glow)"/>
  <path class="draw" d="${avgPath}" fill="none" stroke="${T.accent}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>
  <circle class="pulse" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4" fill="${T.accent}"/>
  <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3" fill="${T.accent}"/>
${peak}
  <text class="m cap r" x="${left}" y="192" style="animation-delay:.6s">${esc(first)}</text>
  <text class="m cap r" x="${right}" y="192" text-anchor="end" style="animation-delay:.6s">${esc(last)}</text>`;

  const aria = `Daily contribution chart for the last 30 days: ${sum} contributions, peak of ${max} in a single day.`;
  return svg(W, H, aria, body);
}

/* -- regression guard --------------------------------------------------
 * Anything sourced from `repositories(ownerAffiliations: OWNER)` is scope-
 * gated: a token without `repo` sees only public repositories. For a mostly-
 * private account that collapses the language split, the repo count and the
 * star count all at once, and a scheduled run would commit the wreckage.
 *
 * Contribution figures are NOT affected - the calendar total and
 * restrictedContributionsCount are visible to the plain Actions token - so
 * those always use fresh data.
 *
 * We keep a high-water mark in assets/metrics.json. A drastic drop in
 * language bytes is the tell-tale that this token lost visibility, and when
 * we see it we fall back to the stored figures for every gated field rather
 * than publishing the smaller ones.
 * ---------------------------------------------------------------------- */
const HIGH_WATER = new URL('metrics.json', OUT);
const EROSION_LIMIT = 0.5; // a >50% drop is lost visibility, not deleted code

async function readHighWater() {
  try {
    return JSON.parse(await readFile(HIGH_WATER, 'utf8'));
  } catch {
    return null; // first run, or the file was deliberately removed to re-baseline
  }
}

/* -- main -------------------------------------------------------------- */
const data = await fetchMetrics();
await mkdir(OUT, { recursive: true });

const prev = await readHighWater();
const langBytes = data.languages.reduce((a, l) => a + l.size, 0);
const scopeLimited = Boolean(prev && prev.langBytes > 0 && langBytes < prev.langBytes * EROSION_LIMIT);

if (scopeLimited) {
  console.warn(
    `! This token sees ${nfmt(langBytes)} bytes across ${data.languages.length} language(s), ` +
      `down from ${nfmt(prev.langBytes)} across ${prev.langCount}.\n` +
      `  That is a visibility drop, not a code change - it can only see public repos.\n` +
      `  Keeping the stored figures for repos/stars and leaving languages.svg alone.\n` +
      `  Add a METRICS_TOKEN secret with 'repo' scope to restore the full picture. See SETUP.md.`
  );
  // Publish the richer known-good figures instead of this token's narrow view.
  data.repos = prev.repos ?? data.repos;
  data.stars = prev.stars ?? data.stars;
}

const panels = [
  ['stats.svg', renderStats(data)],
  ['activity.svg', renderActivity(data)],
];
if (!scopeLimited) panels.push(['languages.svg', renderLanguages(data)]);

for (const [file, content] of panels) {
  await writeFile(new URL(file, OUT), content, 'utf8');
  console.log(`wrote assets/${file}`);
}

// Only ever raise the marks. Recording a degraded sample would let the next
// run treat the erosion as the new normal.
const mark = {
  langBytes: Math.max(langBytes, prev?.langBytes ?? 0),
  langCount: Math.max(data.languages.length, prev?.langCount ?? 0),
  repos: Math.max(data.repos, prev?.repos ?? 0),
  stars: Math.max(data.stars, prev?.stars ?? 0),
};
// Only touch the file when a mark actually moves. Rewriting a timestamp every
// run would produce an empty commit four times a day and collide with any
// local push - the workflow's "nothing to commit" path depends on this.
const markMoved = !prev || ['langBytes', 'langCount', 'repos', 'stars'].some((k) => mark[k] !== prev[k]);
if (markMoved) {
  await writeFile(HIGH_WATER, JSON.stringify({ ...mark, updated: new Date().toISOString() }, null, 2) + '\n', 'utf8');
  console.log('raised high-water mark in assets/metrics.json');
}

console.log(
  `\n${LOGIN}: ${data.total} contributions | ${data.repos} repos | ${data.streak}d streak | ` +
    `${data.languages.length} languages (${nfmt(langBytes)} bytes)` +
    (scopeLimited ? ' [scope-limited: gated figures preserved]' : '')
);
