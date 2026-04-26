const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwtM_NX16wFOHssvhvP2Iw7FI_7YcVgJ9-5DNbvNOblMxifawE4R-F_eiOLU1NsEggF/exec';
const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=600&auto=format&fit=crop';
const THEME_KEY = 'theme';
const CONFIG_CACHE_KEY = 'always-smooth-config';
const DATA_CACHE_KEY = 'always-smooth-league-data';
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
      'api/update-team-field': 'update-team-field'
    };
    const route = routeMap[path] || path.replace(/^\//, '');
    const url = buildApiUrl(route, { ...params, callback: callbackName });

    script.src = url.toString();
    script.async = true;

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out loading ${path}`));
    }, 15000);

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
  document.title = `${config.appName || 'Always Smooth'} ${config.leagueSeason || ''}`.trim();
  document.querySelector('meta[name="theme-color"]').setAttribute('content', config.appThemeColor || '#ec4899');
  document.getElementById('page-title').textContent = config.appShortName || 'Always Smooth';
  document.getElementById('season-pill').textContent = `Season ${config.leagueSeason || '--'}`;
  document.getElementById('week-pill').textContent = `Week ${config.leagueWeek || '--'}`;
  document.getElementById('standings-subtitle').textContent = `${config.leagueSeason || 'Current'} Regular Season`;
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

