/** @OnlyCurrentDoc */
'use strict';

/**
* Simple trigger that runs each time the user opens the
* spreadsheet.
*
* Adds a menu item to update the records.
*
* @param {Object} e The onOpen() event object.
*/
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Update Records')
    .addItem('Initialize Settings', 'ensureSettingsSheet')
    .addItem('Fetch Teams', 'fetchLeagueMembersData')
    .addItem('Refresh Team Records', 'updateRostersAndRecordsData')
    // .addItem('Click to refresh Team Records', 'getSleeperStandings')
    .addItem('Refresh Team Rosters', 'fetchAndPopulateRosters')
    .addItem('Refresh Matchups', 'fetchMatchupData')
    .addItem('Retrieve Draft Data', 'fetchDraftPicksData')
    .addItem('Fetch Player Data', 'fetchSleeperPlayers')
    .addItem('Clear Betting Sheet', 'clearRanges')
    .addItem('Clear App Data Sheet', 'clearAppDataRange')
    .addToUi();
  if (!e) console.log(`New "Update Records" menu was added in the spreadsheet's menu bar.`);
}

const GLOBAL_LEAGUE_ID = '1256670617722163200'; // 2025 Season

/**
 * Banner image: any https URL, or a Google Drive share / file link. Drive file ids
 * are rewritten to lh3.googleusercontent.com (same CDN shape Glide uses) so <img> works.
 */
const HEADER_IMAGE_URL =
  'https://drive.google.com/file/d/1fqOjVGeeG2OR821xZEccYQ5Ii_YZD5uD/view?usp=drivesdk';
// const GLOBAL_LEAGUE_ID = '1121938386224357376'; // 2024 Season
// const GLOBAL_LEAGUE_ID = '992182986533294080'; // 2023 Season

const SETTINGS_SHEET = 'Settings';
const SETTINGS_SEASON_CELL = 'B2';
const SETTINGS_WEEK_CELL = 'B3';
const SETTINGS_LEAGUE_ID_CELL = 'B4';
const SETTINGS_APP_ICON_CELL = 'B5';
const DEFAULT_LEAGUE_SEASON = '';
const DEFAULT_LEAGUE_WEEK = '';
const DEFAULT_LEAGUE_ID = GLOBAL_LEAGUE_ID;
const DEFAULT_APP_ICON_URL = 'https://drive.google.com/file/d/1M-Q8iesdrChF0Nf4U7_d0doV2esUaov2/view?usp=drive_link';
const APP_NAME = 'Always Smooth League';
const APP_SHORT_NAME = 'Always Smooth';
const APP_THEME_COLOR = '#ec4899';
const APP_BACKGROUND_COLOR = '#020617';

const BETTING_SHEET = 'App Data Collection';
const BETTING_PROMPT_ROW = 1;
const BETTING_MEMBER_START_ROW = 2;
const BETTING_MEMBER_COUNT = 10;
const BETTING_MEMBER_PHOTO_COL = 14; // Column N (1-based)
const BETTING_RESULTS_ROW = 12;
const BETTING_MAPPING_ROW = 13;
const BETTING_FIRST_BET_COL = 2; // Column B (1-based)
const BETTING_BET_COUNT = 6;
const BETTING_OPTION_BANK_FIRST_COL = 8; // Column H (1-based)
const BETTING_OPTION_BANK_COLS = 4; // H:K
const BETTING_OPTION_BANK_ROWS = 6; // H1:K6
const BETTING_MAX_PICK_LENGTH = 120;

/** Sheet tab written by fetchLeagueMembersData / updateRostersAndRecordsData */
const ROSTERS_RECORDS_SHEET = 'Rosters & Records';
/** 0-based column index when "Streak" header is missing (column G) */
const ROSTERS_STREAK_COL_FALLBACK = 6;
/** 0-based column for manager display name when header "Display Name" is used (column J) */
const ROSTERS_DISPLAY_NAME_COL_FALLBACK = 9;

/** Optional tab: supplemental team data columns matched to standings by Team Name */
const TEAMS_SHEET = 'Teams';
const TEAMS_MANAGER_PHOTO_COL = 8; // Column H (1-based)
const TEAMS_MULLIGAN_COL = 5; // Column E (1-based)
const TEAMS_TURKEY_WATCH_COL = 9; // Column I (1-based)
const TEAMS_TROPHIES_COL = 12; // Column L (1-based)
const TEAMS_SLEEPER_TEAM_IMAGE_COL = 13; // Column M (1-based)
const TEAMS_MVP_NAME_COL = 17; // Column Q (1-based)
const TEAMS_BEER_TROPHIES_COL = 19; // Column S (1-based)
const TEAMS_MVP_IMAGE_COL = 22; // Column V (1-based)
/** Teams tab: title/instructions may occupy row 1; column headers are on this row (1-based). */
const TEAMS_HEADER_ROW = 2;
/** First row of team data below the header row */
const TEAMS_DATA_START_ROW = TEAMS_HEADER_ROW + 1;
const ADMIN_CODE_PROPERTY = 'ALWAYS_SMOOTH_ADMIN_CODE';
const EDITABLE_TEAM_FIELD_CONFIG = {
  beerTrophies: {
    label: 'Beer Trophies',
    col: TEAMS_BEER_TROPHIES_COL,
    maxLength: 40
  }
};

/**
 * Pulls a Google Drive file id from share links, uc URLs, or lh3.googleusercontent.com/d/…
 * (Glide-style CDN URLs).
 * @param {string} url
 * @return {string}
 */
function extractDriveFileId_(url) {
  if (!url || typeof url !== 'string') return '';
  var m = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

/**
 * Embeddable image URL for Drive-hosted files (matches Glide / Chrome resolved src).
 * @param {string} fileId
 * @return {string}
 */
function driveFileIdToLh3Src_(fileId) {
  if (!fileId) return '';
  return 'https://lh3.googleusercontent.com/d/' + fileId + '=w1920';
}

/**
 * @param {string} raw HEADER_IMAGE_URL value
 * @return {string} value for <img src>
 */
function resolveHeaderImageSrc_(raw) {
  if (!raw) return '';
  var fid = extractDriveFileId_(raw);
  if (fid) return driveFileIdToLh3Src_(fid);
  return raw;
}

/**
 * Reads the current league season from the Settings sheet.
 * Falls back to blank so the UI renders a placeholder when Settings is missing.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {string}
 */
function getLeagueSeason_(spreadsheet) {
  return getSettingsValue_(spreadsheet, SETTINGS_SEASON_CELL, DEFAULT_LEAGUE_SEASON);
}

/**
 * Reads a Settings-sheet value with a safe fallback.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {string} a1Notation
 * @param {string} fallback
 * @return {string}
 */
function getSettingsValue_(spreadsheet, a1Notation, fallback) {
  if (!spreadsheet) return fallback;
  var sheet = spreadsheet.getSheetByName(SETTINGS_SHEET);
  if (!sheet) return fallback;
  var raw = sheet.getRange(a1Notation).getDisplayValue();
  var value = String(raw || '').trim();
  return value || fallback;
}

/**
 * Reads the current league week from the Settings sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {string}
 */
function getLeagueWeek_(spreadsheet) {
  return getSettingsValue_(spreadsheet, SETTINGS_WEEK_CELL, DEFAULT_LEAGUE_WEEK);
}

/**
 * Reads the current league id from the Settings sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {string}
 */
function getLeagueId_(spreadsheet) {
  return getSettingsValue_(spreadsheet, SETTINGS_LEAGUE_ID_CELL, DEFAULT_LEAGUE_ID);
}

/**
 * Reads the current app icon URL from the Settings sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {string}
 */
function getAppIconUrl_(spreadsheet) {
  return getSettingsValue_(spreadsheet, SETTINGS_APP_ICON_CELL, DEFAULT_APP_ICON_URL);
}

/**
 * Creates the Settings sheet with default values if it does not exist yet.
 */
function ensureSettingsSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) return;

  var sheet = spreadsheet.getSheetByName(SETTINGS_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SETTINGS_SHEET);
  }

  sheet.getRange('A1:B5').setValues([
    ['Setting', 'Value'],
    ['Season', getLeagueSeason_(spreadsheet)],
    ['Week', getLeagueWeek_(spreadsheet)],
    ['League ID', getLeagueId_(spreadsheet)],
    ['App Icon URL', getAppIconUrl_(spreadsheet)]
  ]);
  sheet.getRange('A1:B1').setFontWeight('bold');
  sheet.autoResizeColumns(1, 2);
}

/**
 * Formats direct image URLs and Google Drive share links into embeddable image sources.
 * @param {string} raw
 * @return {string}
 */
function formatDriveUrl(raw) {
  return resolveHeaderImageSrc_(raw);
}

/**
 * Manifest payload for browser install flows.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {Object}
 */
