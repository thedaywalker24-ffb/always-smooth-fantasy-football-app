const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwtM_NX16wFOHssvhvP2Iw7FI_7YcVgJ9-5DNbvNOblMxifawE4R-F_eiOLU1NsEggF/exec';
const APP_VERSION = 'v2026.07.22.3';
const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=600&auto=format&fit=crop';
const THEME_KEY = 'theme';
const CONFIG_CACHE_KEY = 'always-smooth-config';
const DATA_CACHE_KEY = 'always-smooth-league-data';
const TICKER_CACHE_KEY = 'always-smooth-ticker-data';
const DRAFT_BOARD_CACHE_KEY = 'always-smooth-draft-board';
const MATCHUPS_CACHE_KEY = 'always-smooth-matchups-data';
const CAPTAIN_CACHE_KEY = 'always-smooth-captain-data';
const BETTING_BET_COUNT = 6;
const MATCHUPS_TAB_ENABLED = false;
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
let tickerData = null;
let draftBoardData = null;
let matchupsData = null;
let matchupsDataIsStale = false;
let captainData = null;
let captainDialogTimer = null;
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
      'api/ticker-data': 'ticker-data',
      'api/betting-data': 'betting-data',
      'api/draft-board': 'draft-board',
      'api/matchups-data': 'matchups-data',
      'api/captain-data': 'captain-data',
      'api/update-team-field': 'update-team-field',
      'api/submit-bets': 'submit-bets',
      'api/submit-captain': 'submit-captain'
    };
    const route = routeMap[path] || path.replace(/^\//, '');
    const url = buildApiUrl(route, { ...params, callback: callbackName });
    const timeoutMsByRoute = {
      'betting-data': 30000,
      'ticker-data': 20000,
      'draft-board': 30000,
      'matchups-data': 30000,
      'captain-data': 30000,
      'submit-bets': 45000,
      'submit-captain': 45000,
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

function setCaptainDialog(state, title, message, options = {}) {
  const dialog = document.getElementById('captain-save-dialog');
  if (!dialog) return;

  const icon = dialog.querySelector('[data-action-dialog-icon]');
  const titleEl = dialog.querySelector('[data-action-dialog-title]');
  const messageEl = dialog.querySelector('[data-action-dialog-message]');
  const closeButton = dialog.querySelector('[data-action-dialog-close]');
  window.clearTimeout(captainDialogTimer);

  dialog.hidden = false;
  dialog.dataset.state = state || 'loading';
  titleEl.textContent = title || '';
  messageEl.textContent = message || '';
  closeButton.hidden = state === 'loading';
  closeButton.textContent = options.closeLabel || 'OK';

  icon.className = 'action-dialog-icon';
  icon.textContent = '';
  if (state === 'loading') {
    icon.classList.add('action-dialog-spinner');
  } else if (state === 'success') {
    icon.classList.add('action-dialog-icon--success');
    icon.textContent = 'C';
  } else {
    icon.classList.add('action-dialog-icon--error');
    icon.textContent = '!';
  }

  if (options.autoCloseMs) {
    captainDialogTimer = window.setTimeout(() => {
      hideCaptainDialog();
    }, options.autoCloseMs);
  }
}

function hideCaptainDialog() {
  const dialog = document.getElementById('captain-save-dialog');
  window.clearTimeout(captainDialogTimer);
  if (dialog) dialog.hidden = true;
}

function setupCaptainDialog() {
  const dialog = document.getElementById('captain-save-dialog');
  if (!dialog) return;

  dialog.querySelector('[data-action-dialog-close]')?.addEventListener('click', hideCaptainDialog);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialog.hidden && dialog.dataset.state !== 'loading') {
      hideCaptainDialog();
    }
  });
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

function formatCompactTimestamp(value) {
  if (!value) return 'Sync';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sync';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTargetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfTargetDay) / 86400000);
  const timeLabel = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) return timeLabel;
  if (diffDays === 1) return `Yday ${timeLabel}`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
  const pageTitleTrigger = document.getElementById('page-title-audio-trigger');
  if (pageTitleTrigger) {
    pageTitleTrigger.textContent = config.appShortName || 'Always Smooth';
  }
  document.getElementById('season-pill').textContent = `Season ${leagueSeason || '--'}`;
  document.getElementById('week-pill').textContent = `Week ${leagueWeek || '--'}`;
  const banner = document.getElementById('league-banner');
  banner.src = config.headerImageSrc || FALLBACK_PHOTO;
  banner.onerror = () => {
    banner.src = FALLBACK_PHOTO;
    banner.onerror = null;
  };
  const versionLabel = document.getElementById('app-version-label');
  if (versionLabel) {
    versionLabel.textContent = `App ${APP_VERSION}`;
  }
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

function normalizeClientTeamKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatMatchupScore(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '--';
  const numeric = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return raw;
  return numeric.toFixed(2).replace(/\.00$/, '');
}

function buildTeamMatchupLookup(payload) {
  const lookup = {};
  const matchups = Array.isArray(payload?.matchups) ? payload.matchups : [];

  matchups.forEach((matchup) => {
    const teams = Array.isArray(matchup?.teams) ? matchup.teams : [];
    if (teams.length !== 2) return;
    const [firstTeam, secondTeam] = teams;
    const firstKey = normalizeClientTeamKey(firstTeam?.teamName);
    const secondKey = normalizeClientTeamKey(secondTeam?.teamName);
    if (firstKey) {
      lookup[firstKey] = { team: firstTeam, opponent: secondTeam, matchupId: matchup.matchupId };
    }
    if (secondKey) {
      lookup[secondKey] = { team: secondTeam, opponent: firstTeam, matchupId: matchup.matchupId };
    }
  });

  return lookup;
}

