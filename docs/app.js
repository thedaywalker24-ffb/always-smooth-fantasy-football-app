const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwtM_NX16wFOHssvhvP2Iw7FI_7YcVgJ9-5DNbvNOblMxifawE4R-F_eiOLU1NsEggF/exec';
const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=600&auto=format&fit=crop';
const THEME_KEY = 'theme';
const CONFIG_CACHE_KEY = 'always-smooth-config';
const DATA_CACHE_KEY = 'always-smooth-league-data';
const BETTING_BET_COUNT = 6;
const DEFAULT_CONFIG = {
  appName: 'Always Smooth',
  appShortName: 'Always Smooth',
  appThemeColor: '#ec4899',
  leagueSeason: '',
  leagueWeek: '',
  headerImageSrc: FALLBACK_PHOTO
};

let deferredInstallPrompt = null;
let lastScrollTop = 0;
const splashStartedAt = Date.now();
const SPLASH_MIN_DURATION = 900;
const ADMIN_EDIT_HOLD_MS = 850;
let adminEditTimer = null;
let adminEditActivated = false;
let adminEditStart = null;
let adminCodeCache = '';
let bettingData = null;
let selectedBettingMemberRow = null;
let bettingStatusMessage = '';
let bettingStatusTone = 'warning';
let activeBettingTeamSelect = null;

function getCachedJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to parse cached value for', key, error);
    return null;
  }
}

function setCachedJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to cache value for', key, error);
  }
}