function buildWebAppManifest_(spreadsheet) {
  var webAppUrl = ScriptApp.getService().getUrl() || '';
  var iconSrc = formatDriveUrl(getAppIconUrl_(spreadsheet));

  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: 'Fantasy football league dashboard for standings, matchups, and draft data.',
    start_url: webAppUrl || '.',
    scope: webAppUrl || '.',
    display: 'standalone',
    orientation: 'portrait',
    background_color: APP_BACKGROUND_COLOR,
    theme_color: APP_THEME_COLOR,
    icons: iconSrc
      ? [
          {
            src: iconSrc,
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: iconSrc,
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      : []
  };
}

/**
 * @param {string} name
 * @return {string}
 */
function normalizeTeamNameKey_(name) {
  if (name === '' || name === null || name === undefined) return '';
  return String(name).trim().toLowerCase();
}

/**
 * Real-world / Sleeper label for a user (first + last if present, else display_name).
 * @param {Object} user Sleeper user object
 * @return {string}
 */
function sleeperManagerDisplayLabel_(user) {
  if (!user) return '';
  var fn = String(user.first_name || '').trim();
  var ln = String(user.last_name || '').trim();
  var combined = (fn + ' ' + ln).trim();
  if (combined) return combined;
  return String(user.display_name || '').trim();
}

/**
 * @param {Array} headers Rosters & Records row 1
 * @return {number} 0-based column index, or -1 if none
 */
function findRostersDisplayNameColumn_(headers) {
  var norms = [];
  for (var c = 0; c < headers.length; c++) {
    norms[c] = normalizeTeamsHeader_(headers[c]);
  }
  var candidates = [
    'display name',
    'actual name',
    'manager name',
    'owner name',
    'full name',
    'real name',
    'username',
    'user name',
    'name'
  ];
  var i;
  var j;
  for (i = 0; i < candidates.length; i++) {
    j = norms.indexOf(candidates[i]);
    if (j !== -1) return j;
  }
  for (c = 0; c < norms.length; c++) {
    if (norms[c].indexOf('display') !== -1 && norms[c].indexOf('team') === -1) return c;
  }
  if (headers.length > ROSTERS_DISPLAY_NAME_COL_FALLBACK) return ROSTERS_DISPLAY_NAME_COL_FALLBACK;
  return -1;
}

/**
 * Formats streak cell for display after W-L, e.g. " (5W)" or " (4L)".
 * @param {*} raw Rosters & Records "Streak" cell (e.g. from Sleeper metadata.streak)
 * @return {string} suffix only, or "" if none
 */
function formatStreakSuffixForRecord_(raw) {
  if (raw === '' || raw === null || raw === undefined) return '';
  var s = String(raw).trim();
  if (!s) return '';
  var lower = s.toLowerCase();
  if (lower === 'n/a' || lower === 'na' || lower === '—' || lower === '-') return '';

  var m = s.match(/^(\d+)\s*([WwLl])$/);
  if (m) return ' (' + m[1] + m[2].toUpperCase() + ')';

  m = s.match(/^([WwLl])\s*(\d+)$/);
  if (m) return ' (' + m[2] + m[1].toUpperCase() + ')';

  if (/^[Ww]+$/.test(s)) return ' (' + s.length + 'W)';
  if (/^[Ll]+$/.test(s)) return ' (' + s.length + 'L)';

  var last = s.charAt(s.length - 1);
  if (last === 'W' || last === 'w' || last === 'L' || last === 'l') {
    var ch = last.toUpperCase();
    var i = s.length - 1;
    while (i >= 0 && String(s.charAt(i)).toUpperCase() === ch) i--;
    var run = s.length - 1 - i;
    if (run > 0) return ' (' + run + ch + ')';
  }

  return '';
}

/**
 * @param {number} col0 0-based column index
 * @return {string} A–Z, AA, …
 */
function columnIndexToA1Letter_(col0) {
  var n = col0 + 1;
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = ((n - m - 1) / 26) | 0;
  }
  return s;
}

/**
 * @param {*} h
 * @return {string}
 */
function normalizeTeamsHeader_(h) {
  if (h === '' || h === null || h === undefined) return '';
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * True if cell value looks like a photo URL (not a header placeholder like "Photo").
 * @param {*} s
 * @return {boolean}
 */
function looksLikePhotoUrl_(s) {
  if (s === '' || s === null || s === undefined) return false;
  var t = String(s).trim();
  if (!t) return false;
  var lower = t.toLowerCase();
  if (
    lower === 'photo' ||
    lower === 'url' ||
    lower === 'image' ||
    lower === 'link' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === '—' ||
    lower === '-'
  ) {
    return false;
  }
  if (extractDriveFileId_(t) !== '') return true;
  return /^https?:\/\//i.test(t);
}

/**
 * Picks the column on the Teams sheet that holds the Sleeper-style fantasy team name
 * (must match Rosters & Records "Team Name"). Pass the header row cells (e.g. row 2).
 * @param {Array} headers 0-based row of header cells
 * @return {{ col0: number, reason: string }}
 */
function findTeamsSheetTeamNameColumn_(headers) {
  var n = headers.length;
  var norms = [];
  var c;
  for (c = 0; c < n; c++) {
    norms[c] = normalizeTeamsHeader_(headers[c]);
  }

  for (c = 0; c < n; c++) {
    if (norms[c] === 'team name') {
      return { col0: c, reason: 'header matches "Team Name" (any case/spacing)' };
    }
  }
  for (c = 0; c < n; c++) {
    if (norms[c].indexOf('team name') !== -1) {
      return { col0: c, reason: 'header contains "team name"' };
    }
  }
  var fuzzy = ['fantasy team', 'sleeper team', 'roster name', 'team (name)'];
  for (var f = 0; f < fuzzy.length; f++) {
    for (c = 0; c < n; c++) {
      if (norms[c] === fuzzy[f]) {
        return { col0: c, reason: 'header is "' + fuzzy[f] + '"' };
      }
    }
  }
  for (c = 0; c < n; c++) {
    if (norms[c].indexOf('team') !== -1 && norms[c].indexOf('name') !== -1) {
      return { col0: c, reason: 'header contains both "team" and "name"' };
    }
  }
  for (c = 0; c < n; c++) {
    if (norms[c] === 'team') {
      return { col0: c, reason: 'header is "Team" (single word)' };
    }
  }

  var d = 3;
  if (d < n) {
    return {
      col0: d,
      reason:
        'no recognizable team-name header — using column D (same as Rosters & Records); put a "Team Name" header in row ' +
        TEAMS_HEADER_ROW +
        ' or rename your column.'
    };
  }
  return { col0: 0, reason: 'fallback column A (sheet is very narrow)' };
}

function normalizeBooleanCell_(value) {
  if (value === true || value === false) return value;
  if (value === '' || value === null || value === undefined) return false;
  var normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1';
}

/**
 * Builds team name (lowercase key) -> supplemental team fields from the "Teams" sheet.
 * Headers are read from TEAMS_HEADER_ROW; data from TEAMS_DATA_START_ROW onward.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {{ map: Object<string, Object>, diagnostics: Object }}
 */
function buildTeamsSheetDataMap_(spreadsheet) {
  var map = {};
  var diag = {
    teamsSheetFound: false,
    teamsSheetName: TEAMS_SHEET,
    managerPhotoColumn: 'H',
    mulliganColumn: 'E',
    turkeyWatchColumn: 'I',
    trophiesColumn: 'L',
    sleeperTeamImageColumn: 'M',
    teamMvpNameColumn: 'Q',
    beerTrophiesColumn: 'S',
    teamMvpImageColumn: 'V',
    lastRow: 0,
    lastCol: 0,
    teamNameSource: '',
    rowsScanned: 0,
    rowsWithTeamName: 0,
    rowsWithManagerPhoto: 0,
    rowsWithSleeperTeamImage: 0,
    rowsWithTurkeyWatch: 0,
    rowsWithTrophies: 0,
    rowsWithBeerTrophies: 0,
    rowsWithMulliganTrue: 0,
    rowsWithTeamMvpName: 0,
    rowsWithTeamMvpImage: 0,
    mapEntryCount: 0,
    sampleMapKeys: [],
    sampleManagerPhotoPrefixes: [],
    teamNameColumnLetter: '',
    teamNameColumnPickReason: '',
    headerRow: TEAMS_HEADER_ROW,
    dataStartRow: TEAMS_DATA_START_ROW
  };

  var sheet = spreadsheet.getSheetByName(TEAMS_SHEET);
  if (!sheet) {
    diag.note = 'Sheet "' + TEAMS_SHEET + '" was not found in this spreadsheet.';
    return { map: map, diagnostics: diag };
  }
  diag.teamsSheetFound = true;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  diag.lastRow = lastRow;
  diag.lastCol = lastCol;
  if (lastRow < TEAMS_HEADER_ROW || lastCol < 1) {
    diag.note = 'Teams sheet is missing row ' + TEAMS_HEADER_ROW + ' (header row) or has no columns.';
    return { map: map, diagnostics: diag };
  }
  if (lastRow < TEAMS_DATA_START_ROW) {
    diag.note =
      'Teams sheet has headers on row ' +
      TEAMS_HEADER_ROW +
      ' but no data rows below (need data from row ' +
      TEAMS_DATA_START_ROW +
      ' onward).';
    return { map: map, diagnostics: diag };
  }

  var headerLast = Math.max(lastCol, 1);
  var headers = sheet.getRange(TEAMS_HEADER_ROW, 1, TEAMS_HEADER_ROW, headerLast).getValues()[0];
  var pick = findTeamsSheetTeamNameColumn_(headers);
  var nameCol = pick.col0;
  diag.teamNameColumnLetter = columnIndexToA1Letter_(nameCol);
  diag.teamNameColumnPickReason = pick.reason;
  var headerLabel = headers[nameCol];
  diag.teamNameSource =
    headerLabel !== '' && headerLabel != null && String(headerLabel).trim() !== ''
      ? 'column ' + diag.teamNameColumnLetter + ' — row ' + TEAMS_HEADER_ROW + ' header "' + String(headerLabel) + '" (' + pick.reason + ')'
      : 'column ' + diag.teamNameColumnLetter + ' — row ' + TEAMS_HEADER_ROW + ' (' + pick.reason + ')';

  var nameCol1 = nameCol + 1;
  var numRows = lastRow - TEAMS_DATA_START_ROW + 1;
  var nameVals = sheet.getRange(TEAMS_DATA_START_ROW, nameCol1, numRows, 1).getValues();
  var managerPhotoVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_MANAGER_PHOTO_COL, numRows, 1).getValues();
  var mulliganVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_MULLIGAN_COL, numRows, 1).getValues();
  var turkeyWatchVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_TURKEY_WATCH_COL, numRows, 1).getDisplayValues();
  var trophiesVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_TROPHIES_COL, numRows, 1).getDisplayValues();
  var sleeperTeamImageVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_SLEEPER_TEAM_IMAGE_COL, numRows, 1).getValues();
  var teamMvpNameVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_MVP_NAME_COL, numRows, 1).getDisplayValues();
  var beerTrophiesVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_BEER_TROPHIES_COL, numRows, 1).getDisplayValues();
  var teamMvpImageVals = sheet.getRange(TEAMS_DATA_START_ROW, TEAMS_MVP_IMAGE_COL, numRows, 1).getValues();
  diag.rowsScanned = nameVals.length;

  var sampleKeys = [];
  var samplePrefixes = [];
  for (var r = 0; r < nameVals.length; r++) {
    var teamName = nameVals[r][0];
    var rawManagerPhoto = managerPhotoVals[r][0];
    var rawMulligan = mulliganVals[r][0];
    var rawTurkeyWatch = turkeyWatchVals[r][0];
    var rawTrophies = trophiesVals[r][0];
    var rawSleeperTeamImage = sleeperTeamImageVals[r][0];
    var rawTeamMvpName = teamMvpNameVals[r][0];
    var rawBeerTrophies = beerTrophiesVals[r][0];
    var rawTeamMvpImage = teamMvpImageVals[r][0];
    var hasName = !(teamName === '' || teamName === null || teamName === undefined);
    var hasManagerPhoto = !(rawManagerPhoto === '' || rawManagerPhoto === null || rawManagerPhoto === undefined);
    var hasSleeperTeamImage = !(rawSleeperTeamImage === '' || rawSleeperTeamImage === null || rawSleeperTeamImage === undefined);
    var hasTurkeyWatch = !(rawTurkeyWatch === '' || rawTurkeyWatch === null || rawTurkeyWatch === undefined);
    var hasTrophies = !(rawTrophies === '' || rawTrophies === null || rawTrophies === undefined);
    var hasBeerTrophies = !(rawBeerTrophies === '' || rawBeerTrophies === null || rawBeerTrophies === undefined);
    var hasTeamMvpName = !(rawTeamMvpName === '' || rawTeamMvpName === null || rawTeamMvpName === undefined);
    var hasTeamMvpImage = !(rawTeamMvpImage === '' || rawTeamMvpImage === null || rawTeamMvpImage === undefined);
    var mulligan = normalizeBooleanCell_(rawMulligan);
    if (hasName) diag.rowsWithTeamName++;
    if (hasManagerPhoto) diag.rowsWithManagerPhoto++;
    if (hasSleeperTeamImage) diag.rowsWithSleeperTeamImage++;
    if (hasTurkeyWatch) diag.rowsWithTurkeyWatch++;
    if (hasTrophies) diag.rowsWithTrophies++;
    if (hasBeerTrophies) diag.rowsWithBeerTrophies++;
    if (hasTeamMvpName) diag.rowsWithTeamMvpName++;
    if (hasTeamMvpImage) diag.rowsWithTeamMvpImage++;
    if (mulligan) diag.rowsWithMulliganTrue++;
    if (!hasName) continue;
    var key = normalizeTeamNameKey_(teamName);
    if (!key) continue;

    var managerPhoto = hasManagerPhoto && looksLikePhotoUrl_(String(rawManagerPhoto).trim())
      ? formatDriveUrl(String(rawManagerPhoto).trim())
      : '';
    var sleeperTeamImage = hasSleeperTeamImage && looksLikePhotoUrl_(String(rawSleeperTeamImage).trim())
      ? formatDriveUrl(String(rawSleeperTeamImage).trim())
      : '';
    var teamMvpName = hasTeamMvpName ? String(rawTeamMvpName).trim() : '';
    var teamMvpImageUrl = hasTeamMvpImage && looksLikePhotoUrl_(String(rawTeamMvpImage).trim())
      ? formatDriveUrl(String(rawTeamMvpImage).trim())
      : '';
    var turkeyWatch = hasTurkeyWatch ? String(rawTurkeyWatch).trim() : '';
    var trophies = hasTrophies ? String(rawTrophies).trim() : '';
    var beerTrophies = hasBeerTrophies ? String(rawBeerTrophies).trim() : '';

    map[key] = {
      managerPhotoUrl: managerPhoto,
      sleeperTeamImageUrl: sleeperTeamImage,
      teamMvpName: teamMvpName,
      teamMvpImageUrl: teamMvpImageUrl,
      turkeyWatch: turkeyWatch,
      trophies: trophies,
      beerTrophies: beerTrophies,
      mulligan: mulligan
    };

    if (sampleKeys.length < 5) {
      sampleKeys.push(key);
      samplePrefixes.push(managerPhoto.length > 48 ? managerPhoto.substring(0, 48) + '…' : managerPhoto);
    }
  }
  diag.mapEntryCount = Object.keys(map).length;
  diag.sampleMapKeys = sampleKeys;
  diag.sampleRawUrlPrefixes = samplePrefixes;
  return { map: map, diagnostics: diag };
}