function renderHomeMatchupStrip(matchup) {
  const teamScore = formatMatchupScore(matchup?.team?.weekPoints);
  const opponentScore = formatMatchupScore(matchup?.opponent?.weekPoints);
  const opponentName = String(matchup?.opponent?.teamName || 'Opponent').trim();
  const teamPhoto = String(matchup?.team?.photoUrl || FALLBACK_PHOTO).trim() || FALLBACK_PHOTO;
  const opponentPhoto = String(matchup?.opponent?.photoUrl || FALLBACK_PHOTO).trim() || FALLBACK_PHOTO;

  return `
    <div class="home-matchup-strip" aria-label="Current matchup">
      <div class="home-matchup-strip__scoreline">
        <span class="home-matchup-strip__side home-matchup-strip__side--team">
          <img src="${escapeHtml(teamPhoto)}" class="home-matchup-strip__thumb" alt="" loading="lazy" onerror="this.src='${FALLBACK_PHOTO}';this.onerror=null;">
          <span class="home-matchup-strip__score">${escapeHtml(teamScore)}</span>
        </span>
        <span class="home-matchup-strip__vs">vs</span>
        <span class="home-matchup-strip__side home-matchup-strip__side--opponent">
          <span class="home-matchup-strip__score">${escapeHtml(opponentScore)}</span>
          <img src="${escapeHtml(opponentPhoto)}" class="home-matchup-strip__thumb" alt="" loading="lazy" onerror="this.src='${FALLBACK_PHOTO}';this.onerror=null;">
        </span>
      </div>
      <p class="home-matchup-strip__opponent">${escapeHtml(opponentName)}</p>
    </div>
  `;
}

function renderHomeMatchupSummaries(payload) {
  const slots = document.querySelectorAll('[data-home-matchup-slot]');
  if (!slots.length) return;

  const matchupLookup = buildTeamMatchupLookup(payload);
  slots.forEach((slot) => {
    const slotKeys = [
      normalizeClientTeamKey(slot.dataset.homeMatchupSlot),
      normalizeClientTeamKey(slot.dataset.homeMatchupOwner)
    ].filter(Boolean);
    const matchup = slotKeys.map((key) => matchupLookup[key]).find(Boolean);
    if (!matchup) {
      slot.hidden = true;
      slot.innerHTML = '';
      return;
    }

    slot.hidden = false;
    slot.innerHTML = renderHomeMatchupStrip(matchup);
  });
}

function buildCaptainLookup(payload) {
  const lookup = {};
  const teams = Array.isArray(payload?.teams) ? payload.teams : [];
  teams.forEach((team) => {
    const key = normalizeClientTeamKey(team?.teamName);
    if (key) lookup[key] = team;
  });
  return lookup;
}

function normalizePlayerPosition(position) {
  const normalized = String(position || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (normalized === 'DST' || normalized === 'D' || normalized === 'DEFENSE') return 'DEF';
  if (normalized === 'PK') return 'K';
  return ['QB', 'WR', 'RB', 'TE', 'DEF', 'K'].includes(normalized) ? normalized : '';
}

function renderPositionPill(position) {
  const normalized = normalizePlayerPosition(position);
  if (!normalized) return '';
  return `<span class="player-position-pill player-position-pill--${normalized.toLowerCase()}">${normalized}</span>`;
}

function getPlayerTeamLabel(player) {
  return String(player?.nflTeam || player?.team || '').trim();
}

function splitPlayerNameAndPosition(name, position) {
  const rawName = String(name || '').trim();
  const structuredPosition = normalizePlayerPosition(position);
  if (structuredPosition) return { name: rawName, position: structuredPosition };

  const match = rawName.match(/^(.*?)(?:\s*[-–—/]\s*|\s*\()((?:QB|WR|RB|TE|DEF|D\/ST|DST|K))\)?$/i);
  if (!match) return { name: rawName, position: '' };
  return {
    name: match[1].trim(),
    position: normalizePlayerPosition(match[2])
  };
}

function getCaptainShortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Captain';
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function getCaptainImageMarkup(captain, className) {
  const src = String(captain?.playerImageUrl || '').trim();
  const initials = escapeHtml(getMemberInitials(captain?.playerName || 'C'));
  if (!src) return `<span class="${className} captain-player-fallback" aria-hidden="true">${initials}</span>`;
  return `
    <span class="relative shrink-0">
      <img src="${escapeHtml(src)}" class="${className}" alt="${escapeHtml(captain?.playerName || 'Captain')} player photo" loading="lazy" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');">
      <span class="${className} captain-player-fallback hidden" aria-hidden="true">${initials}</span>
    </span>
  `;
}

function renderCaptainPrimaryBadge(teamCaptain) {
  const captain = teamCaptain?.currentCaptain;
  if (!captain) return '';
  return `
    <div class="captain-primary-badge">
      ${getCaptainImageMarkup(captain, 'captain-primary-photo')}
      <span class="captain-primary-mark">C</span>
      <span class="min-w-0 truncate">${escapeHtml(getCaptainShortName(captain.playerName))}</span>
      ${renderPositionPill(captain.position)}
    </div>
  `;
}

function renderCaptainOption(teamName, player, currentCaptain) {
  const isCurrent = currentCaptain && String(currentCaptain.playerId) === String(player.playerId);
  const disabled = player.usedEarlierThisSeason === true;
  const teamLabel = getPlayerTeamLabel(player);
  const disabledAttr = disabled ? ' disabled' : '';
  const status = disabled
    ? player.disabledReason || 'Already used'
    : isCurrent
      ? 'Current'
      : 'Available';
  return `
    <button type="button" class="captain-player-option" data-captain-option data-team-name="${escapeHtml(teamName)}" data-player-id="${escapeHtml(player.playerId)}"${disabledAttr}>
      ${getCaptainImageMarkup(player, 'captain-option-photo')}
      <span class="min-w-0 flex-1">
        <span class="player-name-with-position">
          <span class="captain-option-name">${escapeHtml(player.playerName)}</span>
          ${renderPositionPill(player.position)}
        </span>
        ${teamLabel ? `<span class="captain-option-detail">${escapeHtml(teamLabel)}</span>` : ''}
      </span>
      <span class="captain-option-status${disabled ? ' captain-option-status--disabled' : ''}">${escapeHtml(status)}</span>
    </button>
  `;
}

function renderCaptainDetail(teamCaptain, teamName) {
  const captain = teamCaptain?.currentCaptain;
  const isOpen = captainData?.isOpen === true;
  const players = Array.isArray(teamCaptain?.eligiblePlayers) ? teamCaptain.eligiblePlayers : [];
  const teamLabel = captain ? getPlayerTeamLabel(captain) : '';
  const pickerId = `captain-picker-${normalizeBettingOptionKey(teamName)}`;
  const ruleTooltipId = `captain-rule-${normalizeBettingOptionKey(teamName)}`;
  const statusLabel = isOpen ? 'Open' : 'Locked';

  return `
    <div class="captain-detail-card">
      <div class="captain-detail-main">
        ${captain
          ? getCaptainImageMarkup(captain, 'captain-detail-photo')
          : '<span class="captain-detail-photo captain-player-fallback" aria-hidden="true">C</span>'}
        <div class="min-w-0 flex-1">
          <div class="captain-kicker-row">
            <p class="captain-kicker">Weekly Captain</p>
            <span class="captain-rule-tooltip" data-captain-rule-tooltip>
              <button type="button" class="captain-rule-tooltip-button" data-captain-rule-tooltip-button aria-label="Show Weekly Captain rule" aria-expanded="false" aria-controls="${ruleTooltipId}" aria-describedby="${ruleTooltipId}">i</button>
              <span id="${ruleTooltipId}" class="captain-rule-tooltip-content" role="tooltip">Your Captain scores 2× points for the week. The commissioner applies the bonus manually in Sleeper. Each player can only be used once per season.</span>
            </span>
          </div>
          <p class="captain-detail-name player-name-with-position"><span class="truncate">${escapeHtml(captain?.playerName || 'No Captain selected')}</span>${renderPositionPill(captain?.position)}</p>
          ${teamLabel ? `<p class="captain-detail-meta">${escapeHtml(teamLabel)}</p>` : ''}
        </div>
        <span class="captain-lock-pill">${escapeHtml(statusLabel)}</span>
      </div>
      ${isOpen ? `
        <button type="button" class="captain-picker-toggle" data-captain-toggle-picker aria-expanded="false" aria-controls="${pickerId}">
          ${captain ? 'Change Captain' : 'Set Captain'}
        </button>
        <div id="${pickerId}" class="captain-picker" data-captain-picker hidden>
          ${players.length
            ? players.map((player) => renderCaptainOption(teamCaptain.teamName || teamName, player, captain)).join('')
            : '<p class="captain-picker-empty">No current starters are available.</p>'}
        </div>
      ` : ''}
    </div>
  `;
}

function renderCaptainSummaries(payload) {
  const lookup = buildCaptainLookup(payload);
  document.querySelectorAll('[data-captain-primary-slot]').forEach((slot) => {
    const teamCaptain = lookup[normalizeClientTeamKey(slot.dataset.captainPrimarySlot)];
    const markup = renderCaptainPrimaryBadge(teamCaptain);
    slot.hidden = !markup;
    slot.innerHTML = markup;
  });

  document.querySelectorAll('[data-captain-detail-slot]').forEach((slot) => {
    const teamName = slot.dataset.captainDetailSlot || '';
    const teamCaptain = lookup[normalizeClientTeamKey(teamName)];
    if (!teamCaptain && !payload) {
      slot.hidden = true;
      slot.innerHTML = '';
      return;
    }
    slot.hidden = false;
    slot.innerHTML = renderCaptainDetail(teamCaptain, teamName);
  });
}

async function loadCaptainData() {
  const cached = getCachedJson(CAPTAIN_CACHE_KEY);
  if (cached) {
    captainData = cached;
    renderCaptainSummaries(cached);
  }

  try {
    const payload = await fetchJsonp('api/captain-data');
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Captain data could not be loaded.');
    }
    captainData = payload;
    setCachedJson(CAPTAIN_CACHE_KEY, payload);
    renderCaptainSummaries(payload);
  } catch (error) {
    console.warn('Captain data could not be loaded.', error);
    if (!cached) renderCaptainSummaries(null);
  }
}