function buildApiUrl(apiName, params = {}) {
  const url = new URL(API_BASE_URL);
  if (apiName) {
    url.searchParams.set('api', apiName.replace(/^\//, ''));
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

function fetchJsonp(path, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `alwaysSmoothJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
      clearTimeout(timeoutId);
    };

    const routeMap = {
      'api/config': 'config',
      'api/league-data': 'league-data',
      'api/betting-data': 'betting-data',
      'api/update-team-field': 'update-team-field',
      'api/submit-bets': 'submit-bets'
    };
    const route = routeMap[path] || path.replace(/^\//, '');
    const url = buildApiUrl(route, { ...params, callback: callbackName });
    const timeoutMsByRoute = {
      'betting-data': 30000,
      'submit-bets': 45000,
      'update-team-field': 45000
    };
    const timeoutMs = timeoutMsByRoute[route] || 15000;

    script.src = url.toString();
    script.async = true;

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out loading ${path}`));
    }, timeoutMs);

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load ${path}`));
    };

    document.head.appendChild(script);
  });
}

function applyTheme(theme) {
  const html = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  html.classList.remove('dark');
  if (theme === 'dark' || (theme === 'system' && prefersDark)) {
    html.classList.add('dark');
  }
}

function updateThemeButtons(activeTheme) {
  document.querySelectorAll('.theme-btn').forEach((button) => {
    const isActive = button.dataset.theme === activeTheme;
    button.classList.toggle('bg-pink-50', isActive);
    button.classList.toggle('dark:bg-pink-500/10', isActive);
    button.classList.toggle('ring-1', isActive);
    button.classList.toggle('ring-pink-500/50', isActive);
    button.classList.toggle('scale-110', isActive);
    button.classList.toggle('text-pink-500', isActive);
    button.classList.toggle('text-slate-400', !isActive);
  });
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  updateThemeButtons(theme);
}

function setBanner(message, tone = 'warning') {
  const container = document.getElementById('status-banner');
  const card = container.firstElementChild;
  if (!message) {
    container.hidden = true;
    card.textContent = '';
    return;
  }

  container.hidden = false;
  card.textContent = message;
  const classes = tone === 'error'
    ? 'rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
    : 'rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100';
  card.className = classes;
}

async function dismissSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash || splash.classList.contains('is-hidden')) return;

  const elapsed = Date.now() - splashStartedAt;
  if (elapsed < SPLASH_MIN_DURATION) {
    await new Promise((resolve) => window.setTimeout(resolve, SPLASH_MIN_DURATION - elapsed));
  }

  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 450);
}

function formatTimestamp(value) {
  if (!value) return 'Sync pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sync pending';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTargetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfTargetDay) / 86400000);
  const timeLabel = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) return `Updated Today at ${timeLabel}`;
  if (diffDays === 1) return `Updated Yesterday at ${timeLabel}`;

  const dayLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `Updated ${dayLabel} at ${timeLabel}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function applyConfig(config) {
  if (!config) return;
  const leagueSeason = String(config.leagueSeason || '').trim();
  const leagueWeek = String(config.leagueWeek || '').trim();
  document.title = `${config.appName || 'Always Smooth'} ${leagueSeason}`.trim();
  document.querySelector('meta[name="theme-color"]').setAttribute('content', config.appThemeColor || '#ec4899');
  document.getElementById('page-title').textContent = config.appShortName || 'Always Smooth';
  document.getElementById('season-pill').textContent = `Season ${leagueSeason || '--'}`;
  document.getElementById('week-pill').textContent = `Week ${leagueWeek || '--'}`;
  const banner = document.getElementById('league-banner');
  banner.src = config.headerImageSrc || FALLBACK_PHOTO;
  banner.onerror = () => {
    banner.src = FALLBACK_PHOTO;
    banner.onerror = null;
  };
}

function renderSkeleton() {
  const grid = document.getElementById('standings-grid');
  grid.innerHTML = `
    <div class="glass-panel rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm dark:border-pink-500/10 dark:bg-slate-900/70 lg:col-span-3">
      <div class="animate-pulse">
        <div class="flex items-center gap-4">
          <div class="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-800"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800"></div>
            <div class="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}
function parseRecord(record) {
  const [winsRaw, lossesRaw, tiesRaw] = String(record || '0-0').split('-');
  const wins = Number.parseInt(winsRaw, 10) || 0;
  const losses = Number.parseInt(lossesRaw, 10) || 0;
  const ties = Number.parseInt(tiesRaw, 10) || 0;
  const games = wins + losses + ties;
  return { wins, losses, ties, games };
}

function formatWinPct(record) {
  const { wins, ties, games } = parseRecord(record);
  if (!games) return '.000';
  const pct = ((wins + (ties * 0.5)) / games).toFixed(3);
  return pct.startsWith('0') ? pct.slice(1) : pct;
}

function formatPointsPace(pointsFor, record) {
  const { games } = parseRecord(record);
  if (!games) return '0.00';
  return (Number(pointsFor || 0) / games).toFixed(2);
}

function formatPointsBehindLeader(pointsFor, leaderPoints) {
  const gap = Number(leaderPoints || 0) - Number(pointsFor || 0);
  if (gap <= 0.005) return 'Leader';
  return `-${gap.toFixed(2)}`;
}

function buildTeamInsight(team, index, leaderPoints) {
  const summary = parseRecord(team.record);
  const tiesText = summary.ties ? `, and ${summary.ties} tie${summary.ties === 1 ? '' : 's'}` : '';
  const gapText = index === 0
    ? 'sets the scoring pace for the league right now.'
    : `is ${formatPointsBehindLeader(team.pointsFor, leaderPoints).replace('-', '')} points off the league lead.`;
  return `${summary.wins} win${summary.wins === 1 ? '' : 's'}, ${summary.losses} loss${summary.losses === 1 ? '' : 'es'}${tiesText} through ${summary.games} game${summary.games === 1 ? '' : 's'} and ${gapText}`;
}

function renderTeams(payload, isStale = false) {
  const grid = document.getElementById('standings-grid');
  const teams = Array.isArray(payload?.teams) ? payload.teams : [];
  const leaderPoints = Number(teams[0]?.pointsFor || 0);
  document.getElementById('updated-at').textContent = formatTimestamp(payload?.updatedAt);

  if (!teams.length) {
    grid.innerHTML = `
      <div class="glass-panel rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm dark:border-pink-500/10 dark:bg-slate-900/70 lg:col-span-3">
        <p class="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">No standings available yet</p>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Refresh the spreadsheet data, then try again.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = teams.map((team, index) => {
    const photoUrl = team.photoUrl || FALLBACK_PHOTO;
    const ownerName = team.realName || 'Owner not set';
    const streakValue = team.streak || 'None';
    const pointsFor = Math.round(Number(team.pointsFor || 0));
    const recordWithStreak = streakValue !== 'None' ? `${team.record} (${streakValue})` : team.record;
    const sleeperTeamImageUrl = team.sleeperTeamImageUrl || '';
    const teamMvpName = team.teamMvpName || 'Not set';
    const teamMvpImageUrl = team.teamMvpImageUrl || '';
    const trophies = String(team.trophies || '').trim();
    const ownerTrophiesMarkup = trophies ? `<span class="shrink-0">${escapeHtml(trophies)}</span>` : '';
    const turkeyWatch = team.turkeyWatch || 'None';
    const beerTrophiesValue = String(team.beerTrophies || '').trim();
    const beerTrophies = beerTrophiesValue || 'None';
    const mulliganLabel = team.mulligan ? '✅' : '❎';
    const teamPanelId = `team-panel-${index}`;
    const teamInsight = buildTeamInsight(team, index, leaderPoints);
    const teamExpandCardStyle = sleeperTeamImageUrl
      ? `style="background-image: url('${sleeperTeamImageUrl.replace(/'/g, '%27')}');"`
      : '';
    return `
      <article class="owner-tile glass-panel group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm hover:border-pink-500/40 hover:shadow-xl dark:border-pink-500/10 dark:bg-slate-900/70" data-team-tile data-expanded="false">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-rose-400 to-orange-300"></div>
        <div class="team-card-shell">
          <div class="relative z-10 flex items-start gap-4">
            <div class="relative shrink-0">
              <img src="${photoUrl}" class="manager-photo" alt="${team.teamName}" onerror="this.src='${FALLBACK_PHOTO}';this.onerror=null;">
              <div class="absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-slate-900 px-1.5 text-[10px] font-black text-white shadow-sm dark:border-slate-900 dark:bg-pink-500">${index + 1}</div>
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-lg font-black italic uppercase leading-none tracking-tight text-slate-900 transition-colors group-hover:text-pink-500 dark:text-white">${team.teamName}</h3>
              <p class="mt-2 flex min-w-0 items-center gap-1 text-sm font-semibold text-pink-500 dark:text-pink-400"><span class="truncate">${ownerName}</span>${ownerTrophiesMarkup}</p>
            </div>
          </div>

          <button type="button" class="team-seam-button relative z-10" data-team-toggle aria-expanded="false" aria-controls="${teamPanelId}" aria-label="Toggle more stats for ${team.teamName}">
            <span class="team-seam-line">
              <span class="sr-only">Toggle more team stats</span>
            </span>
          </button>

          <div id="${teamPanelId}" class="team-expand-panel relative z-10" data-team-panel aria-hidden="true">
            <div class="team-expand-panel__inner">
              <div class="team-expand-card rounded-[1.5rem] p-4" ${teamExpandCardStyle}>
                <div class="team-expand-content">
                <div class="team-expand-stats">
                  <div class="team-stat-row">
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-pink-500/80">Team MVP</p>
                      <p class="mt-1 text-sm font-black text-slate-950 dark:text-white">${teamMvpName}</p>
                    </div>
                    <div class="shrink-0">
                      ${teamMvpImageUrl
                        ? `<img src="${teamMvpImageUrl}" alt="${team.teamName} MVP" class="team-mvp-image" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');">
                           <span class="hidden text-sm font-black text-slate-500 dark:text-white/70">N/A</span>`
                        : `<span class="text-sm font-black text-slate-500 dark:text-white/70">N/A</span>`}
                    </div>
                  </div>
                  <div class="team-stat-row">
                    <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-pink-500/80">Mulligan</p>
                    <p class="text-base font-black text-slate-950 dark:text-white">${mulliganLabel}</p>
                  </div>
                  <div class="team-stat-row">
                    <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-pink-500/80">Turkey Watch</p>
                    <p class="text-base font-black text-slate-950 dark:text-white">${turkeyWatch}</p>
                  </div>
                  <div class="team-stat-row" data-admin-edit-field="beerTrophies" data-admin-edit-label="Beer Trophies" data-team-name="${escapeHtml(team.teamName)}" data-current-value="${escapeHtml(beerTrophiesValue)}" title="Press and hold to edit Beer Trophies">
                    <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-pink-500/80">Beer Trophies</p>
                    <p class="text-base font-black text-slate-950 dark:text-white">${escapeHtml(beerTrophies)}</p>
                  </div>
                </div>
                <p class="pt-4 text-xs font-semibold leading-relaxed text-slate-600 dark:text-white/80">${ownerName} has ${teamInsight}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="relative z-10 mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Record</p>
              <p class="text-sm font-black text-slate-700 dark:text-slate-200">${recordWithStreak}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">PF</p>
              <p class="text-sm font-black text-slate-700 dark:text-slate-200">${pointsFor}</p>
            </div>
          </div>
        </div>
        <div class="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-pink-500/5 transition-colors group-hover:bg-pink-500/10"></div>
      </article>
    `;
  }).join('');

  if (isStale) {
    setBanner('Showing the most recent cached standings because the live data request failed.');
  }
}

function setExpandedTeamTile(tile, expanded) {
  if (!tile) return;
  const toggle = tile.querySelector('[data-team-toggle]');
  const panel = tile.querySelector('[data-team-panel]');
  tile.dataset.expanded = expanded ? 'true' : 'false';
  if (toggle) {
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
  if (panel) {
    panel.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  }
}

function setupStandingsAccordion() {
  const grid = document.getElementById('standings-grid');
  if (!grid || grid.dataset.accordionBound === 'true') return;

  grid.dataset.accordionBound = 'true';
  const toggleTile = (tile) => {
    if (!tile) return;
    const shouldExpand = tile.dataset.expanded !== 'true';
    grid.querySelectorAll('[data-team-tile][data-expanded="true"]').forEach((openTile) => {
      if (openTile !== tile) {
        setExpandedTeamTile(openTile, false);
      }
    });
    setExpandedTeamTile(tile, shouldExpand);
  };

  grid.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-team-toggle]');
    if (toggle) {
      toggleTile(toggle.closest('[data-team-tile]'));
      return;
    }

    const tile = event.target.closest('[data-team-tile]');
    if (!tile || event.target.closest('a, button, input, select, textarea, summary')) return;
    toggleTile(tile);
  });
}