/**
 * Frontend config payload for the static GitHub Pages app.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {Object}
 */
function buildClientConfig_(spreadsheet) {
  return {
    appName: APP_NAME,
    appShortName: APP_SHORT_NAME,
    appThemeColor: APP_THEME_COLOR,
    appBackgroundColor: APP_BACKGROUND_COLOR,
    leagueSeason: getLeagueSeason_(spreadsheet),
    leagueWeek: getLeagueWeek_(spreadsheet),
    headerImageSrc: resolveHeaderImageSrc_(HEADER_IMAGE_URL || ''),
    appIconHref: formatDriveUrl(getAppIconUrl_(spreadsheet)),
    updatedAt: new Date().toISOString()
  };
}

/**
 * @param {string} callbackName
 * @return {boolean}
 */
function isValidJsonpCallback_(callbackName) {
  return /^[A-Za-z_$][0-9A-Za-z_$]*(?:\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callbackName);
}

/**
 * Emits JSON by default, or JSONP when a safe callback is provided.
 * @param {Object} payload
 * @param {string} callbackName
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function createApiOutput_(payload, callbackName) {
  var body = JSON.stringify(payload);
  if (callbackName && isValidJsonpCallback_(callbackName)) {
    return ContentService
      .createTextOutput(callbackName + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * @param {string} field
 * @return {string}
 */
function normalizeEditableTeamFieldKey_(field) {
  var normalized = String(field || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'beertrophies') return 'beerTrophies';
  return '';
}

/**
 * @param {string} field
 * @return {{key: string, label: string, col: number, maxLength: number}|null}
 */
function getEditableTeamFieldConfig_(field) {
  var key = normalizeEditableTeamFieldKey_(field);
  if (!key || !EDITABLE_TEAM_FIELD_CONFIG[key]) return null;
  var config = EDITABLE_TEAM_FIELD_CONFIG[key];
  return {
    key: key,
    label: config.label,
    col: config.col,
    maxLength: config.maxLength
  };
}

/**
 * @param {*} raw
 * @param {{label: string, maxLength: number}} config
 * @return {{value: string, error: string}}
 */
function sanitizeEditableTeamFieldValue_(raw, config) {
  var value = raw === null || raw === undefined ? '' : String(raw).trim();
  if (value.length > config.maxLength) {
    return {
      value: '',
      error: config.label + ' must be ' + config.maxLength + ' characters or fewer.'
    };
  }
  if (/^=/.test(value)) {
    return {
      value: '',
      error: config.label + ' cannot start with "=".'
    };
  }
  return { value: value, error: '' };
}

/**
 * Updates one whitelisted Teams-sheet field after validating the admin code.
 * This intentionally supports only low-risk league-maintenance fields.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {Object} params
 * @return {Object}
 */
function updateTeamField_(spreadsheet, params) {
  var fail = function (message) {
    return {
      ok: false,
      error: message,
      updatedAt: new Date().toISOString()
    };
  };

  if (!spreadsheet) return fail('No spreadsheet is available.');

  var expectedAdminCode = PropertiesService
    .getScriptProperties()
    .getProperty(ADMIN_CODE_PROPERTY);
  if (!expectedAdminCode) {
    return fail('Admin updates are not configured. Set Script Property ' + ADMIN_CODE_PROPERTY + '.');
  }

  var providedAdminCode = String(
    params.adminCode || params.admin_code || params.code || ''
  );
  if (providedAdminCode !== String(expectedAdminCode)) {
    return fail('Invalid admin code.');
  }

  var fieldConfig = getEditableTeamFieldConfig_(params.field || params.editField);
  if (!fieldConfig) {
    return fail('That field is not editable from the app.');
  }

  var teamName = String(params.teamName || params.team || '').trim();
  if (!teamName) return fail('Missing team name.');

  var sanitized = sanitizeEditableTeamFieldValue_(params.value, fieldConfig);
  if (sanitized.error) return fail(sanitized.error);

  var sheet = spreadsheet.getSheetByName(TEAMS_SHEET);
  if (!sheet) return fail('Sheet "' + TEAMS_SHEET + '" was not found.');

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < TEAMS_DATA_START_ROW || lastCol < 1) {
    return fail('Sheet "' + TEAMS_SHEET + '" has no editable team rows.');
  }

  var headers = sheet.getRange(TEAMS_HEADER_ROW, 1, 1, Math.max(lastCol, 1)).getValues()[0];
  var pick = findTeamsSheetTeamNameColumn_(headers);
  var nameCol1 = pick.col0 + 1;
  var numRows = lastRow - TEAMS_DATA_START_ROW + 1;
  var nameVals = sheet.getRange(TEAMS_DATA_START_ROW, nameCol1, numRows, 1).getValues();
  var targetKey = normalizeTeamNameKey_(teamName);
  var targetRow = 0;
  for (var r = 0; r < nameVals.length; r++) {
    if (normalizeTeamNameKey_(nameVals[r][0]) === targetKey) {
      targetRow = TEAMS_DATA_START_ROW + r;
    }
  }

  if (!targetRow) return fail('Team "' + teamName + '" was not found on the Teams sheet.');

  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    lock.waitLock(5000);
    hasLock = true;
    sheet.getRange(targetRow, fieldConfig.col).setValue(sanitized.value);
    SpreadsheetApp.flush();
    return {
      ok: true,
      teamName: teamName,
      field: fieldConfig.key,
      label: fieldConfig.label,
      value: sanitized.value,
      row: targetRow,
      column: columnIndexToA1Letter_(fieldConfig.col - 1),
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return fail(err.message || String(err));
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * @param {*} value
 * @return {boolean}
 */
function isBlankDisplayValue_(value) {
  return value === '' || value === null || value === undefined || String(value).trim() === '';
}

/**
 * Normalizes option-bank and mapping labels so sheet-friendly names like
 * "Choice 1", "choice_1", and "choice1" all match.
 * @param {*} value
 * @return {string}
 */
function normalizeBettingOptionKey_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} key normalized betting option key
 * @return {boolean}
 */
function isBettingTeamChoiceKey_(key) {
  return key === 'teamchoice' ||
    key === 'teamchoices' ||
    key === 'teamoption' ||
    key === 'teamoptions' ||
    key === 'teams' ||
    key === 'managerchoice' ||
    key === 'managerchoices' ||
    key === 'manageroption' ||
    key === 'manageroptions' ||
    key === 'managers';
}