async function submitCaptainPick(button) {
  if (!button || button.disabled) return;
  const teamName = button.dataset.teamName || '';
  const playerId = button.dataset.playerId || '';
  if (!teamName || !playerId) return;

  button.disabled = true;
  setBanner('');
  setCaptainDialog(
    'loading',
    'Setting Captain',
    `Saving ${teamName}'s Captain pick. This can take up to a minute, and the app will auto refresh when it is complete.`
  );
  try {
    const payload = await fetchJsonp('api/submit-captain', { teamName, playerId });
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Captain could not be saved.');
    }
    await loadCaptainData();
    setCaptainDialog('success', 'Captain Saved', `${payload.currentCaptain?.playerName || 'Captain'} is set for ${teamName}.`, {
      autoCloseMs: 1600
    });
  } catch (error) {
    console.error(error);
    setCaptainDialog('error', 'Captain Not Saved', error.message || String(error));
  } finally {
    button.disabled = false;
  }
}

function buildTeamInsight(team, index, leaderPoints) {
  const summary = parseRecord(team.record);
  const tiesText = summary.ties ? `, and ${summary.ties} tie${summary.ties === 1 ? '' : 's'}` : '';
  const gapText = index === 0
    ? 'sets the scoring pace for the league right now.'
    : `is ${formatPointsBehindLeader(team.pointsFor, leaderPoints).replace('-', '')} points off the league lead.`;
  return `${summary.wins} win${summary.wins === 1 ? '' : 's'}, ${summary.losses} loss${summary.losses === 1 ? '' : 'es'}${tiesText} through ${summary.games} game${summary.games === 1 ? '' : 's'} and ${gapText}`;
}

function renderAnnouncement(payload) {
  const tile = document.getElementById('announcement-tile');
  const messageElement = document.getElementById('announcement-message');
  if (!tile || !messageElement) return;

  const announcement = String(payload?.announcement || '').trim();
  tile.dataset.currentValue = announcement;
  messageElement.textContent = announcement || 'No announcement posted.';
  tile.hidden = false;
}