function clearAdminEditTimer() {
  if (adminEditTimer) {
    window.clearTimeout(adminEditTimer);
    adminEditTimer = null;
  }
  adminEditStart = null;
}

function getAdminCode() {
  if (adminCodeCache) return adminCodeCache;
  const entered = window.prompt('Enter the Always Smooth admin code to update league data.');
  if (entered === null) return '';
  adminCodeCache = entered.trim();
  return adminCodeCache;
}

async function updateEditableTeamField(target) {
  if (!target) return;
  const teamName = target.dataset.teamName || '';
  const field = target.dataset.adminEditField || '';
  const label = target.dataset.adminEditLabel || 'Team Field';
  const currentValue = target.dataset.currentValue || '';
  const adminCode = getAdminCode();
  if (!adminCode) return;

  const nextValue = window.prompt(`Update ${label} for ${teamName}`, currentValue);
  if (nextValue === null) return;

  target.setAttribute('aria-busy', 'true');
  setBanner(`Updating ${label} for ${teamName}...`);

  try {
    const payload = await fetchJsonp('api/update-team-field', {
      teamName,
      field,
      value: nextValue.trim(),
      adminCode
    });
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Update failed.');
    }

    await loadStandings();
    setBanner(`${label} updated for ${teamName}.`);
  } catch (error) {
    console.error(error);
    if (/admin code/i.test(error.message || '')) {
      adminCodeCache = '';
    }
    setBanner(`Update failed: ${error.message || error}`, 'error');
  } finally {
    target.removeAttribute('aria-busy');
  }
}