/**
 * @param {string} mapping
 * @param {Object<string, {key: string, label: string, options: string[]}>} banksByKey
 * @param {Object<string, {key: string, label: string, options: string[]}>} dynamicOptionsByKey
 * @return {{inputType: string, optionBankKey: string, optionBankLabel: string, options: string[], warning: string}}
 */
function resolveBettingInputConfig_(mapping, banksByKey, dynamicOptionsByKey) {
  var raw = String(mapping || '').trim();
  var key = normalizeBettingOptionKey_(raw);
  if (!key || key === 'text' || key === 'textfield' || key === 'freeform' || key === 'freeanswer') {
    return {
      inputType: 'text',
      optionBankKey: '',
      optionBankLabel: raw || 'Text',
      options: [],
      warning: ''
    };
  }

  var dynamicBank = dynamicOptionsByKey && dynamicOptionsByKey[key];
  if (dynamicBank) {
    if (!dynamicBank.options.length) {
      return {
        inputType: 'text',
        optionBankKey: dynamicBank.key,
        optionBankLabel: dynamicBank.label,
        options: [],
        warning: 'Dynamic option bank "' + dynamicBank.label + '" has no values.'
      };
    }
    return {
      inputType: 'select',
      optionBankKey: dynamicBank.key,
      optionBankLabel: dynamicBank.label,
      options: dynamicBank.options,
      warning: ''
    };
  }

  var bank = banksByKey[key];
  if (!bank) {
    return {
      inputType: 'text',
      optionBankKey: key,
      optionBankLabel: raw,
      options: [],
      warning: 'Input mapping "' + raw + '" does not match an option bank header in H1:K1.'
    };
  }

  if (!bank.options.length) {
    return {
      inputType: 'text',
      optionBankKey: bank.key,
      optionBankLabel: bank.label,
      options: [],
      warning: 'Option bank "' + bank.label + '" has no values.'
    };
  }

  return {
    inputType: bank.options.length > 2 ? 'select' : 'pill',
    optionBankKey: bank.key,
    optionBankLabel: bank.label,
    options: bank.options,
    warning: ''
  };
}

/**
 * @param {Array} membersRaw App Data Collection A2:A11 display values
 * @return {Array<string>}
 */
