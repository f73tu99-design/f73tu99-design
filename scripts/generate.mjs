/**
 * Pulls real numbers from the GitHub GraphQL API and renders three themed SVG
 * panels into assets/. Run by .github/workflows/profile-metrics.yml.
 *
 *   GITHUB_TOKEN  required  (the workflow's built-in token is enough)
 *   GH_LOGIN      optional  (defaults to the profile owner)
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { T, esc, nfmt, frame, svg } from './theme.mjs';

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
  <text class="m cap r" x="${W - 24}" y="34" text-anchor="end" style="animation-delay:.05s">LAST 12 MONTHS</text>

  <text class="s r" x="24" y="86" font-size="32" font-weight="650" fill="${T.text}" style="animation-delay:.14s">${nfmt(d.total)}</text>
  <text class="m r" x="24" y="105" font-size="10.5" fill="${T.muted}" style="animation-delay:.20s">contributions</text>

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
  <text class="m lbl r" x="24" y="34" style="animation-delay:.05s">LANGUAGES</text>
  <text class="m cap r" x="${W - 24}" y="34" text-anchor="end" style="animation-delay:.05s">BY BYTES WRITTEN</text>
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
  <text class="m lbl r" x="24" y="34" style="animation-delay:.05s">LANGUAGES</text>
  <text class="m cap r" x="${W - 24}" y="34" text-anchor="end" style="animation-delay:.05s">BY BYTES WRITTEN</text>
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
  const H = 190;
  const days = d.days.slice(-30);
  const max = Math.max(1, ...days.map((x) => x.contributionCount));
  const left = 44;
  const right = W - 44;
  const gap = 5;
  const barW = (right - left - gap * (days.length - 1)) / days.length;
  const baseY = 150;
  const maxH = 74;

  const bars = days
    .map((day, i) => {
      const h = day.contributionCount ? Math.max(3, (day.contributionCount / max) * maxH) : 2;
      const x = left + i * (barW + gap);
      const fill = day.contributionCount ? T.accent : T.line2;
      const op = day.contributionCount ? (0.35 + 0.65 * (day.contributionCount / max)).toFixed(2) : '1';
      return `  <rect class="growY" x="${x.toFixed(1)}" y="${(baseY - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}" fill-opacity="${op}" style="animation-delay:${(0.15 + i * 0.018).toFixed(3)}s"><title>${esc(day.date)}: ${day.contributionCount}</title></rect>`;
    })
    .join('\n');

  const sum = days.reduce((a, x) => a + x.contributionCount, 0);
  const first = days.length ? days[0].date : '';
  const last = days.length ? days[days.length - 1].date : '';

  const body = `${frame(W, H, 'ac-card')}
  <text class="m lbl r" x="${left}" y="40" style="animation-delay:.05s">ACTIVITY &#183; LAST 30 DAYS</text>
  <text class="m cap r" x="${right}" y="40" text-anchor="end" style="animation-delay:.05s">${sum} CONTRIBUTIONS &#183; PEAK ${max}</text>
  <line x1="${left}" y1="${baseY + 1}" x2="${right}" y2="${baseY + 1}" stroke="${T.line}"/>
${bars}
  <text class="m cap r" x="${left}" y="172" style="animation-delay:.6s">${esc(first)}</text>
  <text class="m cap r" x="${right}" y="172" text-anchor="end" style="animation-delay:.6s">${esc(last)}</text>`;

  const aria = `Daily contribution chart for the last 30 days: ${sum} contributions, peak of ${max} in a single day.`;
  return svg(W, H, aria, body);
}

/* -- regression guard --------------------------------------------------
 * The language split is scope-gated: a token without `repo` sees only public
 * repositories, which for a mostly-private account collapses six languages
 * into one. A scheduled run must never quietly replace richer data with
 * poorer data, so we keep a high-water mark in assets/metrics.json and skip
 * the rewrite when the new sample is drastically smaller.
 * ---------------------------------------------------------------------- */
const HIGH_WATER = new URL('metrics.json', OUT);
const EROSION_LIMIT = 0.5; // a >50% drop means the token lost visibility, not that code vanished

async function readHighWater() {
  try {
    return JSON.parse(await readFile(HIGH_WATER, 'utf8'));
  } catch {
    return null; // first run, or the file was removed on purpose
  }
}

/* -- main -------------------------------------------------------------- */
const data = await fetchMetrics();
await mkdir(OUT, { recursive: true });

const prev = await readHighWater();
const langBytes = data.languages.reduce((a, l) => a + l.size, 0);

const eroded =
  prev &&
  prev.langBytes > 0 &&
  langBytes < prev.langBytes * EROSION_LIMIT;

const panels = [
  ['stats.svg', renderStats(data)],
  ['activity.svg', renderActivity(data)],
];

if (eroded) {
  console.warn(
    `! languages.svg NOT rewritten: this token sees ${nfmt(langBytes)} bytes across ` +
      `${data.languages.length} language(s), down from ${nfmt(prev.langBytes)} across ` +
      `${prev.langCount}. That is a visibility drop, not a code change.\n` +
      `  Add a METRICS_TOKEN secret with 'repo' scope to restore the full split. ` +
      `See SETUP.md.`
  );
} else {
  panels.push(['languages.svg', renderLanguages(data)]);
}

for (const [file, content] of panels) {
  await writeFile(new URL(file, OUT), content, 'utf8');
  console.log(`wrote assets/${file}`);
}

// Only ever raise the high-water mark. Recording a degraded sample would let
// the next run treat the erosion as the new normal.
await writeFile(
  HIGH_WATER,
  JSON.stringify(
    {
      langBytes: Math.max(langBytes, prev?.langBytes ?? 0),
      langCount: Math.max(data.languages.length, prev?.langCount ?? 0),
      updated: new Date().toISOString(),
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(
  `\n${LOGIN}: ${data.total} contributions | ${data.repos} repos | ${data.streak}d streak | ` +
    `${data.languages.length} languages (${nfmt(langBytes)} bytes)${eroded ? ' [languages panel preserved]' : ''}`
);