function setupAdminEditing() {
  const grid = document.getElementById('standings-grid');
  if (!grid || grid.dataset.adminEditingBound === 'true') return;

  grid.dataset.adminEditingBound = 'true';
  grid.addEventListener('pointerdown', (event) => {
    const target = event.target.closest('[data-admin-edit-field]');
    if (!target || (event.pointerType === 'mouse' && event.button !== 0)) return;

    clearAdminEditTimer();
    adminEditActivated = false;
    adminEditStart = {
      x: event.clientX,
      y: event.clientY
    };
    adminEditTimer = window.setTimeout(() => {
      adminEditTimer = null;
      adminEditActivated = true;
      updateEditableTeamField(target);
    }, ADMIN_EDIT_HOLD_MS);
  });

  grid.addEventListener('pointermove', (event) => {
    if (!adminEditStart) return;
    const movedX = Math.abs(event.clientX - adminEditStart.x);
    const movedY = Math.abs(event.clientY - adminEditStart.y);
    if (movedX > 12 || movedY > 12) {
      clearAdminEditTimer();
    }
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
    grid.addEventListener(eventName, clearAdminEditTimer);
  });

  grid.addEventListener('contextmenu', (event) => {
    if (event.target.closest('[data-admin-edit-field]')) {
      event.preventDefault();
    }
  });

  grid.addEventListener('click', (event) => {
    if (!adminEditActivated || !event.target.closest('[data-admin-edit-field]')) return;
    event.preventDefault();
    event.stopPropagation();
    adminEditActivated = false;
  }, true);
}
async function loadConfig() {
  const cached = getCachedJson(CONFIG_CACHE_KEY);
  if (cached) applyConfig(cached);

  const config = await fetchJsonp('api/config');
  setCachedJson(CONFIG_CACHE_KEY, config);
  applyConfig(config);
  return config;
}

async function loadStandings() {
  renderSkeleton();
  setBanner('');
  try {
    const payload = await fetchJsonp('api/league-data');
    setCachedJson(DATA_CACHE_KEY, payload);
    renderTeams(payload);
  } catch (error) {
    console.error(error);
    const cached = getCachedJson(DATA_CACHE_KEY);
    if (cached) {
      renderTeams(cached, true);
      return;
    }
    setBanner('Live standings could not be loaded from Apps Script. Double-check that the web app deployment is still live and shared for public access.', 'error');
    renderTeams({ teams: [], updatedAt: '' });
  }
}

function getBettingStatusClass(tone = 'warning') {
  const base = 'rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm';
  if (tone === 'error') {
    return `${base} border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100`;
  }
  if (tone === 'success') {
    return `${base} border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100`;
  }
  return `${base} border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100`;
}

function getBettingStatusMarkup() {
  const hidden = bettingStatusMessage ? '' : ' hidden';
  return `<div id="betting-status"${hidden} class="${getBettingStatusClass(bettingStatusTone)}">${escapeHtml(bettingStatusMessage)}</div>`;
}

function setBettingStatus(message, tone = 'warning') {
  bettingStatusMessage = message || '';
  bettingStatusTone = tone;
  const status = document.getElementById('betting-status');
  if (!status) return;

  if (!bettingStatusMessage) {
    status.hidden = true;
    status.textContent = '';
    return;
  }

  status.hidden = false;
  status.className = getBettingStatusClass(tone);
  status.textContent = bettingStatusMessage;
}

function getBettingRoot() {
  return document.getElementById('betting-root');
}

function getBettingWeekLabel() {
  return `Week ${bettingData?.week || '--'} Bets`;
}