function extractBettingMemberNames_(membersRaw) {
  var names = [];
  for (var i = 0; i < membersRaw.length; i++) {
    var name = String(membersRaw[i][0] || '').trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * Reads reusable betting option banks from H1:K on App Data Collection.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {{list: Array<{key: string, label: string, options: string[]}>, byKey: Object<string, {key: string, label: string, options: string[]}>}}
 */
function buildBettingOptionBanks_(sheet) {
  var values = sheet
    .getRange(1, BETTING_OPTION_BANK_FIRST_COL, BETTING_OPTION_BANK_ROWS, BETTING_OPTION_BANK_COLS)
    .getDisplayValues();
  var list = [];
  var byKey = {};

  for (var c = 0; c < BETTING_OPTION_BANK_COLS; c++) {
    var label = String(values[0][c] || '').trim();
    if (!label) continue;

    var options = [];
    for (var r = 1; r < values.length; r++) {
      var option = String(values[r][c] || '').trim();
      if (option) options.push(option);
    }

    var key = normalizeBettingOptionKey_(label);
    var bank = {
      key: key,
      label: label,
      options: options
    };
    list.push(bank);
    byKey[key] = bank;
  }

  return {
    list: list,
    byKey: byKey
  };
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Array<string>} memberNames
 * @return {{bets: Array, warnings: string[]}}
 */
function buildWeeklyBetConfigs_(sheet, memberNames) {
  var prompts = sheet
    .getRange(BETTING_PROMPT_ROW, BETTING_FIRST_BET_COL, 1, BETTING_BET_COUNT)
    .getDisplayValues()[0];
  var mappings = sheet
    .getRange(BETTING_MAPPING_ROW, BETTING_FIRST_BET_COL, 1, BETTING_BET_COUNT)
    .getDisplayValues()[0];
  var optionBanks = buildBettingOptionBanks_(sheet);
  var teamChoiceBank = {
    key: 'teamchoice',
    label: 'Team Choice',
    options: Array.isArray(memberNames) ? memberNames : []
  };
  var dynamicOptionsByKey = {};
  [
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
  ].forEach(function (key) {
    if (isBettingTeamChoiceKey_(key)) dynamicOptionsByKey[key] = teamChoiceBank;
  });
  var bets = [];
  var warnings = [];

  for (var i = 0; i < BETTING_BET_COUNT; i++) {
    var mapping = String(mappings[i] || '').trim();
    var inputConfig = resolveBettingInputConfig_(mapping, optionBanks.byKey, dynamicOptionsByKey);
    if (inputConfig.warning) warnings.push('Bet ' + (i + 1) + ': ' + inputConfig.warning);
    bets.push({
      id: 'bet-' + (i + 1),
      index: i,
      column: columnIndexToA1Letter_(BETTING_FIRST_BET_COL - 1 + i),
      prompt: String(prompts[i] || '').trim(),
      mapping: mapping,
      inputType: inputConfig.inputType,
      optionBankKey: inputConfig.optionBankKey,
      optionBankLabel: inputConfig.optionBankLabel,
      options: inputConfig.options
    });
  }

  return {
    bets: bets,
    optionBanks: optionBanks.list,
    warnings: warnings
  };
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {Object}
 */
function getBettingData_(spreadsheet) {
  var fail = function (message) {
    return {
      ok: false,
      error: message,
      updatedAt: new Date().toISOString()
    };
  };

  if (!spreadsheet) return fail('No spreadsheet is available.');

  var sheet = spreadsheet.getSheetByName(BETTING_SHEET);
  if (!sheet) return fail('Sheet "' + BETTING_SHEET + '" was not found.');

  try {
    var membersRaw = sheet
      .getRange(BETTING_MEMBER_START_ROW, 1, BETTING_MEMBER_COUNT, 1)
      .getDisplayValues();
    var memberNames = extractBettingMemberNames_(membersRaw);
    var config = buildWeeklyBetConfigs_(sheet, memberNames);
    var memberPhotosRaw = sheet
      .getRange(BETTING_MEMBER_START_ROW, BETTING_MEMBER_PHOTO_COL, BETTING_MEMBER_COUNT, 1)
      .getValues();
    var picksRaw = sheet
      .getRange(BETTING_MEMBER_START_ROW, BETTING_FIRST_BET_COL, BETTING_MEMBER_COUNT, BETTING_BET_COUNT)
      .getDisplayValues();
    var results = sheet
      .getRange(BETTING_RESULTS_ROW, BETTING_FIRST_BET_COL, 1, BETTING_BET_COUNT)
      .getDisplayValues()[0]
      .map(function (value) {
        return String(value || '').trim();
      });
    var members = [];

    for (var r = 0; r < BETTING_MEMBER_COUNT; r++) {
      var name = String(membersRaw[r][0] || '').trim();
      if (!name) continue;
      var picks = picksRaw[r].map(function (value) {
        return String(value || '').trim();
      });
      var rawPhoto = memberPhotosRaw[r][0];
      var photoUrl = looksLikePhotoUrl_(rawPhoto) ? formatDriveUrl(String(rawPhoto).trim()) : '';
      members.push({
        row: BETTING_MEMBER_START_ROW + r,
        name: name,
        photoUrl: photoUrl,
        picks: picks,
        submitted: picks.some(function (value) {
          return !isBlankDisplayValue_(value);
        })
      });
    }

    return {
      ok: true,
      sheetName: BETTING_SHEET,
      week: getLeagueWeek_(spreadsheet),
      bets: config.bets,
      members: members,
      results: results,
      resultsPosted: results.some(function (value) {
        return !isBlankDisplayValue_(value);
      }),
      optionBanks: config.optionBanks,
      warnings: config.warnings,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return fail(err.message || String(err));
  }
}

/**
 * @param {Object} params
 * @return {Array}
 */
function parseBettingPickValues_(params) {
  var raw = params.picks || params.values || params.entries || '';
  if (raw) {
    try {
      var parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.values)) return parsed.values;
      if (parsed && Array.isArray(parsed.picks)) return parsed.picks;
    } catch (err) {
      return [];
    }
  }

  var values = [];
  var found = false;
  for (var i = 1; i <= BETTING_BET_COUNT; i++) {
    var value =
      params['pick' + i] !== undefined
        ? params['pick' + i]
        : params['bet' + i] !== undefined
          ? params['bet' + i]
          : params['value' + i];
    if (value !== undefined) found = true;
    values.push(value === undefined ? '' : value);
  }
  return found ? values : [];
}

/**
 * @param {*} raw
 * @param {Object} bet
 * @return {{value: string, error: string}}
 */
function sanitizeBettingPickValue_(raw, bet) {
  var value = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!value) return { value: '', error: 'Enter a pick.' };
  if (value.length > BETTING_MAX_PICK_LENGTH) {
    return {
      value: '',
      error: 'Pick must be ' + BETTING_MAX_PICK_LENGTH + ' characters or fewer.'
    };
  }
  if (/^=/.test(value)) {
    return {
      value: '',
      error: 'Pick cannot start with "=".'
    };
  }

  if (bet.options && bet.options.length) {
    var valueKey = normalizeBettingOptionKey_(value);
    for (var i = 0; i < bet.options.length; i++) {
      if (normalizeBettingOptionKey_(bet.options[i]) === valueKey) {
        return {
          value: bet.options[i],
          error: ''
        };
      }
    }
    return {
      value: '',
      error: 'Choose one of the configured options.'
    };
  }

  return {
    value: value,
    error: ''
  };
}

/**
 * Public league-member bet submission route. Writes only B2:G11 on the
 * App Data Collection sheet and validates against B13:G13/H1:K option banks.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {Object} params
 * @return {Object}
 */
function submitBettingPicks_(spreadsheet, params) {
  var fail = function (message, extra) {
    var payload = {
      ok: false,
      error: message,
      updatedAt: new Date().toISOString()
    };
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        payload[key] = extra[key];
      });
    }
    return payload;
  };

  if (!spreadsheet) return fail('No spreadsheet is available.');

  var sheet = spreadsheet.getSheetByName(BETTING_SHEET);
  if (!sheet) return fail('Sheet "' + BETTING_SHEET + '" was not found.');

  var results = sheet
    .getRange(BETTING_RESULTS_ROW, BETTING_FIRST_BET_COL, 1, BETTING_BET_COUNT)
    .getDisplayValues()[0];
  if (results.some(function (value) { return !isBlankDisplayValue_(value); })) {
    return fail('This betting week is finalized. Results have already been posted.', {
      finalized: true
    });
  }

  var memberRow = Number(params.memberRow || params.row || 0);
  if (
    !memberRow ||
    Math.floor(memberRow) !== memberRow ||
    memberRow < BETTING_MEMBER_START_ROW ||
    memberRow >= BETTING_MEMBER_START_ROW + BETTING_MEMBER_COUNT
  ) {
    return fail('Invalid member row.');
  }

  var sheetMemberName = String(sheet.getRange(memberRow, 1).getDisplayValue() || '').trim();
  if (!sheetMemberName) return fail('No member exists on that row.');

  var providedMemberName = String(params.memberName || params.member || '').trim();
  if (providedMemberName && normalizeTeamNameKey_(providedMemberName) !== normalizeTeamNameKey_(sheetMemberName)) {
    return fail('Member row and member name do not match.');
  }

  var submittedValues = parseBettingPickValues_(params);
  if (!submittedValues || submittedValues.length !== BETTING_BET_COUNT) {
    return fail('Expected exactly ' + BETTING_BET_COUNT + ' picks.');
  }

  var membersRaw = sheet
    .getRange(BETTING_MEMBER_START_ROW, 1, BETTING_MEMBER_COUNT, 1)
    .getDisplayValues();
  var config = buildWeeklyBetConfigs_(sheet, extractBettingMemberNames_(membersRaw));
  var sanitized = [];
  for (var i = 0; i < BETTING_BET_COUNT; i++) {
    var result = sanitizeBettingPickValue_(submittedValues[i], config.bets[i]);
    if (result.error) {
      return fail('Bet ' + (i + 1) + ': ' + result.error);
    }
    sanitized.push(result.value);
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    lock.waitLock(5000);
    hasLock = true;
    sheet.getRange(memberRow, BETTING_FIRST_BET_COL, 1, BETTING_BET_COUNT).setValues([sanitized]);
    return {
      ok: true,
      member: {
        row: memberRow,
        name: sheetMemberName
      },
      picks: sanitized,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return fail(err.message || String(err));
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Serves the league dashboard HTML as a Web App.
 * @param {Object} e Request parameters (unused; present for Web App signature).
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var path = e && e.pathInfo ? String(e.pathInfo).replace(/^\/+/, '') : '';
  var params = e && e.parameter ? e.parameter : {};
  var callbackName = params.callback ? String(params.callback) : '';
  var debug = String(params.debug || '') === '1';
  var apiName = params.api ? String(params.api) : '';

  if (path === 'manifest.json') {
    return ContentService
      .createTextOutput(JSON.stringify(buildWebAppManifest_(spreadsheet)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (path === 'config' || path === 'api/config' || apiName === 'config') {
    return createApiOutput_(buildClientConfig_(spreadsheet), callbackName);
  }

  if (path === 'league-data' || path === 'api/league-data' || apiName === 'league-data') {
    return createApiOutput_(getLeagueData(debug), callbackName);
  }

  if (path === 'betting-data' || path === 'api/betting-data' || apiName === 'betting-data') {
    return createApiOutput_(getBettingData_(spreadsheet), callbackName);
  }

  if (path === 'update-team-field' || path === 'api/update-team-field' || apiName === 'update-team-field') {
    return createApiOutput_(updateTeamField_(spreadsheet, params), callbackName);
  }

  if (path === 'submit-bets' || path === 'api/submit-bets' || apiName === 'submit-bets') {
    return createApiOutput_(submitBettingPicks_(spreadsheet, params), callbackName);
  }

  var raw = HEADER_IMAGE_URL || '';
  var webAppUrl = ScriptApp.getService().getUrl() || '';
  var t = HtmlService.createTemplateFromFile('index');
  t.headerImageUrl = raw;
  t.headerImageSrc = resolveHeaderImageSrc_(raw);
  t.appIconHref = formatDriveUrl(getAppIconUrl_(spreadsheet));
  t.manifestHref = webAppUrl ? webAppUrl.replace(/\/$/, '') + '/manifest.json' : 'manifest.json';
  t.appName = APP_NAME;
  t.appShortName = APP_SHORT_NAME;
  t.appThemeColor = APP_THEME_COLOR;
  t.leagueSeason = getLeagueSeason_(spreadsheet);
  t.leagueWeek = getLeagueWeek_(spreadsheet);
  t.clientDiagnosticsEnabled = debug;
  return t
    .evaluate()
    .setTitle('League Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

/**
 * Returns team standings from the "Rosters & Records" sheet for the client UI.
 * Column positions are resolved from the header row so minor layout changes stay safe.
 * @param {boolean} [includeDiagnostics] When true, payload includes `diagnostics` for photo/sheet troubleshooting (use ?debug=1 on the web app URL).
 * @return {{ teams: Array<{teamName: string, realName: string, record: string, streak: string, pointsFor: number, photoUrl: string, sleeperTeamImageUrl: string, teamMvpName: string, teamMvpImageUrl: string, turkeyWatch: string, trophies: string, beerTrophies: string, mulligan: boolean}>, updatedAt: string, error?: string, diagnostics?: Object }}
 */
function getLeagueData(includeDiagnostics) {
  const wantDiag = includeDiagnostics === true;
  const emptyPayload = function (err) {
    var payload = {
      teams: [],
      updatedAt: new Date().toISOString(),
      error: err || undefined
    };
    if (wantDiag) {
      payload.diagnostics = {
        rosterTeamCount: 0,
        teamsWithPhotoUrl: 0,
        note: err || 'error'
      };
    }
    return payload;
  };

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      return emptyPayload(
        'No spreadsheet in this session. Deploy the Web App from the spreadsheet-bound script project.'
      );
    }

    const rosterSheet = spreadsheet.getSheetByName(ROSTERS_RECORDS_SHEET);
    if (!rosterSheet) {
      return emptyPayload('Sheet "' + ROSTERS_RECORDS_SHEET + '" was not found.');
    }

    const lastRow = rosterSheet.getLastRow();
    const lastCol = rosterSheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      const emptyRoster = {
        teams: [],
        updatedAt: new Date().toISOString()
      };
      if (wantDiag) {
        const photoBuild = buildTeamsSheetDataMap_(spreadsheet);
        emptyRoster.diagnostics = {
          photoSheet: photoBuild.diagnostics,
          rosterTeamCount: 0,
          teamsWithPhotoUrl: 0,
          note: 'Rosters & Records has no data rows.'
        };
      }
      return emptyRoster;
    }

    const headers = rosterSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const teamNameCol = headers.indexOf('Team Name');
    const realNameCol = findRostersDisplayNameColumn_(headers);
    const recordCol = headers.indexOf('W-L Record');
    const streakCol =
      headers.indexOf('Streak') !== -1 ? headers.indexOf('Streak') : ROSTERS_STREAK_COL_FALLBACK;
    const pointsForCol = headers.indexOf('Fpts (Total)');

    if (teamNameCol === -1 || recordCol === -1 || pointsForCol === -1) {
      return emptyPayload(
        'Missing expected headers (Team Name, W-L Record, Fpts (Total)) in row 1.'
      );
    }

    const rows = rosterSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const photoBuild = buildTeamsSheetDataMap_(spreadsheet);
    const teamsSheetDataByTeamKey = photoBuild.map;
    const teams = [];
    const rosterKeysForDiag = [];
    let teamsWithPhotoUrl = 0;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rawTeamName = row[teamNameCol];
      if (rawTeamName === '' || rawTeamName === null || rawTeamName === undefined) continue;

      const teamName = String(rawTeamName).trim();
      const teamKey = normalizeTeamNameKey_(teamName);
      const rawRealName = realNameCol >= 0 && realNameCol < row.length ? row[realNameCol] : '';
      const rawRecord = row[recordCol];
      const rawStreak = streakCol >= 0 && streakCol < row.length ? row[streakCol] : '';
      const rawPointsFor = row[pointsForCol];
      const teamSheetData = teamKey ? teamsSheetDataByTeamKey[teamKey] : null;

      const record =
        rawRecord === '' || rawRecord === null || rawRecord === undefined
          ? '0-0'
          : String(rawRecord).trim();
      const streakSuffix = formatStreakSuffixForRecord_(rawStreak);
      const streak = streakSuffix ? streakSuffix.replace(/[()]/g, '').trim() : '';
      const realName =
        rawRealName === '' || rawRealName === null || rawRealName === undefined
          ? ''
          : String(rawRealName).trim();

      let pointsFor = rawPointsFor;
      if (pointsFor === '' || pointsFor === null || pointsFor === undefined) {
        pointsFor = 0;
      } else if (typeof pointsFor !== 'number') {
        const num = Number(pointsFor);
        pointsFor = isNaN(num) ? 0 : num;
      }

      const photoUrl = teamSheetData && teamSheetData.managerPhotoUrl ? teamSheetData.managerPhotoUrl : '';
      const sleeperTeamImageUrl =
        teamSheetData && teamSheetData.sleeperTeamImageUrl ? teamSheetData.sleeperTeamImageUrl : '';
      const teamMvpName = teamSheetData && teamSheetData.teamMvpName ? teamSheetData.teamMvpName : '';
      const teamMvpImageUrl =
        teamSheetData && teamSheetData.teamMvpImageUrl ? teamSheetData.teamMvpImageUrl : '';
      const turkeyWatch = teamSheetData && teamSheetData.turkeyWatch ? teamSheetData.turkeyWatch : '';
      const trophies = teamSheetData && teamSheetData.trophies ? teamSheetData.trophies : '';
      const beerTrophies = teamSheetData && teamSheetData.beerTrophies ? teamSheetData.beerTrophies : '';
      const mulligan = teamSheetData ? teamSheetData.mulligan === true : false;

      if (wantDiag && rosterKeysForDiag.length < 12) {
        rosterKeysForDiag.push(teamKey || '(blank key)');
      }
      if (photoUrl) teamsWithPhotoUrl++;

      teams.push({
        teamName: teamName,
        realName: realName,
        record: record,
        streak: streak,
        pointsFor: Math.round(pointsFor * 100) / 100,
        photoUrl: photoUrl,
        sleeperTeamImageUrl: sleeperTeamImageUrl,
        teamMvpName: teamMvpName,
        teamMvpImageUrl: teamMvpImageUrl,
        turkeyWatch: turkeyWatch,
        trophies: trophies,
        beerTrophies: beerTrophies,
        mulligan: mulligan
      });
    }

    teams.sort(function (a, b) {
      const aWins = parseInt(String(a.record).split('-')[0], 10) || 0;
      const bWins = parseInt(String(b.record).split('-')[0], 10) || 0;
      if (bWins !== aWins) return bWins - aWins;
      return b.pointsFor - a.pointsFor;
    });

    const payload = {
      teams: teams,
      updatedAt: new Date().toISOString()
    };

    if (wantDiag) {
      const missingPhotos = [];
      for (let i = 0; i < teams.length; i++) {
        if (!teams[i].photoUrl) missingPhotos.push(teams[i].teamName);
      }
      payload.diagnostics = {
        photoSheet: photoBuild.diagnostics,
        rosterTeamCount: teams.length,
        teamsWithPhotoUrl: teamsWithPhotoUrl,
        rosterNormalizedKeysSample: rosterKeysForDiag,
        rosterNamesMissingPhoto: missingPhotos.slice(0, 16)
      };
    }

    return payload;
  } catch (err) {
    return emptyPayload(err.message || String(err));
  }
}

function getSleeperStandings() {
  const leagueId = getLeagueId_(SpreadsheetApp.getActiveSpreadsheet());

  // Sleeper API endpoint for league standings
  const url = `https://api.sleeper.app/v1/league/${leagueId}/rosters`;

  // Authorization token (replace with your actual token)
  const authorization = 'Token YOUR_API_TOKEN';

  const options = {
    'method' : 'get',
    'headers' : {
      'Authorization': authorization
    }
  };

  const response = UrlFetchApp.fetch(url, options);
  const standingsData = JSON.parse(response.getContentText());

  // Sheet object and starting row for populating data
  // const sheet = SpreadsheetApp.getActiveSheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teams');
  let startingRow = 1;  // Adjust starting row as needed

  // Loop through each team in standings
  for (const team of standingsData) {
    const record = `${team.settings.wins}-${team.settings.losses}`;  // Customize record format
    const teamName = team.roster_id;  // GET return only shows a roster ID and no team name
    const teamStreak = team.metadata.streak;  // 
    const cell = sheet.getRange(startingRow, 1);  // Column 1 (adjust if needed)
	
    // Write team name and record to separate columns (adjust columns as needed)
    const nameCell = sheet.getRange(startingRow, 2);
    nameCell.setValue(teamName);
    const recordCell = sheet.getRange(startingRow, 3);  // Change column number for record
    recordCell.setValue(record);
	  const streakCell = sheet.getRange(startingRow, 4);  // Change column number for record
    streakCell.setValue(teamStreak);

    startingRow++;
  }
}

function matchUserIdsToTeamNames() {
  const leagueId = getLeagueId_(SpreadsheetApp.getActiveSpreadsheet());

  const sheet = SpreadsheetApp.getActiveSheet();
  const userIdsRange = sheet.getRange('F1:F10');
  const userIds = userIdsRange.getValues().flat();

  const url = `https://api.sleeper.app/v1/league/${leagueId}/users`;
  const options = {
    'method': 'get'
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const userData = JSON.parse(response.getContentText());

    Logger.log('First 3 users:', JSON.stringify(userData.slice(0, 3))); // Stringify for better readability

    const userIdToTeamName = {};
    for (const user of userData) {
      userIdToTeamName[user.user_id] = user.metadata?.team_name || '';
    }

    Logger.log('First 5 entries in userIdToTeamName:', JSON.stringify(Object.entries(userIdToTeamName).slice(0, 5)));

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const teamName = userIdToTeamName[userId];
      const teamNameCell = sheet.getRange(i + 1, 7);
      teamNameCell.setValue(teamName);
    }
  } catch (error) {
    Logger.log('Error:', error);
  }
}

function fetchMatchupData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('API Data');
  var leagueId = getLeagueId_(SpreadsheetApp.getActiveSpreadsheet());
  var week_no = sheet.getRange('A19').getValue(); // Get week_no from cell A19
  // var week_no = (sheet.getRange('A19').getValue()) - 1; // Use this when var startRow = 265 is active
  var url = `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week_no}`;
  
  var response = UrlFetchApp.fetch(url);
  var data = JSON.parse(response.getContentText());
  
  // var startRow = 265; // switch to this temporarily when transitioning weeks
  var startRow = 278;
  var startCol = 2; // Column B

  data.forEach(function(item, index) {
    var row = startRow + index;
    sheet.getRange(row, startCol).setValue(item.roster_id);
    sheet.getRange(row, startCol + 1).setValue(item.matchup_id);
    sheet.getRange(row, startCol + 2).setValue(item.points);
    
    for (var i = 0; i < 10; i++) {
      sheet.getRange(row, startCol + 3 + i).setValue(item.starters[i] !== undefined ? item.starters[i] : 0);
      sheet.getRange(row, startCol + 13 + i).setValue(item.starters_points[i] !== undefined ? item.starters_points[i] : 0);
    }
  });
}