function renderTeams(payload, isStale = false) {
  const grid = document.getElementById('standings-grid');
  const teams = Array.isArray(payload?.teams) ? payload.teams : [];
  const leaderPoints = Number(teams[0]?.pointsFor || 0);
  document.getElementById('updated-at').textContent = formatCompactTimestamp(payload?.updatedAt);
  renderAnnouncement(payload);

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
    const teamMvp = splitPlayerNameAndPosition(team.teamMvpName || 'Not set', team.teamMvpPosition);
    const teamMvpName = teamMvp.name || 'Not set';
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
              <div class="captain-primary-slot mt-3" data-captain-primary-slot="${escapeHtml(team.teamName)}" hidden></div>
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
                <div class="captain-detail-slot" data-captain-detail-slot="${escapeHtml(team.teamName)}" hidden></div>
                <div class="team-expand-stats">
                  <div class="team-stat-row">
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-pink-500/80">Team MVP</p>
                      <p class="player-name-with-position mt-1 text-sm font-black text-slate-950 dark:text-white"><span class="truncate">${escapeHtml(teamMvpName)}</span>${renderPositionPill(teamMvp.position)}</p>
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
            <div class="team-pf-stat">
              <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">PF</p>
              <p class="text-sm font-black text-slate-700 dark:text-slate-200">${pointsFor}</p>
            </div>
          </div>
        </div>
        <div class="home-matchup-slot relative z-10" data-home-matchup-slot="${escapeHtml(team.teamName)}" data-home-matchup-owner="${escapeHtml(ownerName)}" hidden></div>
      </article>
    `;
  }).join('');

  if (matchupsData) {
    renderHomeMatchupSummaries(matchupsData);
  }
  if (captainData) {
    renderCaptainSummaries(captainData);
  }

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
  const closeCaptainRuleTooltips = () => {
    grid.querySelectorAll('[data-captain-rule-tooltip][data-open="true"]').forEach((openTooltip) => {
      openTooltip.dataset.open = 'false';
      openTooltip.querySelector('[data-captain-rule-tooltip-button]')?.setAttribute('aria-expanded', 'false');
    });
  };
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
    const ruleTooltipButton = event.target.closest('[data-captain-rule-tooltip-button]');
    if (ruleTooltipButton) {
      event.preventDefault();
      event.stopPropagation();
      const tooltip = ruleTooltipButton.closest('[data-captain-rule-tooltip]');
      const willOpen = tooltip?.dataset.open !== 'true';
      closeCaptainRuleTooltips();
      if (tooltip) tooltip.dataset.open = willOpen ? 'true' : 'false';
      ruleTooltipButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (!willOpen) ruleTooltipButton.blur();
      return;
    }

    closeCaptainRuleTooltips();

    const pickerToggle = event.target.closest('[data-captain-toggle-picker]');
    if (pickerToggle) {
      event.preventDefault();
      event.stopPropagation();
      const pickerId = pickerToggle.getAttribute('aria-controls');
      const picker = pickerId ? document.getElementById(pickerId) : pickerToggle.parentElement?.querySelector('[data-captain-picker]');
      if (picker) {
        const nextHidden = !picker.hidden;
        picker.hidden = nextHidden;
        pickerToggle.setAttribute('aria-expanded', nextHidden ? 'false' : 'true');
      }
      return;
    }

    const captainOption = event.target.closest('[data-captain-option]');
    if (captainOption) {
      event.preventDefault();
      event.stopPropagation();
      submitCaptainPick(captainOption);
      return;
    }

    const toggle = event.target.closest('[data-team-toggle]');
    if (toggle) {
      toggleTile(toggle.closest('[data-team-tile]'));
      return;
    }

    const tile = event.target.closest('[data-team-tile]');
    if (!tile || event.target.closest('a, button, input, select, textarea, summary')) return;
    toggleTile(tile);
  });

  grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeCaptainRuleTooltips();
    if (event.target.matches('[data-captain-rule-tooltip-button]')) event.target.blur();
  });

  document.addEventListener('click', (event) => {
    if (!grid.contains(event.target)) closeCaptainRuleTooltips();
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
  const subject = teamName ? `${label} for ${teamName}` : label;
  const adminCode = getAdminCode();
  if (!adminCode) return;

  const nextValue = window.prompt(`Update ${subject}`, currentValue);
  if (nextValue === null) return;

  target.setAttribute('aria-busy', 'true');
  setBanner(`Updating ${subject}...`);

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
    setBanner(`${subject} updated.`);
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

function bindAdminEditing(root) {
  if (!root || root.dataset.adminEditingBound === 'true') return;

  root.dataset.adminEditingBound = 'true';
  root.addEventListener('pointerdown', (event) => {
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

  root.addEventListener('pointermove', (event) => {
    if (!adminEditStart) return;
    const movedX = Math.abs(event.clientX - adminEditStart.x);
    const movedY = Math.abs(event.clientY - adminEditStart.y);
    if (movedX > 12 || movedY > 12) {
      clearAdminEditTimer();
    }
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
    root.addEventListener(eventName, clearAdminEditTimer);
  });

  root.addEventListener('contextmenu', (event) => {
    if (event.target.closest('[data-admin-edit-field]')) {
      event.preventDefault();
    }
  });

  root.addEventListener('click', (event) => {
    if (!adminEditActivated || !event.target.closest('[data-admin-edit-field]')) return;
    event.preventDefault();
    event.stopPropagation();
    adminEditActivated = false;
  }, true);
}

function setupAdminEditing() {
  [
    document.getElementById('announcement-tile'),
    document.getElementById('standings-grid')
  ].forEach(bindAdminEditing);
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

async function loadHomeMatchupsData() {
  const cached = getCachedJson(MATCHUPS_CACHE_KEY);
  if (cached) {
    matchupsData = cached;
    matchupsDataIsStale = true;
    renderHomeMatchupSummaries(cached);
  }

  try {
    const payload = await fetchJsonp('api/matchups-data');
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Matchups could not be loaded.');
    }
    matchupsData = payload;
    matchupsDataIsStale = false;
    setCachedJson(MATCHUPS_CACHE_KEY, payload);
    renderHomeMatchupSummaries(payload);
  } catch (error) {
    console.warn('Home matchup summaries could not be loaded.', error);
  }
}

function getTickerRoot() {
  return document.getElementById('ticker-root');
}

function renderTickerEmpty(message = 'Ticker feed unavailable') {
  const root = getTickerRoot();
  if (!root) return;
  root.innerHTML = `
    <div class="ticker-empty">
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function getTickerItemMarkup(item) {
  const text = escapeHtml(item?.text || '');
  if (!text) return '';
  const type = item?.type === 'score' ? 'score' : 'headline';
  const url = String(item?.url || '').trim();
  const content = `
    <span class="ticker-dot" aria-hidden="true"></span>
    <span class="ticker-item-label">${text}</span>
  `;
  if (!url) {
    return `<span class="ticker-item ticker-item--${type}">${content}</span>`;
  }
  return `
    <a class="ticker-item ticker-item--${type}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      ${content}
    </a>
  `;
}

function renderTicker(payload, isStale = false) {
  const root = getTickerRoot();
  const items = Array.isArray(payload?.items) ? payload.items.filter((item) => item?.text) : [];
  if (!root) return;

  if (!items.length) {
    renderTickerEmpty('NFL ticker is warming up');
    return;
  }

  const segmentMarkup = items.map(getTickerItemMarkup).join('');
  const duration = Math.max(28, Math.min(96, items.length * 5));
  root.innerHTML = `
    <div class="ticker" style="--ticker-duration: ${duration}s;" data-mode="${escapeHtml(payload?.mode || 'offseason')}" aria-label="NFL ticker">
      <div class="ticker-meta" aria-hidden="true">
        <span>${payload?.mode === 'in-season' ? 'NFL Live' : 'NFL Headlines'}</span>
        ${isStale ? '<span>Cached</span>' : ''}
      </div>
      <div class="ticker-track">
        <div class="ticker-segment">
          ${segmentMarkup}
        </div>
        <div class="ticker-segment" aria-hidden="true">
          ${segmentMarkup}
        </div>
      </div>
    </div>
  `;
}

async function loadTickerData() {
  const root = getTickerRoot();
  if (!root) return;
  const cached = getCachedJson(TICKER_CACHE_KEY);
  if (cached) {
    tickerData = cached;
    renderTicker(cached, true);
  } else {
    renderTickerEmpty('Loading NFL ticker');
  }

  try {
    const payload = await fetchJsonp('api/ticker-data');
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Ticker data could not be loaded.');
    }
    tickerData = payload;
    setCachedJson(TICKER_CACHE_KEY, payload);
    renderTicker(payload);
  } catch (error) {
    console.error(error);
    if (cached) {
      tickerData = cached;
      renderTicker(cached, true);
      return;
    }
    renderTickerEmpty('NFL ticker could not be loaded');
  }
}