function getMemberInitials(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'AS';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function normalizeMemberNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeBettingOptionKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isBettingTeamChoiceKey(value) {
  const key = normalizeBettingOptionKey(value);
  return [
    'teamchoice',
    'teamchoices',
    'teamoption',
    'teamoptions',
    'teams',
    'managerchoice',
    'managerchoices',
    'manageroption',
    'manageroptions',
    'managers'
  ].includes(key);
}

function getBettingMemberByName(name) {
  if (!bettingData || !Array.isArray(bettingData.members)) return null;
  const key = normalizeMemberNameKey(name);
  return bettingData.members.find((member) => normalizeMemberNameKey(member.name) === key) || null;
}

function getBettingMemberAvatarMarkup(member, size = 'default') {
  const isLarge = size === 'large';
  const isTiny = size === 'tiny';
  const sizeClass = isLarge ? 'large' : isTiny ? 'tiny' : '';
  const initialsClass = `betting-member-initials${sizeClass ? ` betting-member-initials--${sizeClass}` : ''}`;
  const imageClass = `betting-member-photo${sizeClass ? ` betting-member-photo--${sizeClass}` : ''}`;
  const initials = escapeHtml(getMemberInitials(member?.name));
  const fallback = `<span class="${initialsClass}" aria-hidden="true">${initials}</span>`;
  if (!member?.photoUrl) return fallback;

  return `
    <span class="relative shrink-0">
      <img src="${escapeHtml(member.photoUrl)}" class="${imageClass}" alt="${escapeHtml(member.name)} profile photo" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');">
      <span class="${initialsClass} hidden" aria-hidden="true">${initials}</span>
    </span>
  `;
}

function getTeamChoiceLabelMarkup(value) {
  const label = String(value || '').trim();
  if (!label) {
    return '<span class="text-slate-400 dark:text-slate-500">Select team</span>';
  }

  const member = getBettingMemberByName(label) || { name: label, photoUrl: '' };
  return `
    <span class="flex min-w-0 items-center gap-3">
      ${getBettingMemberAvatarMarkup(member, 'tiny')}
      <span class="truncate">${escapeHtml(label)}</span>
    </span>
  `;
}

function getCurrentBettingMember() {
  if (!bettingData || !selectedBettingMemberRow) return null;
  return bettingData.members.find((member) => Number(member.row) === Number(selectedBettingMemberRow)) || null;
}

function renderBettingSkeleton() {
  const root = getBettingRoot();
  if (!root) return;

  root.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between px-1">
        <div class="space-y-3">
          <div class="h-8 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
          <div class="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        ${Array.from({ length: 4 }).map(() => `
          <div class="glass-panel rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div class="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
            <div class="mt-3 h-4 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBettingEmpty(message) {
  const root = getBettingRoot();
  if (!root) return;

  root.innerHTML = `
    <div class="glass-panel rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm dark:border-pink-500/10 dark:bg-slate-900/70">
      <p class="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">${escapeHtml(message)}</p>
    </div>
  `;
}

function renderBettingHeader(actionsMarkup = '') {
  return `
    <div class="flex flex-col gap-4 px-1 md:flex-row md:items-start md:justify-between">
      <div class="space-y-3">
        <h2 class="text-3xl font-black uppercase italic tracking-tight">${escapeHtml(getBettingWeekLabel())}</h2>
        <div class="flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.18em]">
          <span class="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">${escapeHtml(formatTimestamp(bettingData?.updatedAt))}</span>
          ${bettingData?.resultsPosted ? '<span class="rounded-full bg-emerald-500 px-4 py-2 text-white shadow-lg shadow-emerald-500/20">Finalized</span>' : '<span class="rounded-full bg-pink-500 px-4 py-2 text-white shadow-lg shadow-pink-500/20">Open</span>'}
        </div>
      </div>
      <div class="flex items-center gap-3">
        ${actionsMarkup}
        <button type="button" data-betting-refresh class="rounded-full border border-slate-200 bg-white p-3 shadow-sm transition hover:border-pink-500 dark:border-slate-800 dark:bg-slate-900" aria-label="Refresh betting data">
          <svg class="h-4 w-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
      </div>
    </div>
  `;
}

function renderBettingMemberPicker() {
  const root = getBettingRoot();
  if (!root || !bettingData) return;
  clearBettingTeamSelectState();

  if (!bettingData.members.length) {
    renderBettingEmpty('No betting members are available yet.');
    return;
  }

  const memberCards = bettingData.members.map((member) => `
    <button type="button" data-betting-member-row="${member.row}" class="glass-panel group rounded-3xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm transition hover:border-pink-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/70">
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-4">
          ${getBettingMemberAvatarMarkup(member)}
          <div class="min-w-0">
            <p class="truncate text-lg font-black italic uppercase leading-tight tracking-tight text-slate-900 group-hover:text-pink-500 dark:text-white">${escapeHtml(member.name)}</p>
            <p class="mt-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">${member.submitted ? 'Submitted' : 'Open'}</p>
          </div>
        </div>
        <span class="${member.submitted ? 'bg-emerald-500 text-white' : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'} shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">${member.submitted ? 'In' : 'Pick'}</span>
      </div>
    </button>
  `).join('');

  root.innerHTML = `
    <div class="space-y-6">
      ${renderBettingHeader()}
      ${getBettingStatusMarkup()}
      ${bettingData.warnings?.length ? `
        <div class="${getBettingStatusClass('warning')}">${bettingData.warnings.map(escapeHtml).join(' ')}</div>
      ` : ''}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        ${memberCards}
      </div>
    </div>
  `;
}

function getBettingOptionButtonMarkup(bet, option, value, disabled) {
  const active = option === value;
  return `
    <button type="button" class="betting-choice-button" data-bet-option data-value="${escapeHtml(option)}" aria-pressed="${active ? 'true' : 'false'}"${disabled ? ' disabled' : ''}>
      ${escapeHtml(option)}
    </button>
  `;
}

function getBettingTeamSelectMarkup(bet, value, disabled) {
  const fieldName = `bet-${bet.index}`;
  const safeValue = escapeHtml(value || '');
  const disabledAttr = disabled ? ' disabled' : '';
  const optionButtons = (bet.options || []).map((option) => {
    const member = getBettingMemberByName(option) || { name: option, photoUrl: '' };
    return `
      <button type="button" class="betting-team-option" data-team-select-option data-value="${escapeHtml(option)}"${disabledAttr}>
        ${getBettingMemberAvatarMarkup(member, 'tiny')}
        <span class="min-w-0 truncate">${escapeHtml(option)}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="betting-team-select" data-team-select data-bet-index="${bet.index}" data-value="${safeValue}">
      <input type="hidden" name="${fieldName}" value="${safeValue}">
      <button type="button" class="betting-team-select-trigger" data-team-select-toggle aria-expanded="false"${disabledAttr}>
        <span class="min-w-0 flex-1" data-team-select-label>${getTeamChoiceLabelMarkup(value)}</span>
        <svg class="h-4 w-4 shrink-0 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6"></path></svg>
      </button>
      <div class="betting-team-select-menu" data-team-select-menu hidden>
        ${optionButtons}
      </div>
    </div>
  `;
}

function getBettingInputMarkup(bet, value, disabled) {
  const disabledAttr = disabled ? ' disabled' : '';
  const fieldName = `bet-${bet.index}`;
  const safeValue = escapeHtml(value || '');

  if (
    isBettingTeamChoiceKey(bet.optionBankKey) ||
    isBettingTeamChoiceKey(bet.mapping) ||
    isBettingTeamChoiceKey(bet.optionBankLabel)
  ) {
    return getBettingTeamSelectMarkup(bet, value, disabled);
  }

  if (bet.inputType === 'select') {
    const options = (bet.options || []).map((option) => `
      <option value="${escapeHtml(option)}"${option === value ? ' selected' : ''}>${escapeHtml(option)}</option>
    `).join('');
    return `
      <select name="${fieldName}" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-white"${disabledAttr}>
        <option value="">Select</option>
        ${options}
      </select>
    `;
  }

  if (bet.inputType === 'pill') {
    return `
      <div class="flex flex-wrap gap-2" data-bet-field data-bet-index="${bet.index}" data-value="${safeValue}">
        ${(bet.options || []).map((option) => getBettingOptionButtonMarkup(bet, option, value, disabled)).join('')}
      </div>
    `;
  }

  return `
    <input name="${fieldName}" type="text" maxlength="120" value="${safeValue}" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-white" placeholder="Enter pick"${disabledAttr}>
  `;
}

function getBettingPromptMarkup(prompt, fallback) {
  const lines = String(prompt || fallback || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headline, ...details] = lines.length ? lines : [fallback || 'Bet'];

  return `
    <div class="mt-2 space-y-1 leading-snug">
      <p class="text-base font-black text-slate-950 dark:text-white">${escapeHtml(headline)}</p>
      ${details.map((line) => `<p class="text-sm font-normal leading-relaxed text-slate-600 dark:text-slate-300">${escapeHtml(line)}</p>`).join('')}
    </div>
  `;
}

function renderBettingForm() {
  const root = getBettingRoot();
  const member = getCurrentBettingMember();
  if (!root || !bettingData || !member) {
    renderBettingMemberPicker();
    return;
  }
  clearBettingTeamSelectState();

  const finalized = bettingData.resultsPosted === true;
  const picks = Array.isArray(member.picks) ? member.picks : [];
  const backButton = `
    <button type="button" data-betting-back class="rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 shadow-sm transition hover:border-pink-500 hover:text-pink-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      Back
    </button>
  `;

  const betCards = bettingData.bets.map((bet, index) => {
    const value = picks[index] || '';
    const result = bettingData.results?.[index] || '';
    return `
      <article class="betting-bet-card glass-panel rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70" data-betting-bet-card>
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-pink-500">Bet ${index + 1}</p>
            ${getBettingPromptMarkup(bet.prompt, `Bet ${index + 1}`)}
          </div>
        </div>
        <div data-bet-card data-bet-index="${index}">
          ${getBettingInputMarkup(bet, value, finalized)}
        </div>
        ${result ? `<p class="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">Result: ${escapeHtml(result)}</p>` : ''}
      </article>
    `;
  }).join('');

  root.innerHTML = `
    <div class="space-y-6">
      ${renderBettingHeader(backButton)}
      ${getBettingStatusMarkup()}
      <div class="glass-panel rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="flex min-w-0 items-center gap-4">
            ${getBettingMemberAvatarMarkup(member, 'large')}
            <div class="min-w-0">
              <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Selected Team</p>
              <h3 class="mt-2 truncate text-2xl font-black italic uppercase tracking-tight text-slate-950 dark:text-white">${escapeHtml(member.name)}</h3>
            </div>
          </div>
          <span class="${member.submitted ? 'bg-emerald-500 text-white' : 'bg-pink-500 text-white'} w-fit rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em]">${member.submitted ? 'Submitted' : 'Open'}</span>
        </div>
      </div>
      <form id="betting-form" class="space-y-5">
        <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
          ${betCards}
        </div>
        <button type="submit" class="w-full rounded-2xl bg-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-pink-500/20 transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:disabled:bg-slate-700"${finalized ? ' disabled' : ''}>
          ${finalized ? 'Results Posted' : 'Submit Picks'}
        </button>
      </form>
    </div>
  `;
}

function renderBetting() {
  if (!bettingData) {
    renderBettingSkeleton();
    return;
  }

  if (selectedBettingMemberRow && getCurrentBettingMember()) {
    renderBettingForm();
    return;
  }

  selectedBettingMemberRow = null;
  renderBettingMemberPicker();
}

async function loadBettingData() {
  if (!getBettingRoot()) return;
  renderBettingSkeleton();

  try {
    const payload = await fetchJsonp('api/betting-data');
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Betting data could not be loaded.');
    }
    bettingData = payload;
    if (selectedBettingMemberRow && !getCurrentBettingMember()) {
      selectedBettingMemberRow = null;
    }
    renderBetting();
  } catch (error) {
    console.error(error);
    bettingData = null;
    renderBettingEmpty('Betting data could not be loaded.');
    setBanner('Betting data could not be loaded from Apps Script.', 'error');
  }
}

function updateBettingOptionSelection(button) {
  const field = button.closest('[data-bet-field]');
  if (!field) return;

  const selectedValue = button.dataset.value || '';
  field.dataset.value = selectedValue;
  field.querySelectorAll('[data-bet-option]').forEach((optionButton) => {
    optionButton.setAttribute('aria-pressed', optionButton.dataset.value === selectedValue ? 'true' : 'false');
  });
}

function removeBettingTeamSelectPortal() {
  document.querySelector('[data-team-select-portal]')?.remove();
}

function clearBettingTeamSelectState() {
  activeBettingTeamSelect = null;
  removeBettingTeamSelectPortal();
  document.querySelectorAll('[data-betting-bet-card][data-select-open]').forEach((card) => {
    delete card.dataset.selectOpen;
  });
  document.querySelectorAll('[data-team-select-toggle][aria-expanded="true"]').forEach((toggle) => {
    toggle.setAttribute('aria-expanded', 'false');
  });
}

function positionBettingTeamSelectPortal(select, portal) {
  const trigger = select.querySelector('[data-team-select-toggle]');
  if (!trigger || !portal) return;

  const viewportPadding = 12;
  const menuGap = 7;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(rect.width, window.innerWidth - (viewportPadding * 2));
  const left = Math.min(
    Math.max(rect.left, viewportPadding),
    window.innerWidth - width - viewportPadding
  );
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap;
  const spaceAbove = rect.top - viewportPadding - menuGap;
  const opensBelow = spaceBelow >= 150 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(288, Math.max(128, opensBelow ? spaceBelow : spaceAbove));
  const top = opensBelow
    ? rect.bottom + menuGap
    : Math.max(viewportPadding, rect.top - menuGap - maxHeight);

  portal.style.left = `${left}px`;
  portal.style.top = `${top}px`;
  portal.style.width = `${width}px`;
  portal.style.maxHeight = `${maxHeight}px`;
}

function renderBettingTeamSelectPortal(select) {
  const menu = select.querySelector('[data-team-select-menu]');
  if (!menu) return;

  removeBettingTeamSelectPortal();

  const portal = document.createElement('div');
  portal.className = 'betting-team-select-menu betting-team-select-menu--portal';
  portal.dataset.teamSelectPortal = 'true';
  portal.dataset.betIndex = select.dataset.betIndex || '';
  portal.innerHTML = menu.innerHTML;
  document.body.appendChild(portal);
  positionBettingTeamSelectPortal(select, portal);
}

function updateActiveBettingTeamSelectPosition() {
  if (!activeBettingTeamSelect) return;
  const portal = document.querySelector('[data-team-select-portal]');
  positionBettingTeamSelectPortal(activeBettingTeamSelect, portal);
}

function setBettingTeamSelectOpen(select, isOpen) {
  const toggle = select.querySelector('[data-team-select-toggle]');
  const menu = select.querySelector('[data-team-select-menu]');
  const card = select.closest('[data-betting-bet-card]');

  if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (menu) menu.hidden = true;
  if (card) {
    if (isOpen) {
      card.dataset.selectOpen = 'true';
    } else {
      delete card.dataset.selectOpen;
    }
  }

  if (isOpen) {
    activeBettingTeamSelect = select;
    renderBettingTeamSelectPortal(select);
  } else if (activeBettingTeamSelect === select) {
    activeBettingTeamSelect = null;
    removeBettingTeamSelectPortal();
  }
}

function closeBettingTeamSelects(exceptSelect = null) {
  document.querySelectorAll('[data-team-select]').forEach((select) => {
    if (select === exceptSelect) return;
    setBettingTeamSelectOpen(select, false);
  });
}

function toggleBettingTeamSelect(button) {
  const select = button.closest('[data-team-select]');
  if (!select) return;

  const shouldOpen = button.getAttribute('aria-expanded') !== 'true';
  closeBettingTeamSelects(select);
  setBettingTeamSelectOpen(select, shouldOpen);
}

function selectBettingTeamOption(button) {
  const portal = button.closest('[data-team-select-portal]');
  const select = button.closest('[data-team-select]') ||
    activeBettingTeamSelect ||
    document.querySelector(`[data-team-select][data-bet-index="${portal?.dataset.betIndex || ''}"]`);
  if (!select) return;

  const value = button.dataset.value || '';
  const input = select.querySelector('input[type="hidden"]');
  const label = select.querySelector('[data-team-select-label]');
  select.dataset.value = value;
  if (input) input.value = value;
  if (label) label.innerHTML = getTeamChoiceLabelMarkup(value);
  closeBettingTeamSelects();
}

function collectBettingPicks() {
  const form = document.getElementById('betting-form');
  if (!form || !bettingData) return [];

  return bettingData.bets.map((bet) => {
    if (bet.inputType === 'pill') {
      const field = form.querySelector(`[data-bet-field][data-bet-index="${bet.index}"]`);
      return field?.dataset.value || '';
    }
    return form.elements[`bet-${bet.index}`]?.value?.trim() || '';
  });
}

async function submitBettingForm() {
  const member = getCurrentBettingMember();
  if (!member || !bettingData) return;
  if (bettingData.resultsPosted) {
    setBettingStatus('This betting week is finalized. Results have already been posted.', 'error');
    return;
  }

  const values = collectBettingPicks();
  if (values.length !== BETTING_BET_COUNT || values.some((value) => !value)) {
    setBettingStatus(`Finish all ${BETTING_BET_COUNT} picks before submitting.`, 'error');
    return;
  }

  if (member.submitted && !window.confirm(`Overwrite picks for ${member.name}?`)) {
    return;
  }

  const submitButton = document.querySelector('#betting-form button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setBettingStatus(`Saving picks for ${member.name}...`);

  try {
    const payload = await fetchJsonp('api/submit-bets', {
      memberRow: member.row,
      memberName: member.name,
      picks: JSON.stringify(values)
    });
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Submit failed.');
    }
    bettingStatusMessage = `Picks saved for ${member.name}.`;
    bettingStatusTone = 'success';
    member.picks = Array.isArray(payload.picks) ? payload.picks : values;
    member.submitted = true;
    if (bettingData) {
      bettingData.updatedAt = payload.updatedAt || bettingData.updatedAt;
    }
    renderBettingForm();
  } catch (error) {
    console.error(error);
    setBettingStatus(`Submit failed: ${error.message || error}`, 'error');
    if (submitButton) submitButton.disabled = false;
  }
}

function setupBettingControls() {
  const root = getBettingRoot();
  if (!root || root.dataset.bettingBound === 'true') return;

  root.dataset.bettingBound = 'true';
  root.addEventListener('click', (event) => {
    const refresh = event.target.closest('[data-betting-refresh]');
    if (refresh) {
      loadBettingData();
      return;
    }

    const back = event.target.closest('[data-betting-back]');
    if (back) {
      selectedBettingMemberRow = null;
      setBettingStatus('');
      renderBettingMemberPicker();
      return;
    }

    const optionButton = event.target.closest('[data-bet-option]');
    if (optionButton) {
      updateBettingOptionSelection(optionButton);
      return;
    }

    const teamToggle = event.target.closest('[data-team-select-toggle]');
    if (teamToggle) {
      toggleBettingTeamSelect(teamToggle);
      return;
    }

    const teamOption = event.target.closest('[data-team-select-option]');
    if (teamOption) {
      selectBettingTeamOption(teamOption);
      return;
    }

    const memberButton = event.target.closest('[data-betting-member-row]');
    if (memberButton) {
      selectedBettingMemberRow = Number(memberButton.dataset.bettingMemberRow);
      setBettingStatus('');
      renderBettingForm();
      return;
    }

    if (!event.target.closest('[data-team-select]')) {
      closeBettingTeamSelects();
    }
  });

  document.addEventListener('click', (event) => {
    const portal = event.target.closest('[data-team-select-portal]');
    if (portal) {
      const teamOption = event.target.closest('[data-team-select-option]');
      if (teamOption) {
        selectBettingTeamOption(teamOption);
      }
      return;
    }

    if (!event.target.closest('[data-team-select]')) {
      closeBettingTeamSelects();
    }
  });

  window.addEventListener('resize', updateActiveBettingTeamSelectPosition);
  window.addEventListener('scroll', updateActiveBettingTeamSelectPosition, { passive: true });

  root.addEventListener('submit', (event) => {
    if (event.target.id !== 'betting-form') return;
    event.preventDefault();
    submitBettingForm();
  });
}

function setupInstallPrompt() {
  const installPanel = document.getElementById('install-panel');
  const installButton = document.getElementById('install-button');
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isIos && !isStandalone) {
    document.getElementById('ios-install-tip').hidden = false;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installPanel.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installPanel.hidden = true;
    setBanner('App installed. You can launch it from your home screen now.');
  });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installPanel.hidden = true;
  });
}