/**
 * Fetches player data from the Sleeper API and posts some of it
 * into the Google Sheet named "Sleeper Players".
 * * Optimization: The sheet clearing operation now only targets the data rows
 * (Row 2 onwards) using a dynamic range based on current content and headers.
 */
function fetchSleeperPlayers() {
  // --- Configuration ---
  const playerSheet = "Sleeper Players"; // Name of your Google Sheet tab
  const sleeperUrl = "https://api.sleeper.app/v1/players/nfl"; 
  
  // Define the allowed positions
  const ALLOWED_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

  // --- Get the Spreadsheet and Sheet ---
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(playerSheet);

  if (!sheet) {
    Logger.log(`Error: Sheet named "${playerSheet}" not found. Creating it.`);
    sheet = spreadsheet.insertSheet(playerSheet);
  }

  // Define your desired headers based on the fields you want to extract
  const headers = [
    "Player ID",
    "Full Name",
    "First Name",
    "Last Name",
    "Team",
    "Position",
    "Age",
    "Injury Status"
  ];

  // --- Fetch Data from API ---
  try {
    const response = UrlFetchApp.fetch(sleeperUrl);
    const jsonResponse = response.getContentText();
    const data = JSON.parse(jsonResponse);

    Logger.log("Sleeper Players API Response fetched successfully.");

    // --- Prepare data for writing to sheet ---
    let playerData = []; // Start with data only
    let filteredCount = 0;

    // Iterate through each player object in the 'data' (where keys are player IDs)
    for (const playerId in data) {
      // Ensure the property belongs to the object itself, not its prototype chain
      if (data.hasOwnProperty(playerId)) {
        const player = data[playerId];
        const playerPosition = player.position ? player.position.toUpperCase() : ''; 
        const playerTeam = player.team; // Explicitly get the team field

        // --- Filtering Logic ---
        // 1. Must be in ALLOWED_POSITIONS
        // 2. MUST have a value in player.team (must be truthy/not blank)
        if (ALLOWED_POSITIONS.includes(playerPosition) && playerTeam) {
          const row = [
            player.player_id || '',
            player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
            player.first_name || '',
            player.last_name || '',
            playerTeam, // Use the extracted and validated team
            player.position || '',
            player.age || '',
            player.injury_status || ''
          ];
          playerData.push(row);
          filteredCount++;
        }
      }
    }

    // --- Write Data to Sheet ---
    
    // 1. Ensure headers are set (only once, or overwrite if sheet was cleared)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    
    // 2. Clear existing content (Optimized: only clears data rows 2 to max, columns 1 to headers.length)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const numRowsToClear = lastRow - 1;
      // Clear content starting from Row 2, Column 1, across the number of rows that contain data, and across the required number of columns.
      sheet.getRange(2, 1, numRowsToClear, headers.length).clearContent(); 
    }

    // 3. Write all the new data to the sheet at once for maximum efficiency
    if (playerData.length > 0) {
      const numRows = playerData.length;
      const numColumns = headers.length;
      sheet.getRange(2, 1, numRows, numColumns).setValues(playerData);
      Logger.log(`${numRows} player records posted to "${playerSheet}".`);
      Browser.msgBox(`Successfully posted ${numRows} player records to "${playerSheet}".`);
    } else {
      Logger.log("No player data found to post after filtering.");
      Browser.msgBox("No player data found to post from the API response after filtering.");
    }

  } catch (e) {
    Logger.log("Error fetching or parsing API data: " + e.toString());
    Browser.msgBox("An error occurred: " + e.toString());
  }
}

/**
 * Fetches detailed roster data (players, starters, taxi, reserve) for each team
 * and populates a new sheet named "Team Rosters".
 * Prioritizes player roles (Starter > Reserve > Taxi > Active) to avoid duplicates.
 * This script should be run after "fetchLeagueMembersData" to ensure team names are available.
 */