function getDraftBoardRoot() {
  return document.getElementById('draft-board-root');
}

function getDraftOwnerInitials(owner) {
  const label = String(owner?.teamName || owner?.managerName || owner?.rosterId || 'AS').trim();
  const words = label.split(/\s+/).filter(Boolean);
  if (!words.length) return 'AS';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getDraftOwnerAvatarMarkup(owner) {
  const initials = escapeHtml(getDraftOwnerInitials(owner));
  if (!owner?.photoUrl) {
    return `<span class="draft-owner-initials" aria-hidden="true">${initials}</span>`;
  }

  return `
    <span class="relative shrink-0">
      <img src="${escapeHtml(owner.photoUrl)}" class="draft-owner-photo" alt="${escapeHtml(owner.teamName || 'Draft owner')} logo" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');">
      <span class="draft-owner-initials hidden" aria-hidden="true">${initials}</span>
    </span>
  `;
}

function formatDraftStatus(status) {
  const normalized = String(status || '').replace(/_/g, ' ').trim();
  if (!normalized) return 'Draft';
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderDraftBoardSkeleton() {
  const root = getDraftBoardRoot();
  if (!root) return;

  root.innerHTML = `
    <div class="draft-board-shell">
      ${Array.from({ length: 3 }).map((_, roundIndex) => `
        <section class="draft-round-card glass-panel">
          <div class="mb-4 flex items-center justify-between">
            <div class="h-5 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
            <div class="h-4 w-12 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800"></div>
          </div>
          <div class="space-y-3">
            ${Array.from({ length: roundIndex === 0 ? 5 : 4 }).map(() => `
              <div class="draft-pick-card">
                <div class="h-9 w-12 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
                  <div class="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `;
}

function renderDraftBoardEmpty(message) {
  const root = getDraftBoardRoot();
  if (!root) return;

  root.innerHTML = `
    <div class="glass-panel rounded-3xl border border-slate-200 bg-white/90 p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <p class="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">${escapeHtml(message)}</p>
    </div>
  `;
}

function updateDraftBoardHeader(payload) {
  const status = document.getElementById('draft-board-status');
  const updated = document.getElementById('draft-board-updated');
  const summary = document.getElementById('draft-board-summary');

  if (status) status.textContent = formatDraftStatus(payload?.status);
  if (updated) updated.textContent = formatTimestamp(payload?.updatedAt);
  if (summary) {
    const roundCount = Number(payload?.roundCount || 0);
    const teamCount = Number(payload?.teamCount || 0);
    const tradedCount = Number(payload?.tradedPickCount || 0);
    const pieces = [];
    if (roundCount && teamCount) pieces.push(`${roundCount} rounds, ${teamCount} teams`);
    if (tradedCount) pieces.push(`${tradedCount} traded pick${tradedCount === 1 ? '' : 's'}`);
    summary.textContent = pieces.length ? pieces.join(' / ') : 'Board loading';
  }
}

function renderDraftOwnerLine(owner) {
  const manager = String(owner?.managerName || '').trim();
  return `
    <div class="min-w-0">
      <p class="truncate text-sm font-black italic uppercase leading-tight text-slate-950 dark:text-white">${escapeHtml(owner?.teamName || 'Unknown')}</p>
      ${manager ? `<p class="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">${escapeHtml(manager)}</p>` : ''}
    </div>
  `;
}

function renderSelectedPlayer(player) {
  if (!player) return '';
  const teamLabel = getPlayerTeamLabel(player);
  return `
    <div class="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
      <span class="player-name-with-position">
        <span class="truncate">${escapeHtml(player.name)}</span>
        ${renderPositionPill(player.position)}
        ${teamLabel ? `<span class="font-bold opacity-75">${escapeHtml(teamLabel)}</span>` : ''}
      </span>
    </div>
  `;
}

function renderDraftUnresolvedCandidates(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (!list.length) return '';

  return `
    <div class="draft-tbd-candidates" aria-label="Possible teams for this unresolved pick">
      ${list.map((candidate) => `
        <span class="draft-tbd-candidate">
          ${getDraftOwnerAvatarMarkup(candidate)}
          <span class="min-w-0 truncate">${escapeHtml(candidate.teamName || 'Unknown')}</span>
        </span>
      `).join('')}
    </div>
  `;
}

function renderDraftBoard(payload, isStale = false) {
  const root = getDraftBoardRoot();
  const rounds = Array.isArray(payload?.rounds) ? payload.rounds : [];
  if (!root) return;

  updateDraftBoardHeader(payload);

  if (!rounds.length) {
    renderDraftBoardEmpty('No draft board is available yet.');
    return;
  }

  root.innerHTML = `
    <div class="space-y-4">
      ${isStale ? `<div class="${getBettingStatusClass('warning')}">Showing the most recent cached draft board because the live Sleeper request failed.</div>` : ''}
      ${payload?.warnings?.length ? `<div class="${getBettingStatusClass('warning')}">${payload.warnings.map(escapeHtml).join(' ')}</div>` : ''}
      <div class="draft-board-shell">
        ${rounds.map((round, roundIndex) => {
          const mobileRoundsCollapse = window.matchMedia('(max-width: 767px)').matches;
          const collapsed = mobileRoundsCollapse && roundIndex > 0;
          const roundId = `draft-round-${round.round}`;
          return `
          <section class="draft-round-card glass-panel" aria-label="Round ${round.round}" data-draft-round data-collapsed="${collapsed ? 'true' : 'false'}">
            <button type="button" class="draft-round-heading" data-draft-round-toggle aria-expanded="${collapsed ? 'false' : 'true'}" aria-controls="${roundId}">
              <h3>Round ${escapeHtml(round.round)}</h3>
              <span class="draft-round-heading-meta">
                <span>${Array.isArray(round.picks) ? round.picks.length : 0} picks</span>
                <svg class="draft-round-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6"></path></svg>
              </span>
            </button>
            <div id="${roundId}" class="space-y-3 draft-round-body">
              ${(round.picks || []).map((pick) => {
                const originalOwner = pick.originalOwner || {};
                const currentOwner = pick.currentOwner || {};
                const previousOwner = pick.previousOwner || originalOwner;
                const traded = pick.traded === true;
                const unresolved = pick.unresolved === true;
                const tradeLabel = traded
                  ? `From ${previousOwner?.teamName || originalOwner?.teamName || 'original owner'}`
                  : unresolved
                    ? 'Order still to be determined'
                    : '';
                const cardClass = [
                  'draft-pick-card',
                  traded ? 'draft-pick-card--traded' : '',
                  unresolved ? 'draft-pick-card--tbd' : ''
                ].filter(Boolean).join(' ');
                const metaMarkup = traded || unresolved
                  ? `<div class="draft-pick-meta">
                      ${traded ? '<span class="draft-trade-badge">Traded</span>' : ''}
                      ${unresolved ? '<span class="draft-tbd-badge">TBD</span>' : ''}
                      ${tradeLabel ? `<span>${escapeHtml(tradeLabel)}</span>` : ''}
                    </div>`
                  : '';
                return `
                  <article class="${cardClass}">
                    <div class="draft-pick-number">${escapeHtml(pick.pickLabel || '')}</div>
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                      ${unresolved ? '<span class="draft-tbd-icon" aria-hidden="true">?</span>' : getDraftOwnerAvatarMarkup(currentOwner)}
                      ${unresolved
                        ? '<div class="min-w-0"><p class="truncate text-sm font-black italic uppercase leading-tight text-slate-950 dark:text-white">To Be Determined</p><p class="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">One of the remaining teams</p></div>'
                        : renderDraftOwnerLine(currentOwner)}
                    </div>
                    ${metaMarkup}
                    ${unresolved ? renderDraftUnresolvedCandidates(pick.unresolvedCandidates) : ''}
                    ${renderSelectedPlayer(pick.selectedPlayer)}
                  </article>
                `;
              }).join('')}
            </div>
          </section>
        `;
        }).join('')}
      </div>
    </div>
  `;
}

function setupDraftBoardControls() {
  const root = getDraftBoardRoot();
  if (!root || root.dataset.draftBoardBound === 'true') return;

  root.dataset.draftBoardBound = 'true';
  root.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-draft-round-toggle]');
    if (!toggle) return;

    const round = toggle.closest('[data-draft-round]');
    if (!round) return;

    const collapsed = round.dataset.collapsed === 'true';
    round.dataset.collapsed = collapsed ? 'false' : 'true';
    toggle.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
  });
}

async function loadDraftBoardData() {
  if (!getDraftBoardRoot()) return;
  const cached = getCachedJson(DRAFT_BOARD_CACHE_KEY);
  if (cached) {
    draftBoardData = cached;
    renderDraftBoard(cached, true);
  } else {
    renderDraftBoardSkeleton();
  }

  try {
    const payload = await fetchJsonp('api/draft-board');
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Draft board could not be loaded.');
    }
    draftBoardData = payload;
    setCachedJson(DRAFT_BOARD_CACHE_KEY, payload);
    renderDraftBoard(payload);
  } catch (error) {
    console.error(error);
    if (cached) {
      draftBoardData = cached;
      renderDraftBoard(cached, true);
      return;
    }
    renderDraftBoardEmpty('Draft board could not be loaded.');
  }
}