function setupThemeControls() {
  const currentTheme = localStorage.getItem(THEME_KEY) || 'system';
  applyTheme(currentTheme);
  updateThemeButtons(currentTheme);

  document.querySelectorAll('.theme-btn').forEach((button) => {
    button.addEventListener('click', () => setTheme(button.dataset.theme));
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const theme = localStorage.getItem(THEME_KEY) || 'system';
    if (theme === 'system') {
      applyTheme(theme);
    }
  });
}

function setupScrollBehavior() {
  const toggleContainer = document.getElementById('theme-toggle-container');
  const installPanel = document.getElementById('install-panel');
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const hide = scrollTop > 50 && scrollTop > lastScrollTop;
    [toggleContainer, installPanel].forEach((element) => {
      if (!element) return;
      element.style.transform = hide ? 'translateY(-120%)' : 'translateY(0)';
      element.style.opacity = hide ? '0' : '1';
    });
    lastScrollTop = Math.max(scrollTop, 0);
  }, { passive: true });
}

function setActiveTab(tabName, shouldScroll = false) {
  const activeTab = tabName === 'betting' ? 'betting' : 'home';
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== activeTab;
  });

  document.querySelectorAll('[data-app-tab]').forEach((button) => {
    const isActive = button.dataset.appTab === activeTab;
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.tabIndex = isActive ? 0 : -1;
  });

  if (shouldScroll) {
    const main = document.getElementById('app-main');
    if (main) {
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (activeTab === 'betting' && !bettingData) {
    loadBettingData();
  }
}

function setupAppTabs() {
  const tabs = Array.from(document.querySelectorAll('[data-app-tab]'));
  if (!tabs.length) return;

  tabs.forEach((button, index) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.appTab, true));
    button.addEventListener('keydown', (event) => {
      const keyActions = {
        ArrowLeft: index - 1,
        ArrowRight: index + 1,
        Home: 0,
        End: tabs.length - 1
      };
      if (!(event.key in keyActions)) return;

      event.preventDefault();
      const nextIndex = (keyActions[event.key] + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      setActiveTab(tabs[nextIndex].dataset.appTab, true);
    });
  });

  setActiveTab('home');
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./service-worker.js');
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}

async function bootstrap() {
  setupThemeControls();
  setupInstallPrompt();
  setupScrollBehavior();
  setupAppTabs();
  setupBettingControls();
  setupStandingsAccordion();
  setupAdminEditing();
  await registerServiceWorker();
  document.getElementById('refresh-button').addEventListener('click', () => loadStandings());
  applyConfig(DEFAULT_CONFIG);

  try {
    await loadConfig();
  } catch (error) {
    console.error(error);
    setBanner('Live app configuration could not be loaded. The Apps Script deployment appears to require sign-in, so anonymous visitors are falling back to default branding.', 'error');
  }

  await loadStandings();
  await dismissSplash();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
  bootstrap();
}