function fetchAndPopulateRosters() {
  // --- Configuration ---
  const LEAGUE_ID = getLeagueId_(SpreadsheetApp.getActiveSpreadsheet());
  const ROSTERS_SHEET_NAME = "Team Rosters";
  const RECORDS_SHEET_NAME = "Rosters & Records"; // To get team names
  const PLAYERS_SHEET_NAME = "Sleeper Players"; // Your existing sheet with NFL player data
  const LEAGUE_ROSTERS_API_URL = `https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`;

  // --- Get Spreadsheets and Sheets ---
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  let rostersSheet = spreadsheet.getSheetByName(ROSTERS_SHEET_NAME);
  if (!rostersSheet) {
    rostersSheet = spreadsheet.insertSheet(ROSTERS_SHEET_NAME);
    Logger.log(`Created new sheet: "${ROSTERS_SHEET_NAME}"`);
  }

  const recordsSheet = spreadsheet.getSheetByName(RECORDS_SHEET_NAME);
  if (!recordsSheet) {
    Logger.log(`Error: Sheet named "${RECORDS_SHEET_NAME}" not found. Cannot retrieve team names.`);
    Browser.msgBox(`Error: Sheet named "${RECORDS_SHEET_NAME}" not found. Please run "fetchLeagueMembersData" first.`);
    return;
  }

  const playersSheet = spreadsheet.getSheetByName(PLAYERS_SHEET_NAME);
  if (!playersSheet) {
    Logger.log(`Error: Sheet named "${PLAYERS_SHEET_NAME}" not found. Cannot retrieve player names.`);
    Browser.msgBox(`Error: Sheet named "${PLAYERS_SHEET_NAME}" not found. Please ensure that sheet exists and is populated.`);
    return;
  }

  // --- 1. Build Player ID to Name Map from "Sleeper Players" sheet ---
  let playerIdToNameMap = {};
  try {
    const playersData = playersSheet.getDataRange().getValues(); // Get all data from the players sheet
    
    if (playersData.length > 1) { // Assuming first row is headers
      // Find the Player ID and Full Name columns dynamically
      const headers = playersData[0];
      const playerIdColIndex = headers.indexOf("Player ID"); // Assuming a "Player ID" header
      const fullNameColIndex = headers.indexOf("Full Name"); // Assuming a "Full Name" header

      if (playerIdColIndex === -1 || fullNameColIndex === -1) {
        Logger.log(`Error: "${PLAYERS_SHEET_NAME}" sheet missing "Player ID" or "Full Name" headers.`);
        Browser.msgBox(`Error: "${PLAYERS_SHEET_NAME}" sheet missing "Player ID" or "Full Name" headers. Please check your player data sheet.`);
        return;
      }

      for (let i = 1; i < playersData.length; i++) { // Start from 1 to skip headers
        const playerId = playersData[i][playerIdColIndex];
        const playerName = playersData[i][fullNameColIndex];
        if (playerId && playerName) {
          playerIdToNameMap[playerId] = playerName;
        }
      }
      Logger.log(`Built map for ${Object.keys(playerIdToNameMap).length} players from "${PLAYERS_SHEET_NAME}".`);
    } else {
      Logger.log(`"${PLAYERS_SHEET_NAME}" sheet is empty or has no player data.`);
      Browser.msgBox(`"${PLAYERS_SHEET_NAME}" sheet is empty or has no player data. Please ensure it's populated.`);
      // Continue execution, but player names will be empty
    }
  } catch (e) {
    Logger.log("Error reading player data from 'Sleeper Players' sheet: " + e.toString());
    Browser.msgBox("An error occurred while reading player data from 'Sleeper Players' sheet. Roster names might be missing.");
    // Continue execution, but player names will be empty
  }

  // --- 2. Build User ID to Team Name Map from "Rosters & Records" sheet ---
  // Assuming "User ID" is in Column B (index 1) and "Team Name" is in Column D (index 3)
  const recordsSheetData = recordsSheet.getDataRange().getValues();
  const userIdToTeamNameMap = {};
  const USER_ID_COL_IN_RECORDS = 1; // Column B (0-indexed is 1)
  const TEAM_NAME_COL_IN_RECORDS = 3; // Column D (0-indexed is 3)

  if (recordsSheetData.length > 1) { // Skip headers
    for (let i = 1; i < recordsSheetData.length; i++) {
      const userId = recordsSheetData[i][USER_ID_COL_IN_RECORDS];
      const teamName = recordsSheetData[i][TEAM_NAME_COL_IN_RECORDS];
      if (userId && teamName) {
        userIdToTeamNameMap[userId] = teamName;
      }
    }
    Logger.log(`Built map for ${Object.keys(userIdToTeamNameMap).length} teams from "${RECORDS_SHEET_NAME}".`);
  } else {
    Logger.log(`"${RECORDS_SHEET_NAME}" is empty or has no team data. Team names will be missing.`);
  }

  // --- 3. Fetch League Rosters Data ---
  let allRosterData = [];
  try {
    const rostersResponse = UrlFetchApp.fetch(LEAGUE_ROSTERS_API_URL);
    const rostersJson = rostersResponse.getContentText();
    const rosters = JSON.parse(rostersJson);

    Logger.log("League Rosters API Response fetched successfully.");
    // Logger.log(JSON.stringify(rosters, null, 2)); // Uncomment to log full response for debugging

    // Define headers for the "Team Rosters" sheet
    const rosterHeaders = ["User ID", "Team Name", "Player ID", "Roster Type", "Player Name"];
    allRosterData.push(rosterHeaders);

    rosters.forEach(roster => {
      const ownerId = roster.owner_id || '';
      const teamName = userIdToTeamNameMap[ownerId] || 'Unknown Team'; // Get team name from map

      // Use a Set to track players already added for THIS specific team's roster
      // This prevents duplicates if a player is in multiple categories (e.g., Starter and Active)
      const addedPlayerIdsForTeam = new Set();

      // Helper function to add players from a list, avoiding duplicates
      const addPlayersToRosterSheet = (playerIds, rosterType) => {
        if (playerIds && Array.isArray(playerIds)) {
          playerIds.forEach(playerId => {
            // Only add if not already added for this team
            if (!addedPlayerIdsForTeam.has(playerId)) {
              const playerName = playerIdToNameMap[playerId] || `ID: ${playerId}`; // Fallback if name not found
              allRosterData.push([ownerId, teamName, playerId, rosterType, playerName]);
              addedPlayerIdsForTeam.add(playerId); // Mark as added
            }
          });
        }
      };

      // Process in order of priority: Starters > Reserve > Taxi > Active
      // This ensures a player is listed under their highest priority role.
      addPlayersToRosterSheet(roster.starters, "Starter");
      addPlayersToRosterSheet(roster.reserve, "Reserve");
      addPlayersToRosterSheet(roster.taxi, "Taxi");
      addPlayersToRosterSheet(roster.players, "Active"); // 'players' usually refers to the full active roster
											
												  
    });

    // --- 4. Write Data to "Team Rosters" Sheet ---
    // rostersSheet.clearContents(); // Clear existing content
    const lastRow = rostersSheet.getLastRow();
    rostersSheet.getRange(1, 1, lastRow, 5).clearContent();
    if (allRosterData.length > 1) { // Check if there's more than just headers
      const numRows = allRosterData.length;
      const numColumns = allRosterData[0].length;
      rostersSheet.getRange(1, 1, numRows, numColumns).setValues(allRosterData);
      Logger.log(`${numRows - 1} player roster entries posted to "${ROSTERS_SHEET_NAME}".`);
      Browser.msgBox(`Successfully posted ${numRows - 1} player roster entries to "${ROSTERS_SHEET_NAME}".`);
    } else {
      Logger.log("No roster data found to post.");
      Browser.msgBox("No roster data found to post to the 'Team Rosters' sheet.");
    }

  } catch (e) {
    Logger.log("Error fetching or parsing League Rosters API data: " + e.toString());
    Browser.msgBox("An error occurred during League Rosters fetch: " + e.toString());
  }
}

// --- Existing Functions (Ensure these are also in your .gs file) ---

/**
 * Fetches basic league member data (user_id, avatar, team_name) from Sleeper API
 * and populates the "Rosters & Records" sheet, starting from Column B (column 2).
 * Column A is reserved for manual input.
 * This script is intended to be run once or infrequently as this data is static.
 */