function getMatchupsRoot() {
  return document.getElementById('matchups-root');
}

function getMatchupInitials(team) {
  return getMemberInitials(team?.teamName || team?.managerName || 'AS');
}

function getMatchupBackdropStyle(team) {
  if (!team?.photoUrl) return '';
  return `style="background-image: url('${String(team.photoUrl).replace(/'/g, '%27')}');"`;
}

function renderMatchupsSkeleton() {
  const root = getMatchupsRoot();
  if (!root) return;

  root.innerHTML = `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      ${Array.from({ length: 2 }).map(() => `
        <article class="matchup-card glass-panel">
          <div class="grid grid-cols-2 gap-2">
            ${Array.from({ length: 2 }).map(() => `
              <div class="matchup-team-panel">
                <div class="h-14 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800"></div>
                <div class="mt-4 h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
                <div class="mt-3 h-8 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
              </div>
            `).join('')}
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderMatchupsEmpty(message) {
  const root = getMatchupsRoot();
  if (!root) return;

  root.innerHTML = `
    <div class="glass-panel rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <p class="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">${escapeHtml(message)}</p>
    </div>
  `;
}

function updateMatchupsHeader(payload) {
  const updated = document.getElementById('matchups-updated');
  const summary = document.getElementById('matchups-summary');
  const count = Array.isArray(payload?.matchups) ? payload.matchups.length : 0;
  if (updated) updated.textContent = payload?.updatedAt ? formatTimestamp(payload.updatedAt) : 'Sync failed';
  if (summary) {
    summary.textContent = count
      ? `${count} matchup${count === 1 ? '' : 's'} loaded`
      : 'No active matchups';
  }
}

function renderMatchupTeam(team, side) {
  const score = String(team?.weekPoints || '').trim() || '--';
  const record = String(team?.record || '').trim() || '--';
  const label = String(team?.teamName || 'Unknown').trim();
  return `
    <div class="matchup-team-panel matchup-team-panel--${side}" ${getMatchupBackdropStyle(team)}>
      <div class="matchup-team-overlay">
        <div class="min-w-0">
          <p class="truncate text-sm font-black italic uppercase leading-tight text-white">${escapeHtml(label)}</p>
          ${team?.managerName ? `<p class="mt-1 truncate text-xs font-bold text-white/72">${escapeHtml(team.managerName)}</p>` : ''}
        </div>
        <div class="mt-auto grid grid-cols-2 gap-2 text-center">
          <div class="matchup-stat-pill">
            <span>Record</span>
            <strong>${escapeHtml(record)}</strong>
          </div>
          <div class="matchup-stat-pill">
            <span>Score</span>
            <strong>${escapeHtml(score)}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMatchups(payload, isStale = false) {
  const root = getMatchupsRoot();
  const matchups = Array.isArray(payload?.matchups) ? payload.matchups : [];
  if (!root) return;

  updateMatchupsHeader(payload);

  if (!matchups.length) {
    renderMatchupsEmpty('No active matchups are available yet.');
    return;
  }

  root.innerHTML = `
    <div class="space-y-4">
      ${isStale ? `<div class="${getBettingStatusClass('warning')}">Showing the most recent cached matchups because the live sheet request failed.</div>` : ''}
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        ${matchups.map((matchup) => {
          const teams = matchup.teams || [];
          return `
            <article class="matchup-card glass-panel group" aria-label="Matchup ${escapeHtml(matchup.matchupId)}">
              <div class="matchup-card-accent" aria-hidden="true"></div>
              <div class="matchup-card-heading">
                <span>Matchup ${escapeHtml(matchup.matchupId)}</span>
              </div>
              <div class="matchup-versus-grid">
                ${renderMatchupTeam(teams[0], 'left')}
                <div class="matchup-vs-badge" aria-hidden="true">VS</div>
                ${renderMatchupTeam(teams[1], 'right')}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function loadMatchupsData() {
  if (!getMatchupsRoot()) return;
  const cached = getCachedJson(MATCHUPS_CACHE_KEY);
  if (cached) {
    matchupsData = cached;
    matchupsDataIsStale = true;
    renderHomeMatchupSummaries(cached);
    renderMatchups(cached, true);
  } else {
    renderMatchupsSkeleton();
  }

  try {
    const payload = await fetchJsonp('api/matchups-data');
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.error || 'Matchups could not be loaded.');
    }
    matchupsData = payload;
    matchupsDataIsStale = false;
    setCachedJson(MATCHUPS_CACHE_KEY, payload);
    renderHomeMatchupSummaries(payload);
    renderMatchups(payload);
  } catch (error) {
    console.error(error);
    if (cached) {
      matchupsData = cached;
      matchupsDataIsStale = true;
      renderHomeMatchupSummaries(cached);
      renderMatchups(cached, true);
      return;
    }
    updateMatchupsHeader({ updatedAt: '' });
    renderMatchupsEmpty(`Matchups could not be loaded: ${error.message || error}`);
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

function getBettingSeasonBetsWonValue(member) {
  const raw = String(member?.seasonBetsWon ?? '').trim();
  return raw || '0';
}

function getBettingSeasonBetsWonNumber(member) {
  const raw = getBettingSeasonBetsWonValue(member).replace(/,/g, '');
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function getBettingSeasonBetsWonMarkup(member, size = 'default') {
  const sizeClass = size === 'large' ? ' betting-season-total--large' : '';
  return `
    <span class="betting-season-total${sizeClass}" aria-label="${escapeHtml(member?.name || 'Member')} season total bets won: ${escapeHtml(getBettingSeasonBetsWonValue(member))}">
      <strong>${escapeHtml(getBettingSeasonBetsWonValue(member))}</strong>
      <span>Total</span>
    </span>
  `;
}

function shouldShowBettingLeaders() {
  if (!bettingData) return false;

  const mode = String(bettingData.mode || '').trim().toLowerCase();
  const isOffseason = mode
    ? mode === 'offseason'
    : (() => {
        const month = new Date().getMonth();
        return month >= 1 && month <= 7;
      })();
  if (isOffseason) return true;

  const weekMatch = String(bettingData.week || '').match(/\d+/);
  const week = weekMatch ? Number(weekMatch[0]) : 0;
  return week >= 4;
}

function renderBettingLeaders() {
  if (!shouldShowBettingLeaders() || !Array.isArray(bettingData.members)) return '';

  const leaders = bettingData.members
    .map((member, index) => ({
      member,
      index,
      total: getBettingSeasonBetsWonNumber(member)
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.index - b.index;
    })
    .slice(0, 5);

  if (!leaders.length) return '';

  const maxTotal = Math.max(...leaders.map((entry) => entry.total), 1);
  const leaderRows = leaders.map((entry, index) => {
    const width = Math.max((entry.total / maxTotal) * 100, 7);
    return `
      <li class="betting-leader-row">
        <span class="betting-leader-rank">${index + 1}</span>
        ${getBettingMemberAvatarMarkup(entry.member, 'tiny')}
        <span class="betting-leader-name">${escapeHtml(entry.member.name)}</span>
        <span class="betting-leader-track" aria-hidden="true">
          <span class="betting-leader-bar" style="width: ${width.toFixed(2)}%;"></span>
        </span>
        <strong class="betting-leader-total">${escapeHtml(getBettingSeasonBetsWonValue(entry.member))}</strong>
      </li>
    `;
  }).join('');

  return `
    <section class="betting-leaders-card glass-panel" aria-label="Top five betting leaders">
      <div class="betting-leaders-heading">
        <div>
          <p class="betting-leaders-kicker">Season Total</p>
          <h2>Betting Leaders</h2>
        </div>
        <span>Top 5</span>
      </div>
      <ol class="betting-leader-list">
        ${leaderRows}
      </ol>
    </section>
  `;
}

function getBettingMemberAvatarMarkup(member, size = 'default') {
  const isLarge = size === 'large';
  const isTiny = size === 'tiny';
  const isCompact = size === 'compact';
  const sizeClass = isLarge ? 'large' : isTiny ? 'tiny' : isCompact ? 'compact' : '';
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
  const actions = actionsMarkup
    ? `<div class="flex items-center gap-3">${actionsMarkup}</div>`
    : '';
  return `
    <div class="flex flex-col gap-4 px-1 md:flex-row md:items-start md:justify-between">
      <div class="space-y-3">
        <h2 class="text-3xl font-black uppercase italic tracking-tight">${escapeHtml(getBettingWeekLabel())}</h2>
        <div class="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] sm:gap-3 sm:tracking-[0.18em]">
          <button type="button" data-betting-refresh class="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:border-pink-500 hover:text-pink-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:px-4" aria-label="Refresh betting data">${escapeHtml(formatCompactTimestamp(bettingData?.updatedAt))}</button>
          ${bettingData?.resultsPosted ? '<span class="rounded-full bg-emerald-500 px-4 py-2 text-white shadow-lg shadow-emerald-500/20">Finalized</span>' : '<span class="rounded-full bg-pink-500 px-4 py-2 text-white shadow-lg shadow-pink-500/20">Open</span>'}
        </div>
      </div>
      ${actions}
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
    <button type="button" data-betting-member-row="${member.row}" class="betting-member-tile glass-panel group min-h-32 rounded-2xl border border-slate-200 bg-white/90 px-3 py-4 text-center shadow-sm transition hover:border-pink-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/70" aria-label="${escapeHtml(member.name)} ${member.submitted ? 'submitted' : 'open'}">
      <span class="betting-member-tile-accent absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-rose-400 to-orange-300" aria-hidden="true"></span>
      <div class="betting-member-tile-content flex h-full min-w-0 flex-col items-center justify-center gap-3">
        <div class="betting-member-tile-head">
          ${getBettingMemberAvatarMarkup(member, 'compact')}
          ${getBettingSeasonBetsWonMarkup(member)}
        </div>
        <div class="w-full min-w-0">
          <p class="truncate text-sm font-black italic uppercase leading-tight tracking-tight text-slate-900 group-hover:text-pink-500 dark:text-white">${escapeHtml(member.name)}</p>
          <span class="${member.submitted ? 'bg-emerald-500 text-white' : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'} mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]">${member.submitted ? 'In' : 'Open'}</span>
        </div>
      </div>
    </button>
  `).join('');

  root.innerHTML = `
    <div class="space-y-6">
      ${renderBettingLeaders()}
      ${renderBettingHeader()}
      ${getBettingStatusMarkup()}
      ${bettingData.warnings?.length ? `
        <div class="${getBettingStatusClass('warning')}">${bettingData.warnings.map(escapeHtml).join(' ')}</div>
      ` : ''}
      <div class="betting-member-grid">
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
      ${renderBettingLeaders()}
      ${renderBettingHeader(backButton)}
      ${getBettingStatusMarkup()}
      <div class="glass-panel rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="flex min-w-0 items-center gap-4">
            ${getBettingMemberAvatarMarkup(member, 'large')}
            <div class="min-w-0">
              <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Selected Team</p>
              <div class="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                <h3 class="truncate text-2xl font-black italic uppercase tracking-tight text-slate-950 dark:text-white">${escapeHtml(member.name)}</h3>
                ${getBettingSeasonBetsWonMarkup(member, 'large')}
              </div>
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

function setupHeaderAudioEasterEgg() {
  const trigger = document.getElementById('page-title-audio-trigger');
  const audio = document.getElementById('header-easter-egg-audio');
  if (!trigger || !audio) return;

  trigger.addEventListener('click', () => {
    audio.pause();
    if (audio.readyState > 0) audio.currentTime = 0;
    const playback = audio.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch((error) => console.warn('Header audio could not be played.', error));
    }
  });
}

function setupHomeShortcuts() {
  document.querySelectorAll('[data-jump-to-draft]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = document.getElementById('draft-board-section');
      if (!section) return;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function setActiveTab(tabName, shouldScroll = false) {
  const enabledTabs = MATCHUPS_TAB_ENABLED
    ? ['home', 'matchups', 'betting']
    : ['home', 'betting'];
  const activeTab = enabledTabs.includes(tabName) ? tabName : 'home';
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
  if (activeTab === 'matchups') {
    if (matchupsData) {
      renderMatchups(matchupsData, matchupsDataIsStale);
    } else {
      loadMatchupsData();
    }
  }
}

function setupAppTabs() {
  const matchupsTab = document.getElementById('tab-matchups');
  if (matchupsTab) {
    matchupsTab.hidden = !MATCHUPS_TAB_ENABLED;
    matchupsTab.disabled = !MATCHUPS_TAB_ENABLED;
    matchupsTab.setAttribute('aria-disabled', MATCHUPS_TAB_ENABLED ? 'false' : 'true');
  }

  const tabs = Array.from(document.querySelectorAll('[data-app-tab]'))
    .filter((button) => !button.hidden && !button.disabled);
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
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    registration.update();
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}

async function bootstrap() {
  setupThemeControls();
  setupHeaderAudioEasterEgg();
  setupInstallPrompt();
  setupScrollBehavior();
  setupHomeShortcuts();
  setupAppTabs();
  setupCaptainDialog();
  setupBettingControls();
  setupDraftBoardControls();
  setupStandingsAccordion();
  setupAdminEditing();
  await registerServiceWorker();
  document.getElementById('updated-at').addEventListener('click', async () => {
    await loadStandings();
    loadHomeMatchupsData();
    loadCaptainData();
  });
  applyConfig(DEFAULT_CONFIG);
  loadTickerData();

  try {
    await loadConfig();
  } catch (error) {
    console.error(error);
    setBanner('Live app configuration could not be loaded. The Apps Script deployment appears to require sign-in, so anonymous visitors are falling back to default branding.', 'error');
  }

  await loadStandings();
  loadHomeMatchupsData();
  loadCaptainData();
  loadDraftBoardData();
  await dismissSplash();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
  bootstrap();
}