function fetchLeagueMembersData() {
  // --- Configuration ---
  const LEAGUE_ID = getLeagueId_(SpreadsheetApp.getActiveSpreadsheet());
  const SHEET_NAME = "Rosters & Records"; // Name of your Google Sheet tab
  const USERS_API_URL = `https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`;

  // --- Get the Spreadsheet and Sheet ---
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  // Clear existing content to ensure a fresh start and consistent structure
  sheet.clear();

  // Define headers for all expected columns
    const headers = [
    "Row ID",
    "User ID",
    "User Avatar URL", // Renamed for clarity
    "Team Name",
    "Team Avatar URL", // New column for team-specific avatar
    "W-L Record",
    "Streak",
    "Roster ID",
    "Fpts (Total)",
    "Display Name"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  // --- Fetch Data from API ---
  try {
    const response = UrlFetchApp.fetch(USERS_API_URL);
    const jsonResponse = response.getContentText();
    const users = JSON.parse(jsonResponse);

    Logger.log("Users API Response fetched successfully.");

    // --- Prepare data for writing to sheet ---
    const dataToWrite = [];
    users.forEach((user, index) => {
      // User's personal avatar (from user object)
      const userAvatarUrl = user.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : '';
      const teamName = user.metadata?.team_name || user.display_name || `Team ${index + 1}`;
      
      // --- UPDATED: Extract Team Avatar URL from user.metadata ---
      const teamAvatarUrl = user.metadata?.avatar || ''; // Directly use if it's already a URL, or leave blank

      // Push initial data. W-L, Streak, Roster ID, Fpts are initially blank.
      dataToWrite.push([
        index + 1,        // Row ID
        user.user_id,     // User ID (Col B)
        userAvatarUrl,    // User Avatar URL (Col C)
        teamName,         // Team Name (Col D)
        teamAvatarUrl,    // Team Avatar URL (Col E - now populated here)
        '',               // Placeholder for W-L Record (Col F)
        '',               // Placeholder for Streak (Col G)
        '',               // Placeholder for Roster ID (Col H)
        '',               // Placeholder for Fpts (Total) (Col I)
        sleeperManagerDisplayLabel_(user) // Display Name (Col J)
      ]);
    });

    if (dataToWrite.length > 0) {
      sheet.getRange(2, 1, dataToWrite.length, headers.length).setValues(dataToWrite);
      Logger.log(`Successfully fetched ${dataToWrite.length} league members.`);
      Browser.msgBox(`Successfully fetched ${dataToWrite.length} league members into the "${SHEET_NAME}" sheet. Please run "Update Rosters & Records" next.`);
    } else {
      Logger.log("No users found in the league.");
      Browser.msgBox("No users found in the league. Please check your LEAGUE_ID.");
    }
  } catch (e) {
    Logger.log("Error fetching or parsing Users API data: " + e.toString());
    Browser.msgBox("An error occurred during Users fetch: " + e.toString());
  }
}

/**
 * Fetches roster and record data from Sleeper API and updates the
 * "Rosters & Records" sheet by matching user_id.
 * This script can be run daily or weekly to keep records up-to-date.
 */
function updateRostersAndRecordsData() {
  // --- Configuration ---
  const LEAGUE_ID = getLeagueId_(SpreadsheetApp.getActiveSpreadsheet());
  const SHEET_NAME = "Rosters & Records";
  const ROSTERS_API_URL = `https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`;

  // Define column indices for easy access (0-indexed)
  // These indices are consistent with the headers defined in fetchLeagueMembersData
  const USER_ID_COL = 1;         // Column B
  const USER_AVATAR_URL_COL = 2; // Column C (User's personal avatar)
  const TEAM_NAME_COL = 3;       // Column D
  const TEAM_AVATAR_URL_COL = 4; // Column E (Team's custom avatar - populated by fetchLeagueMembersData)
  const WL_RECORD_COL = 5;       // Column F
  const STREAK_COL = 6;          // Column G
  const ROSTER_ID_COL = 7;       // Column H
  const FPTS_COL = 8;            // Column I
  const DISPLAY_NAME_COL = 9;  // Column J (not overwritten by roster API pass)

  // --- Get the Spreadsheet and Sheet ---
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    Logger.log(`Error: Sheet named "${SHEET_NAME}" not found.`);
    Browser.msgBox(`Error: Sheet named "${SHEET_NAME}" not found. Please ensure the sheet exists.`);
    return;
  }

  const lastRow = sheet.getLastRow();
  // Check if we have at least headers and some user data starting from row 2 (Col B)
  if (lastRow < 2 || sheet.getRange(2, USER_ID_COL + 1).isBlank()) {
    Logger.log("Sheet 'Rosters & Records' is empty or initial member data is missing. Please run 'fetchLeagueMembersData' first.");
    Browser.msgBox("Sheet 'Rosters & Records' is empty or initial member data is missing. Please run 'fetchLeagueMembersData' first to populate initial member data.");
    return;
  }

  // Read existing data from the sheet. We need all columns to preserve data.
  const existingData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const userIdToRowMap = {};
  for (let i = 1; i < existingData.length; i++) {
    const userId = existingData[i][USER_ID_COL];
    if (userId) {
      userIdToRowMap[userId] = i;
    }
  }

  try {
    const response = UrlFetchApp.fetch(ROSTERS_API_URL);
    const jsonResponse = response.getContentText();
    const rosters = JSON.parse(jsonResponse);
    Logger.log("Rosters API Response fetched successfully.");

    let updatedSheetData = existingData.map(row => [...row]);

    // Define all headers that should be present and their target column indices
    const allExpectedHeaders = [
      { name: "Row ID", colIndex: 0 },
      { name: "User ID", colIndex: USER_ID_COL },
      { name: "User Avatar URL", colIndex: USER_AVATAR_URL_COL },
      { name: "Team Name", colIndex: TEAM_NAME_COL },
      { name: "Team Avatar URL", colIndex: TEAM_AVATAR_URL_COL }, 
      { name: "W-L Record", colIndex: WL_RECORD_COL },
      { name: "Streak", colIndex: STREAK_COL },
      { name: "Roster ID", colIndex: ROSTER_ID_COL },
      { name: "Fpts (Total)", colIndex: FPTS_COL },
      { name: "Display Name", colIndex: DISPLAY_NAME_COL }
    ];

    // Ensure all necessary columns exist and add new ones if needed
    let currentLastColumn = updatedSheetData[0].length;
    let maxRequiredColumnIndex = allExpectedHeaders.reduce((max, h) => Math.max(max, h.colIndex), -1);
    
    // If we need more columns than currently exist, extend all rows
    if (maxRequiredColumnIndex + 1 > currentLastColumn) {
        currentLastColumn = maxRequiredColumnIndex + 1; // Update currentLastColumn
        for (let r = 0; r < updatedSheetData.length; r++) {
            while (updatedSheetData[r].length < currentLastColumn) {
                updatedSheetData[r].push(''); // Add empty cells
            }
        }
    }

    // Set header names for all expected columns (if they're not already there or are wrong)
    allExpectedHeaders.forEach(h => {
        if (updatedSheetData[0][h.colIndex] !== h.name) {
            updatedSheetData[0][h.colIndex] = h.name;
        }
    });

    let recordsUpdatedCount = 0;
    rosters.forEach(roster => {
      const ownerId = roster.owner_id;
      const rowIndex = userIdToRowMap[ownerId];

      if (rowIndex !== undefined) {
        const fptsTotal = (roster.settings.fpts || 0) + ((roster.settings.fpts_decimal || 0) / 100);

        let wins = 0;
        let losses = 0;

        // Safely access metadata.record
        if (roster.metadata && typeof roster.metadata.record === 'string') {
          const recordString = roster.metadata.record.toUpperCase();
          for (let i = 0; i < recordString.length; i++) {
            const char = recordString.charAt(i);
            if (char === 'W') {
              wins++;
            } else if (char === 'L') {
              losses++;
            }
          }
        }
        const wlRecord = `${wins}-${losses}`;

        // --- REMOVED: Team Avatar URL is no longer populated here ---
        // const teamAvatarUrl = roster.metadata?.avatar || ''; 
        // if (!teamAvatarUrl && roster.metadata) {
        //   Logger.log(`Team Avatar URL is blank for Roster ID ${roster.roster_id}. Raw metadata: ${JSON.stringify(roster.metadata)}`);
        // }
        // updatedSheetData[rowIndex][TEAM_AVATAR_URL_COL] = teamAvatarUrl; 
        // Team Avatar URL is now populated by fetchLeagueMembersData

        updatedSheetData[rowIndex][WL_RECORD_COL] = wlRecord;
        updatedSheetData[rowIndex][STREAK_COL] = roster.metadata?.streak || 'n/a'; 
        updatedSheetData[rowIndex][ROSTER_ID_COL] = roster.roster_id || '';
        updatedSheetData[rowIndex][FPTS_COL] = fptsTotal;

        recordsUpdatedCount++;
      } else {
        Logger.log(`User ID ${ownerId} found in Rosters API but not in the spreadsheet. Skipping.`);
      }
    });

    if (recordsUpdatedCount > 0 || maxRequiredColumnIndex + 1 > existingData[0].length) {
      sheet.getRange(1, 1, updatedSheetData.length, updatedSheetData[0].length).setValues(updatedSheetData);
      Logger.log(`${recordsUpdatedCount} team records updated in "${SHEET_NAME}".`);
      Browser.msgBox(`Successfully updated ${recordsUpdatedCount} team records in "${SHEET_NAME}".`);
    } else {
      Logger.log("No team records updated. Ensure user IDs match and data exists.");
      Browser.msgBox("No team records updated. Ensure initial data is populated and User IDs match.");
    }

  } catch (e) {
    Logger.log("Error fetching or parsing Rosters API data: " + e.toString());
    Browser.msgBox("An error occurred during Rosters fetch: " + e.toString());
  }
}

/**
 * Fetches draft picks from the Sleeper API for multiple seasons and
 * populates a new "Draft Picks" sheet.
 */
function fetchDraftPicksData() {
  // --- Configuration ---
  // <<< IMPORTANT: REPLACE THESE WITH YOUR ACTUAL DRAFT IDS AND SEASONS >>>
  const DRAFT_IDS_BY_SEASON = {
    "2025": "1256670617734754304",
	  "2024": "1121938386224357377",
    "2023": "992182986533294081",
  };
  const SHEET_NAME = "Draft Results"; // Updated sheet name
  const BASE_API_URL = "https://api.sleeper.app/v1/draft";

  // --- Get the Spreadsheet and Sheet ---
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  const isNewSheet = !sheet;
  if (isNewSheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

										   
				
  const headers = ["Season", "Round", "Pick #", "Picked By (Roster ID)", "Player ID"];
  // Set headers only if the sheet is newly created
  if (isNewSheet) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }

  let allDraftPicks = [];
  const seasons = Object.keys(DRAFT_IDS_BY_SEASON);

  // Loop through each season and its associated draft ID
  for (const season of seasons) {
    const draftId = DRAFT_IDS_BY_SEASON[season];
    const API_URL = `${BASE_API_URL}/${draftId}/picks`;

    try {
      const response = UrlFetchApp.fetch(API_URL);
      const jsonResponse = response.getContentText();
      const picks = JSON.parse(jsonResponse);
      
      Logger.log(`Successfully fetched ${picks.length} picks for the ${season} season.`);

      // Process each pick and add to our main array
      picks.forEach(pick => {
													   
																   
															
        const pickRow = [
          season,
          pick.round,
          pick.pick_no,
          pick.picked_by,
          pick.player_id
        ];
        allDraftPicks.push(pickRow);
      });

    } catch (e) {
      Logger.log(`Error fetching or parsing draft picks for season ${season} (Draft ID: ${draftId}): ` + e.toString());
      // Continue to the next draft ID even if one fails
    }
  }

  // Write all collected draft picks to the sheet
  if (allDraftPicks.length > 0) {
    // Determine the range to clear (from row 2, first 5 columns)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
    }
    
    // Write new data to the first 5 columns
    sheet.getRange(2, 1, allDraftPicks.length, headers.length).setValues(allDraftPicks);
    
    Logger.log(`Total of ${allDraftPicks.length} draft picks written to the sheet.`);
    Browser.msgBox(`Successfully fetched a total of ${allDraftPicks.length} draft picks from ${seasons.join(", ")} into the "${SHEET_NAME}" sheet.`);
  } else {
    Logger.log("No draft picks were fetched. Please check the DRAFT_IDS_BY_SEASON configuration.");
    Browser.msgBox("No draft picks were fetched. Please check the DRAFT_IDS_BY_SEASON configuration in the script.");
  }
}

function clearRanges() {
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.getRange('B2:K15').clearContent();
  sheet.getRange('B18:D23').clearContent();
}

function clearAppDataRange() {
  // Open the active spreadsheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get the sheet named "App Data Collection"
  var sheet = ss.getSheetByName("App Data Collection");
  
  // Define the range you want to clear
  // Example: clear A2:D100
  var range = sheet.getRange("B2:G11");
  
  // Clear the contents (values only, not formatting)
  range.clearContent();
}








