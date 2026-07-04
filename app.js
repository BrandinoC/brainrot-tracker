const STORAGE_KEY = 'brainrot-tracker-data';
const DEMO_STAT_MESSAGE = 'Full version only';
const STBHUB_ORIGIN = 'https://stbhub.gg';
const BRAINROT_ICON_BASE = '/assets/images/brainrots';
const CATALOG_SOURCES = ['data/brainrots.json', 'https://stbhub.gg/data/brainrots.json'];
const ICON_META = { iconIndexBase: 1, defaultCols: 9, defaultRows: 9 };

const state = {
  items: [],
  statAdjustments: {
    totalMade: 0,
    totalSpent: 0,
    inStock: 0,
  },
};

const catalog = {
  list: [],
  bySlug: new Map(),
  byName: new Map(),
  mutations: [],
  mutationBySlug: new Map(),
  traits: [],
  traitById: new Map(),
  traitIconStems: {},
  traitIconBase: '/assets/images/traits',
  ready: false,
  loading: null,
  supportLoading: null,
};

let sellingItemId = null;
let deletingItemId = null;
let pickerSelection = null;
let selectedMutationSlug = 'default';
let selectedTraitIds = new Set();
let editingStatKey = null;
let traitsGridRendered = false;

const STAT_CONFIG = {
  totalMade: {
    label: 'Total Sold',
    type: 'money',
    calcKey: 'totalMade',
  },
  totalSpent: {
    label: 'Total Spent',
    type: 'money',
    calcKey: 'totalSpent',
  },
  inStock: {
    label: 'In Stock',
    type: 'count',
    calcKey: 'inStockCount',
  },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function debounce(fn, waitMs) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), waitMs);
  };
}

function runWhenIdle(fn, timeoutMs = 2000) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: timeoutMs });
    return;
  }
  setTimeout(fn, 50);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getPrimarySlug(brainrot) {
  const styles = brainrot.styles || [];
  const primary = styles.find((s) => s.primary) || styles[0];
  return primary?.slug || brainrot.slug || '';
}

function brainrotsTypeAssetFolder(folderSlug) {
  const s = String(folderSlug || '').trim();
  if (s.toLowerCase() === 'crystal') return 'Crystal';
  return s;
}

function inferTypeFolderFromSheetStem(stem) {
  if (!stem || String(stem).includes('/')) return null;
  const exact = {
    FireIce: 'ice-fire',
    FireIce2: 'ice-fire',
    FireIce3: 'ice-fire',
    FireIce4: 'ice-fire',
    Love: 'lovely',
    Love2: 'lovely',
    Love3: 'lovely',
    Love4: 'lovely',
    Specials: 'Specials',
  };
  if (exact[stem]) return exact[stem];
  if (/^FireIce\d*$/i.test(stem)) return 'ice-fire';
  if (/^Love\d*$/i.test(stem)) return 'lovely';
  const match = /^([A-Za-z]+)(\d*)$/.exec(stem);
  if (!match) return null;
  return match[1].toLowerCase();
}

function normalizeTypeSheetStem(typeSlug, stem) {
  const s = String(stem || '').trim();
  if (!s) return s;
  const slug = String(typeSlug || '').trim();
  if (slug === 'ice-fire' && !/^FireIce/i.test(s)) return 'FireIce4';
  if (slug === 'lovely' && !/^Love/i.test(s)) return 'Love4';
  return s;
}

function findBrainrotType(brainrot, typeSlug) {
  if (!brainrot?.types || !typeSlug) return null;
  return brainrot.types.find((t) => t.slug === typeSlug) || null;
}

function typeIconResolveParts(brainrot, typeEntry) {
  const rawSheet = typeEntry.sheet != null && String(typeEntry.sheet).trim() !== ''
    ? String(typeEntry.sheet).trim()
    : '';
  let stem = rawSheet || String(getPrimarySlug(brainrot));
  stem = normalizeTypeSheetStem(typeEntry.slug, stem);
  let folderSlug = typeEntry.slug === 'rainbow' ? 'default' : typeEntry.slug;

  if (rawSheet.includes('/')) {
    const parts = rawSheet.split('/').filter(Boolean);
    if (parts.length >= 2) {
      stem = normalizeTypeSheetStem(typeEntry.slug, parts.pop());
      folderSlug = parts.join('/');
    }
  } else if (typeEntry.sheetFolder != null && String(typeEntry.sheetFolder).trim() !== '') {
    folderSlug = String(typeEntry.sheetFolder).trim();
  } else {
    const inferred = inferTypeFolderFromSheetStem(stem);
    const typeSlug = String(typeEntry.slug || '').trim();
    if (/^Specials$/i.test(String(stem))) {
      folderSlug = 'Specials';
    } else if (
      inferred &&
      (!typeSlug || typeSlug === 'default' || typeSlug === 'rainbow' || inferred === typeSlug)
    ) {
      folderSlug = inferred;
    }
  }

  const legacy =
    `${BRAINROT_ICON_BASE}/types/` +
    `${encodeURIComponent(brainrotsTypeAssetFolder(folderSlug))}/` +
    `${encodeURIComponent(stem)}.png`;

  return { stem, folderSlug, legacy };
}

function resolveBrainrotAtlas(brainrot, typeSlug = 'default') {
  const typeEntry = findBrainrotType(brainrot, typeSlug);
  if (!typeEntry?.sheet) return null;

  const cols = ICON_META.defaultCols;
  const rows = ICON_META.defaultRows;
  const base = ICON_META.iconIndexBase;

  let idx;
  if (typeEntry.sheetIndex != null) {
    idx = base === 1 ? typeEntry.sheetIndex - 1 : typeEntry.sheetIndex;
  } else if (typeof brainrot.itemSheetIndex === 'number') {
    idx = base === 1 ? brainrot.itemSheetIndex - 1 : brainrot.itemSheetIndex;
  } else if (typeof brainrot.iconIndex === 'number') {
    idx = base === 1 ? brainrot.iconIndex - 1 : brainrot.iconIndex;
  } else if (typeof brainrot.iconSlot === 'number') {
    idx = Math.floor(brainrot.iconSlot);
  } else {
    return null;
  }

  idx = Math.max(0, Math.min(cols * rows - 1, Math.floor(idx)));
  const parts = typeIconResolveParts(brainrot, typeEntry);

  return {
    src: STBHUB_ORIGIN + parts.legacy,
    cols,
    rows,
    index: idx,
  };
}

function atlasBackgroundStyle(atlas) {
  const col = atlas.index % atlas.cols;
  const row = Math.floor(atlas.index / atlas.cols);
  const posX = atlas.cols <= 1 ? 0 : (100 * col) / (atlas.cols - 1);
  const posY = atlas.rows <= 1 ? 0 : (100 * row) / (atlas.rows - 1);

  return {
    backgroundImage: `url("${atlas.src}")`,
    backgroundSize: `${atlas.cols * 100}% ${atlas.rows * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundRepeat: 'no-repeat',
  };
}

function applyAtlasToElement(el, atlas) {
  if (!el || !atlas) return;
  const style = atlasBackgroundStyle(atlas);
  el.style.backgroundImage = style.backgroundImage;
  el.style.backgroundSize = style.backgroundSize;
  el.style.backgroundPosition = style.backgroundPosition;
  el.style.backgroundRepeat = style.backgroundRepeat;
}

function createAtlasThumb(atlas, sizeClass = '') {
  if (!atlas) return createThumbPlaceholder();
  const el = document.createElement('div');
  el.className = `atlas-thumb ${sizeClass}`.trim();
  el.setAttribute('role', 'img');
  applyAtlasToElement(el, atlas);
  return el;
}

function buildCatalogEntry(brainrot) {
  const slug = getPrimarySlug(brainrot);
  return {
    name: brainrot.name,
    slug,
    rarity: brainrot.rarity || 'Unknown',
    raw: brainrot,
  };
}

function getEntryAtlas(entry) {
  if (!entry) return null;
  if (entry._atlas === undefined) {
    entry._atlas = resolveBrainrotAtlas(entry.raw, 'default');
  }
  return entry._atlas;
}

function formatSlugLabel(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMultiplier(mult) {
  if (mult == null || Number.isNaN(mult)) return '';
  return Number.isInteger(mult) ? String(mult) : mult.toFixed(1);
}

function applyMutationsCatalog(data) {
  const source = data?.types?.length
    ? data
    : { types: [{ slug: 'default', name: 'Default', multiplier: 1 }] };

  catalog.mutations = source.types.map((t) => ({
    slug: t.slug,
    name: t.name || formatSlugLabel(t.slug),
    multiplier: t.multiplier ?? null,
  }));

  catalog.mutationBySlug.clear();
  for (const mutation of catalog.mutations) {
    catalog.mutationBySlug.set(mutation.slug, mutation);
  }
}

function loadMutationsCatalog() {
  applyMutationsCatalog(window.BRAINROT_TYPES_CATALOG);
}

function normalizeTraitName(name) {
  return String(name || '').replace(/\*+/g, '').trim();
}

function traitIdFromName(name) {
  return normalizeTraitName(name).toLowerCase().replace(/\s+/g, '-');
}

function getTraitIconUrl(trait) {
  const stems = catalog.traitIconStems || {};
  const stem = stems[trait.rawName] || stems[trait.name] || trait.name;
  return `${STBHUB_ORIGIN}${catalog.traitIconBase}/${encodeURIComponent(stem)}.png`;
}

function applyTraitsCatalog(data) {
  if (!data?.rows) {
    catalog.traits = [];
    catalog.traitById.clear();
    return;
  }

  catalog.traitIconBase = data.iconBase || '/assets/images/traits';
  catalog.traitIconStems = data.exportStemByTrait || {};

  catalog.traits = data.rows.map((row) => {
    const trait = {
      id: traitIdFromName(row.name),
      name: normalizeTraitName(row.name),
      rawName: row.name,
      mult: row.mult ?? null,
      rate: row.rate ?? null,
    };
    return { ...trait, iconUrl: getTraitIconUrl(trait) };
  });

  catalog.traitById.clear();
  for (const trait of catalog.traits) {
    catalog.traitById.set(trait.id, trait);
  }
}

function loadTraitsCatalog() {
  applyTraitsCatalog(window.TRAITS_CATALOG);
}

function renderTraitsGrid() {
  const grid = $('#traits-grid');
  if (!grid || traitsGridRendered) return;

  grid.innerHTML = '';

  for (const trait of catalog.traits) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trait-tile';
    btn.dataset.traitId = trait.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.title = trait.mult != null
      ? `${trait.name} (${formatMultiplier(trait.mult)}x income)`
      : trait.name;

    const img = document.createElement('img');
    img.className = 'trait-tile__img';
    img.src = trait.iconUrl;
    img.alt = '';
    img.loading = 'lazy';
    btn.appendChild(img);

    const label = document.createElement('span');
    label.className = 'trait-tile__label';
    label.textContent = trait.name;
    btn.appendChild(label);

    if (trait.mult != null) {
      const mult = document.createElement('span');
      mult.className = 'trait-tile__mult';
      mult.textContent = `${formatMultiplier(trait.mult)}x`;
      btn.appendChild(mult);
    }

    btn.addEventListener('click', () => toggleTrait(trait.id));
    grid.appendChild(btn);
  }

  traitsGridRendered = true;
}

async function ensureTraitsGrid() {
  await loadSupportCatalogs();
  renderTraitsGrid();
}

function updateTraitTileStates() {
  $$('#traits-grid .trait-tile').forEach((tile) => {
    const isActive = selectedTraitIds.has(tile.dataset.traitId);
    tile.classList.toggle('is-active', isActive);
    tile.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function toggleTrait(traitId) {
  if (selectedTraitIds.has(traitId)) {
    selectedTraitIds.delete(traitId);
  } else {
    selectedTraitIds.add(traitId);
  }
  updateTraitTileStates();
}

function clearSelectedTraits() {
  selectedTraitIds.clear();
  updateTraitTileStates();
}

function getSelectedTraitsPayload() {
  return Array.from(selectedTraitIds)
    .map((id) => catalog.traitById.get(id))
    .filter(Boolean)
    .map((trait) => ({
      id: trait.id,
      name: trait.name,
      mult: trait.mult,
      iconUrl: trait.iconUrl,
    }));
}

function formatTraitsSummary(traits) {
  if (!traits?.length) return '';
  return traits.map((t) => (
    t.mult != null ? `${t.name} (${formatMultiplier(t.mult)}x)` : t.name
  )).join(', ');
}

function getAvailableMutations(brainrotRaw) {
  if (!brainrotRaw?.types?.length) {
    return [catalog.mutationBySlug.get('default') || { slug: 'default', name: 'Default', multiplier: 1 }];
  }

  const availableSlugs = new Set(brainrotRaw.types.map((t) => t.slug));
  const result = [];
  const seen = new Set();

  for (const mutation of catalog.mutations) {
    if (availableSlugs.has(mutation.slug)) {
      result.push(mutation);
      seen.add(mutation.slug);
    }
  }

  for (const typeEntry of brainrotRaw.types) {
    if (seen.has(typeEntry.slug)) continue;
    result.push({
      slug: typeEntry.slug,
      name: formatSlugLabel(typeEntry.slug),
      multiplier: null,
    });
  }

  return result.length ? result : [{ slug: 'default', name: 'Default', multiplier: 1 }];
}

function getMutationInfo(slug) {
  return catalog.mutationBySlug.get(slug) || {
    slug,
    name: formatSlugLabel(slug),
    multiplier: null,
  };
}

function resolveItemAtlas(item) {
  const entry = findCatalogEntry(item);
  if (!entry?.raw) return item.atlas || null;
  const mutationSlug = item.mutationSlug || 'default';
  return resolveBrainrotAtlas(entry.raw, mutationSlug);
}

function rarityClass(rarity) {
  return String(rarity || 'common')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function normalizeNameKey(name) {
  return String(name || '').toLowerCase().trim();
}

async function loadSupportCatalogs() {
  if (catalog.supportLoading) return catalog.supportLoading;

  catalog.supportLoading = (async () => {
    if (!catalog.mutations.length) {
      try {
        applyMutationsCatalog(await fetchJson('data/brainrot_types.json'));
      } catch {
        try {
          await loadScript('types-data.js');
          loadMutationsCatalog();
        } catch {
          applyMutationsCatalog(null);
        }
      }
    }

    if (!catalog.traits.length) {
      try {
        applyTraitsCatalog(await fetchJson('data/traits.json'));
      } catch {
        try {
          await loadScript('traits-data.js');
          loadTraitsCatalog();
        } catch {
          applyTraitsCatalog(null);
        }
      }
    }
  })();

  return catalog.supportLoading;
}

async function loadCatalog() {
  if (catalog.ready) return;
  if (catalog.loading) return catalog.loading;

  catalog.loading = (async () => {
    let data = null;

    if (Array.isArray(window.BRAINROTS_CATALOG)) {
      data = window.BRAINROTS_CATALOG;
    }

    if (!data) {
      for (const url of CATALOG_SOURCES) {
        try {
          data = await fetchJson(url);
          break;
        } catch {
          /* try next source */
        }
      }
    }

    if (!data) {
      try {
        await loadScript('catalog-data.js');
        data = window.BRAINROTS_CATALOG;
      } catch {
        /* offline fallback failed */
      }
    }

    if (!Array.isArray(data)) {
      console.warn('Could not load brainrot catalog.');
      return;
    }

    await loadSupportCatalogs();

    catalog.list = data.map(buildCatalogEntry).sort((a, b) => a.name.localeCompare(b.name));

    catalog.bySlug.clear();
    catalog.byName.clear();
    for (const entry of catalog.list) {
      catalog.bySlug.set(entry.slug, entry);
      catalog.byName.set(normalizeNameKey(entry.name), entry);
    }

    catalog.ready = true;

    if (state.items.length) {
      backfillItemImages();
      renderAll();
    }
  })();

  try {
    await catalog.loading;
  } finally {
    catalog.loading = null;
  }
}

function findCatalogEntry(item) {
  if (item.slug && catalog.bySlug.has(item.slug)) {
    return catalog.bySlug.get(item.slug);
  }
  return catalog.byName.get(normalizeNameKey(item.name)) || null;
}

function backfillItemImages() {
  let changed = false;
  for (const item of state.items) {
    const entry = findCatalogEntry(item);
    if (!entry) continue;

    if (item.slug !== entry.slug) {
      item.slug = entry.slug;
      changed = true;
    }
    if (!item.mutationSlug) {
      item.mutationSlug = 'default';
      changed = true;
    }
    const mutation = getMutationInfo(item.mutationSlug);
    if (item.mutationName !== mutation.name) {
      item.mutationName = mutation.name;
      changed = true;
    }
    if (item.mutationMultiplier !== mutation.multiplier) {
      item.mutationMultiplier = mutation.multiplier;
      changed = true;
    }

    const atlas = resolveItemAtlas(item);
    if (atlas) {
      item.atlas = atlas;
      changed = true;
    }

    if (item.rarity !== entry.rarity) {
      item.rarity = entry.rarity;
      changed = true;
    }
    if (item.imageUrl) {
      delete item.imageUrl;
      changed = true;
    }
  }
  if (changed) saveData();
}

function isFullVersion() {
  return Boolean(window.rotvaultDesktop?.isDesktopApp);
}

function isDemoMode() {
  return !isFullVersion();
}

function pulseDemoBanner() {
  const banner = $('#demo-banner');
  if (!banner) return;
  banner.classList.remove('demo-banner--pulse');
  void banner.offsetWidth;
  banner.classList.add('demo-banner--pulse');
}

function showDemoUpgradeNotice() {
  pulseDemoBanner();
}

function initDemoMode() {
  if (!isDemoMode()) return;
  document.documentElement.classList.add('demo-mode');
  $('#demo-banner')?.classList.remove('hidden');
  initDiscordLink();
}

function initDiscordLink() {
  const url = document.querySelector('meta[name="discord-invite"]')?.content?.trim();
  const link = $('#demo-discord-link');
  if (!link || !url || !/^https?:\/\//i.test(url)) return;
  link.href = url;
  link.classList.remove('hidden');
}

function defaultStatAdjustments() {
  return { totalMade: 0, totalSpent: 0, inStock: 0 };
}

function calculatedTotalsFromItems(items) {
  let totalMade = 0;
  let totalSpent = 0;

  for (const item of items) {
    totalSpent += item.purchasePrice;
    if (item.status === 'sold' && item.salePrice != null) {
      totalMade += item.salePrice;
    }
  }

  return {
    totalMade,
    totalSpent,
    netProfit: totalMade - totalSpent,
    inStockCount: items.filter((i) => i.status === 'in-stock').length,
  };
}

function migrateStatAdjustments(parsed) {
  if (parsed.statAdjustments) {
    return {
      totalMade: parsed.statAdjustments.totalMade ?? 0,
      totalSpent: parsed.statAdjustments.totalSpent ?? 0,
      inStock: parsed.statAdjustments.inStock ?? 0,
    };
  }

  if (!parsed.statOverrides) {
    return defaultStatAdjustments();
  }

  const calc = calculatedTotalsFromItems(Array.isArray(parsed.items) ? parsed.items : []);
  const adj = defaultStatAdjustments();

  if (parsed.statOverrides.totalMade != null) {
    adj.totalMade = parsed.statOverrides.totalMade - calc.totalMade;
  }
  if (parsed.statOverrides.totalSpent != null) {
    adj.totalSpent = parsed.statOverrides.totalSpent - calc.totalSpent;
  }
  if (parsed.statOverrides.inStock != null) {
    adj.inStock = parsed.statOverrides.inStock - calc.inStockCount;
  }

  return adj;
}

function loadData() {
  if (isDemoMode()) {
    state.items = [];
    state.statAdjustments = defaultStatAdjustments();
    return;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.items = Array.isArray(parsed.items) ? parsed.items : [];
      state.statAdjustments = migrateStatAdjustments(parsed);
    }
  } catch {
    state.items = [];
    state.statAdjustments = defaultStatAdjustments();
  }
}

function saveData() {
  if (isDemoMode()) return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    items: state.items,
    statAdjustments: state.statAdjustments,
  }));
}

function formatMoney(amount) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function generateId() {
  return crypto.randomUUID();
}

function getCalculatedTotals() {
  return calculatedTotalsFromItems(state.items);
}

function getTotals() {
  const calc = getCalculatedTotals();
  const adj = state.statAdjustments;

  const totalMade = calc.totalMade + (adj.totalMade || 0);
  const totalSpent = calc.totalSpent + (adj.totalSpent || 0);
  const inStockCount = calc.inStockCount + (adj.inStock || 0);

  return {
    totalMade,
    totalSpent,
    netProfit: totalMade - totalSpent,
    inStockCount,
    calculated: calc,
  };
}

function renderStats() {
  if (isDemoMode()) {
    const madeEl = $('#total-made');
    const spentEl = $('#total-spent');
    const profitEl = $('#net-profit');
    const stockEl = $('#stock-count');

    madeEl.textContent = DEMO_STAT_MESSAGE;
    spentEl.textContent = DEMO_STAT_MESSAGE;
    profitEl.textContent = DEMO_STAT_MESSAGE;
    stockEl.textContent = DEMO_STAT_MESSAGE;

    madeEl.classList.add('locked');
    spentEl.classList.add('locked');
    profitEl.classList.remove('positive', 'negative', 'zero');
    profitEl.classList.add('locked');
    stockEl.classList.add('locked');

    const totalMadeHint = document.querySelector('[data-stat="totalMade"] .stat-hint');
    const totalSpentHint = document.querySelector('[data-stat="totalSpent"] .stat-hint');
    const netProfitHint = $('#net-profit-card .stat-hint');
    const inStockHint = document.querySelector('[data-stat="inStock"] .stat-hint');

    if (totalMadeHint) totalMadeHint.textContent = 'Get the full version to track sales';
    if (totalSpentHint) totalSpentHint.textContent = 'Get the full version to track spending';
    if (netProfitHint) netProfitHint.textContent = 'Get the full version to track profit';
    if (inStockHint) inStockHint.textContent = 'Get the full version to track stock';

    return;
  }

  const totals = getTotals();
  const prevProfit = renderStats.lastProfit;

  const madeEl = $('#total-made');
  const spentEl = $('#total-spent');
  madeEl.textContent = formatMoney(totals.totalMade);
  spentEl.textContent = formatMoney(totals.totalSpent);
  madeEl.classList.remove('locked');
  spentEl.classList.remove('locked');

  const profitEl = $('#net-profit');
  profitEl.textContent = formatMoney(totals.netProfit);
  profitEl.classList.remove('positive', 'negative', 'zero', 'locked');
  if (totals.netProfit > 0) {
    profitEl.classList.add('positive');
  } else if (totals.netProfit < 0) {
    profitEl.classList.add('negative');
  } else {
    profitEl.classList.add('zero');
  }

  const stockEl = $('#stock-count');
  stockEl.textContent = String(totals.inStockCount);
  stockEl.classList.remove('locked');

  const profitCard = $('#net-profit-card');
  if (
    profitCard &&
    prevProfit != null &&
    prevProfit !== totals.netProfit
  ) {
    profitCard.classList.remove('stat-updated');
    void profitCard.offsetWidth;
    profitCard.classList.add('stat-updated');
  }

  renderStats.lastProfit = totals.netProfit;
}
renderStats.lastProfit = null;

function openStatEditModal(statKey) {
  if (isDemoMode()) {
    showDemoUpgradeNotice();
    return;
  }

  const config = STAT_CONFIG[statKey];
  if (!config) return;

  editingStatKey = statKey;
  const totals = getTotals();
  const calc = totals.calculated;
  const displayValue = totals[statKey === 'inStock' ? 'inStockCount' : statKey];

  $('#stat-modal-title').textContent = `Edit ${config.label}`;
  $('#stat-modal-desc').textContent = config.type === 'count'
    ? 'Set a starting count. New purchases will still add on top.'
    : 'Set a starting amount. New purchases and sales will still add on top.';

  const calcValue = calc[config.calcKey];
  $('#stat-calculated-value').textContent = config.type === 'count'
    ? String(calcValue)
    : formatMoney(calcValue);

  const input = $('#stat-input');
  input.step = config.type === 'count' ? '1' : '0.01';
  input.min = '0';
  input.value = displayValue;

  $('#stat-input-label-text').textContent = config.type === 'count'
    ? 'Total count'
    : 'Total amount';

  $('#stat-modal').showModal();
  input.focus();
  input.select();
}

function syncStatFromItems(statKey) {
  state.statAdjustments[statKey] = 0;
  saveData();
  renderAll();
  editingStatKey = null;
  $('#stat-modal').close();
}

function resetStat(statKey) {
  if (isDemoMode()) {
    showDemoUpgradeNotice();
    return;
  }

  const config = STAT_CONFIG[statKey];
  if (!config) return;

  if (statKey === 'inStock') {
    const count = state.items.filter((i) => i.status === 'in-stock').length;
    const msg = count > 0
      ? `Reset In Stock to 0? This removes ${count} in-stock item${count === 1 ? '' : 's'}.`
      : 'Reset In Stock to 0?';
    if (!window.confirm(msg)) return;
    state.items = state.items.filter((i) => i.status !== 'in-stock');
    state.statAdjustments.inStock = 0;
  } else if (!window.confirm(`Reset ${config.label} to ${config.type === 'count' ? '0' : '$0.00'}?`)) {
    return;
  } else {
    const calc = getCalculatedTotals();
    state.statAdjustments[statKey] = -(calc[config.calcKey] || 0);
  }

  saveData();
  renderAll();
}

function saveStatEdit(e) {
  e.preventDefault();
  if (isDemoMode()) {
    showDemoUpgradeNotice();
    return;
  }
  if (!editingStatKey) return;

  const config = STAT_CONFIG[editingStatKey];
  const raw = $('#stat-input').value;
  const value = config.type === 'count'
    ? parseInt(raw, 10)
    : parseFloat(raw);

  if (Number.isNaN(value) || value < 0) return;

  const calc = getCalculatedTotals();
  state.statAdjustments[editingStatKey] = value - calc[config.calcKey];

  saveData();
  renderAll();
  editingStatKey = null;
  $('#stat-modal').close();
}

function initStatControls() {
  $$('.stat-card[data-stat]').forEach((card) => {
    const statKey = card.dataset.stat;
    if (!statKey) return;

    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      openStatEditModal(statKey);
    });

    card.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      resetStat(statKey);
    });
  });

  $('#stat-cancel').addEventListener('click', () => {
    editingStatKey = null;
    $('#stat-modal').close();
  });

  $('#stat-sync').addEventListener('click', () => {
    if (editingStatKey) syncStatFromItems(editingStatKey);
  });

  $('#stat-form').addEventListener('submit', saveStatEdit);
}

function createThumb(item) {
  const atlas = resolveItemAtlas(item);
  if (atlas) {
    item.atlas = atlas;
    return createAtlasThumb(atlas);
  }
  return createThumbPlaceholder();
}

function createThumbPlaceholder() {
  const div = document.createElement('div');
  div.className = 'item-thumb-placeholder';
  div.textContent = '🧠';
  div.setAttribute('aria-hidden', 'true');
  return div;
}

function createItemCard(item, context) {
  const card = document.createElement('article');
  card.className = 'item-card';
  card.dataset.id = item.id;

  card.appendChild(createThumb(item));

  const info = document.createElement('div');
  info.className = 'item-info';

  const title = document.createElement('h3');
  title.textContent = item.name;
  info.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'item-meta';

  if (item.rarity) {
    const rarityTag = document.createElement('span');
    rarityTag.className = `rarity-badge ${rarityClass(item.rarity)}`;
    rarityTag.textContent = item.rarity;
    meta.appendChild(rarityTag);
  }

  if (item.mutationName) {
    const mutationTag = document.createElement('span');
    mutationTag.className = 'mutation-tag';
    mutationTag.textContent = item.mutationMultiplier != null
      ? `${item.mutationName} (${formatMultiplier(item.mutationMultiplier)}x)`
      : item.mutationName;
    meta.appendChild(mutationTag);
  }

  if (item.traits?.length) {
    for (const trait of item.traits) {
      const traitTag = document.createElement('span');
      traitTag.className = 'trait-tag';
      traitTag.textContent = trait.mult != null
        ? `${trait.name} (${formatMultiplier(trait.mult)}x)`
        : trait.name;
      meta.appendChild(traitTag);
    }
  }

  const purchaseTag = document.createElement('span');
  purchaseTag.className = 'price-tag purchase';
  purchaseTag.textContent = `Paid ${formatMoney(item.purchasePrice)}`;
  meta.appendChild(purchaseTag);

  if (item.askingPrice != null && item.askingPrice > 0) {
    const askingTag = document.createElement('span');
    askingTag.className = 'price-tag asking';
    askingTag.textContent = `Listed ${formatMoney(item.askingPrice)}`;
    meta.appendChild(askingTag);
  }

  if (item.status === 'sold') {
    const saleTag = document.createElement('span');
    saleTag.className = 'price-tag sale';
    saleTag.textContent = `Sold ${formatMoney(item.salePrice)}`;
    meta.appendChild(saleTag);

    const itemProfit = item.salePrice - item.purchasePrice;
    const profitTag = document.createElement('span');
    profitTag.className = `profit-tag ${itemProfit >= 0 ? 'positive' : 'negative'}`;
    profitTag.textContent = `${itemProfit >= 0 ? '+' : ''}${formatMoney(itemProfit)} profit`;
    meta.appendChild(profitTag);

    const badge = document.createElement('span');
    badge.className = 'status-badge sold';
    badge.textContent = 'Sold';
    meta.appendChild(badge);
  } else {
    const badge = document.createElement('span');
    badge.className = 'status-badge in-stock';
    badge.textContent = 'In Stock';
    meta.appendChild(badge);
  }

  info.appendChild(meta);

  if (item.notes) {
    const notes = document.createElement('p');
    notes.className = 'item-notes';
    notes.textContent = item.notes;
    info.appendChild(notes);
  }

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const dateLabel = document.createElement('span');
  dateLabel.className = 'item-date';
  dateLabel.textContent = item.status === 'sold' && item.soldAt
    ? `Sold ${formatDate(item.soldAt)}`
    : `Added ${formatDate(item.purchasedAt)}`;
  actions.appendChild(dateLabel);

  if (context === 'stock' && item.status === 'in-stock') {
    const sellBtn = document.createElement('button');
    sellBtn.className = 'btn btn-sm btn-sell';
    sellBtn.textContent = 'Mark Sold';
    sellBtn.addEventListener('click', () => openSellModal(item.id));
    actions.appendChild(sellBtn);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => openDeleteModal(item.id));
  actions.appendChild(deleteBtn);

  card.appendChild(info);
  card.appendChild(actions);

  return card;
}

function renderList(containerId, emptyId, filterFn, context) {
  const container = $(containerId);
  const emptyEl = $(emptyId);
  const filtered = state.items.filter(filterFn).sort((a, b) => {
    const dateA = a.status === 'sold' ? a.soldAt : a.purchasedAt;
    const dateB = b.status === 'sold' ? b.soldAt : b.purchasedAt;
    return new Date(dateB) - new Date(dateA);
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    for (const item of filtered) {
      container.appendChild(createItemCard(item, context));
    }
  }
}

function renderAll() {
  renderStats();
  renderList('#stock-list', '#stock-empty', (i) => i.status === 'in-stock', 'stock');
  renderList('#purchased-list', '#purchased-empty', () => true, 'purchased');
  renderList('#sold-list', '#sold-empty', (i) => i.status === 'sold', 'sold');
}

function switchTab(tabName) {
  $$('.tab').forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });

  $$('.tab-panel').forEach((panel) => {
    const isActive = panel.id === `panel-${tabName}`;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
}

function resetPicker() {
  pickerSelection = null;
  selectedMutationSlug = 'default';
  $('#purchase-slug').value = '';
  $('#purchase-name').value = '';
  $('#purchase-search').value = '';
  $('#purchase-mutation').value = 'default';
  const thumbEl = $('#picker-selected-thumb');
  thumbEl.style.backgroundImage = '';
  thumbEl.style.backgroundSize = '';
  thumbEl.style.backgroundPosition = '';
  $('#picker-selected').classList.add('hidden');
  $('#picker-search-wrap').classList.remove('hidden');
  $('#picker-results').classList.add('hidden');
  $('#picker-results').innerHTML = '';
  $('#mutation-label').classList.add('hidden');
  $('#mutation-grid').innerHTML = '';
  clearSelectedTraits();
}

function updatePickerPreview() {
  if (!pickerSelection?.raw) return;
  const atlas = resolveBrainrotAtlas(pickerSelection.raw, selectedMutationSlug);
  if (atlas) {
    applyAtlasToElement($('#picker-selected-thumb'), atlas);
  }
}

function selectMutation(slug) {
  selectedMutationSlug = slug;
  $('#purchase-mutation').value = slug;
  updatePickerPreview();

  $$('#mutation-grid .mutation-tile').forEach((tile) => {
    const isActive = tile.dataset.mutationSlug === slug;
    tile.classList.toggle('is-active', isActive);
    tile.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderMutationGrid(entry) {
  const grid = $('#mutation-grid');
  grid.innerHTML = '';

  const mutations = getAvailableMutations(entry.raw);
  const defaultSlug = mutations.some((m) => m.slug === 'default')
    ? 'default'
    : mutations[0].slug;

  for (const mutation of mutations) {
    const atlas = resolveBrainrotAtlas(entry.raw, mutation.slug);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mutation-tile';
    btn.dataset.mutationSlug = mutation.slug;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-pressed', 'false');
    btn.title = mutation.multiplier != null
      ? `${mutation.name} (${formatMultiplier(mutation.multiplier)}x income)`
      : mutation.name;

    btn.appendChild(createAtlasThumb(atlas));

    const label = document.createElement('span');
    label.className = 'mutation-tile__label';
    label.textContent = mutation.name;
    btn.appendChild(label);

    if (mutation.multiplier != null) {
      const mult = document.createElement('span');
      mult.className = 'mutation-tile__mult';
      mult.textContent = `${formatMultiplier(mutation.multiplier)}x`;
      btn.appendChild(mult);
    }

    btn.addEventListener('click', () => selectMutation(mutation.slug));
    grid.appendChild(btn);
  }

  $('#mutation-label').classList.remove('hidden');
  selectMutation(defaultSlug);
}

function selectBrainrot(entry) {
  pickerSelection = entry;
  $('#purchase-slug').value = entry.slug;
  $('#purchase-name').value = entry.name;

  $('#picker-selected-name').textContent = entry.name;

  const rarityEl = $('#picker-selected-rarity');
  rarityEl.textContent = entry.rarity;
  rarityEl.className = `rarity-badge ${rarityClass(entry.rarity)}`;

  $('#picker-selected').classList.remove('hidden');
  $('#picker-search-wrap').classList.add('hidden');
  $('#picker-results').classList.add('hidden');
  renderMutationGrid(entry);
}

function filterBrainrots(query) {
  const q = query.toLowerCase().trim();
  if (!q) return catalog.list.slice(0, 30);
  return catalog.list
    .filter((b) =>
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      b.rarity.toLowerCase().includes(q))
    .slice(0, 30);
}

function renderPickerResults(results) {
  const container = $('#picker-results');
  container.innerHTML = '';

  if (results.length === 0) {
    container.classList.add('hidden');
    return;
  }

  for (const entry of results) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-result';
    btn.setAttribute('role', 'option');

    btn.appendChild(createAtlasThumb(getEntryAtlas(entry), 'atlas-thumb--sm'));

    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'picker-result-name';
    name.textContent = entry.name;
    const rarity = document.createElement('span');
    rarity.className = 'picker-result-rarity';
    rarity.textContent = entry.rarity;
    text.appendChild(name);
    text.appendChild(rarity);

    btn.appendChild(text);
    btn.addEventListener('click', () => selectBrainrot(entry));
    container.appendChild(btn);
  }

  container.classList.remove('hidden');
}

function renderPickerLoading() {
  const container = $('#picker-results');
  if (!container) return;
  container.innerHTML = '<p class="picker-status">Loading brainrots…</p>';
  container.classList.remove('hidden');
}

async function ensureCatalogReady() {
  if (catalog.ready) return true;
  renderPickerLoading();
  await loadCatalog();
  return catalog.ready;
}

function initPicker() {
  const searchInput = $('#purchase-search');
  const resultsEl = $('#picker-results');

  const showPickerResults = () => {
    renderPickerResults(filterBrainrots(searchInput.value));
  };

  const debouncedPickerInput = debounce(showPickerResults, 120);

  searchInput.addEventListener('input', () => {
    if (!catalog.ready) return;
    debouncedPickerInput();
  });

  searchInput.addEventListener('focus', () => {
    if (catalog.ready) {
      showPickerResults();
      return;
    }
    ensureCatalogReady().then((ready) => {
      if (ready) showPickerResults();
    });
  });

  $('#picker-clear').addEventListener('click', () => {
    resetPicker();
    searchInput.focus();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#brainrot-picker')) {
      resultsEl.classList.add('hidden');
    }
  });
}

function openPurchaseModal() {
  $('#purchase-form').reset();
  resetPicker();
  $('#purchase-modal').showModal();
  ensureTraitsGrid();
  loadCatalog();
  if (catalog.ready) {
    $('#purchase-search').focus();
  } else {
    loadCatalog().then(() => {
      if ($('#purchase-modal').open) {
        $('#purchase-search').focus();
      }
    });
  }
}

function openSellModal(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;

  sellingItemId = itemId;
  const mutationLabel = item.mutationName
    ? ` (${item.mutationName}${item.mutationMultiplier != null ? ` · ${formatMultiplier(item.mutationMultiplier)}x` : ''})`
    : '';
  const traitsLabel = item.traits?.length
    ? ` · ${formatTraitsSummary(item.traits)}`
    : '';
  $('#sell-item-name').textContent = item.name + mutationLabel + traitsLabel;
  $('#sell-purchase-price').textContent = formatMoney(item.purchasePrice);
  $('#sell-price').value = item.askingPrice != null ? item.askingPrice : '';

  const sellThumb = $('#sell-item-thumb');
  const atlas = resolveItemAtlas(item);
  if (atlas) {
    applyAtlasToElement(sellThumb, atlas);
    sellThumb.classList.remove('hidden');
  } else {
    sellThumb.classList.add('hidden');
  }

  updateProfitPreview();
  $('#sell-modal').showModal();
  $('#sell-price').focus();
}

function openDeleteModal(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;

  deletingItemId = itemId;
  $('#delete-item-name').textContent = item.name;
  $('#delete-modal').showModal();
}

function updateProfitPreview() {
  const item = state.items.find((i) => i.id === sellingItemId);
  const preview = $('#profit-preview');
  const salePrice = parseFloat($('#sell-price').value);

  if (!item || isNaN(salePrice)) {
    preview.className = 'profit-preview empty';
    preview.textContent = '';
    return;
  }

  const profit = salePrice - item.purchasePrice;
  preview.className = `profit-preview ${profit >= 0 ? 'positive' : 'negative'}`;
  preview.textContent = `This sale: ${profit >= 0 ? '+' : ''}${formatMoney(profit)} profit`;
}

function addPurchase(e) {
  e.preventDefault();

  const slug = $('#purchase-slug').value.trim();
  const name = $('#purchase-name').value.trim();
  const mutationSlug = $('#purchase-mutation').value.trim() || 'default';
  const purchasePrice = parseFloat($('#purchase-price').value);
  const askingRaw = $('#purchase-asking').value;
  const askingPrice = askingRaw ? parseFloat(askingRaw) : null;
  const notes = $('#purchase-notes').value.trim();

  if (!slug || !name || isNaN(purchasePrice) || purchasePrice < 0) return;

  const entry = catalog.bySlug.get(slug) || pickerSelection;
  const mutation = getMutationInfo(mutationSlug);
  const atlas = entry?.raw
    ? resolveBrainrotAtlas(entry.raw, mutationSlug)
    : null;

  state.items.push({
    id: generateId(),
    name,
    slug,
    mutationSlug,
    mutationName: mutation.name,
    mutationMultiplier: mutation.multiplier,
    traits: getSelectedTraitsPayload(),
    atlas,
    rarity: entry?.rarity || null,
    purchasePrice,
    askingPrice: askingPrice != null && !isNaN(askingPrice) ? askingPrice : null,
    notes: notes || null,
    status: 'in-stock',
    purchasedAt: new Date().toISOString(),
    salePrice: null,
    soldAt: null,
  });

  saveData();
  renderAll();
  $('#purchase-modal').close();
  switchTab('stock');
  if (isDemoMode()) pulseDemoBanner();
}

function confirmSale(e) {
  e.preventDefault();

  const salePrice = parseFloat($('#sell-price').value);
  if (isNaN(salePrice) || salePrice < 0) return;

  const item = state.items.find((i) => i.id === sellingItemId);
  if (!item) return;

  item.status = 'sold';
  item.salePrice = salePrice;
  item.soldAt = new Date().toISOString();

  saveData();
  renderAll();
  sellingItemId = null;
  $('#sell-modal').close();
  switchTab('sold');
  if (isDemoMode()) pulseDemoBanner();
}

function confirmDelete(e) {
  e.preventDefault();

  state.items = state.items.filter((i) => i.id !== deletingItemId);
  deletingItemId = null;

  saveData();
  renderAll();
  $('#delete-modal').close();
  if (isDemoMode()) pulseDemoBanner();
}

function initTabs() {
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

function initModals() {
  $('#btn-add-purchase').addEventListener('click', openPurchaseModal);
  $('#btn-add-purchase-2').addEventListener('click', openPurchaseModal);

  $('#purchase-cancel').addEventListener('click', () => $('#purchase-modal').close());
  $('#purchase-form').addEventListener('submit', addPurchase);

  $('#sell-cancel').addEventListener('click', () => {
    sellingItemId = null;
    $('#sell-modal').close();
  });
  $('#sell-form').addEventListener('submit', confirmSale);
  $('#sell-price').addEventListener('input', updateProfitPreview);

  $('#delete-cancel').addEventListener('click', () => {
    deletingItemId = null;
    $('#delete-modal').close();
  });
  $('#delete-form').addEventListener('submit', confirmDelete);
}

function getAppVersion() {
  return document.querySelector('meta[name="app-version"]')?.content?.trim() || '0';
}

function initUpdateChecker() {
  const banner = $('#update-banner');
  const versionLabel = $('#update-version-label');
  const refreshBtn = $('#update-refresh');
  const dismissBtn = $('#update-dismiss');
  const isDesktopApp = Boolean(window.rotvaultDesktop?.isDesktopApp);
  if (!banner || isDesktopApp || (location.protocol === 'file:' && !isDesktopApp)) return;

  const currentVersion = getAppVersion();
  let latestVersion = null;

  async function checkForUpdate() {
    try {
      const res = await fetch(`version.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      latestVersion = data?.version?.trim();
      if (!latestVersion || latestVersion === currentVersion) {
        banner.classList.add('hidden');
        return;
      }
      if (sessionStorage.getItem('update-dismissed') === latestVersion) return;

      if (versionLabel) {
        versionLabel.textContent = `(v${latestVersion})`;
      }
      banner.classList.remove('hidden');
    } catch {
      /* offline or not hosted yet */
    }
  }

  refreshBtn?.addEventListener('click', () => {
    location.reload();
  });

  dismissBtn?.addEventListener('click', () => {
    if (latestVersion) {
      sessionStorage.setItem('update-dismissed', latestVersion);
    }
    banner.classList.add('hidden');
  });

  runWhenIdle(() => {
    checkForUpdate();
    window.setInterval(checkForUpdate, 5 * 60 * 1000);
  }, 5000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}

const THEME_STORAGE_KEY = 'rotvault-theme';

const DEFAULT_THEME = {
  accent: '#7c3aed',
  accentLight: '#a78bfa',
  neonBorder: '#a855f7',
  scrollbarThumb: '#a855f7',
  bgDark: '#0f0f1a',
  bgCard: '#1a1a2e',
};

const THEME_PRESETS = {
  purple: { ...DEFAULT_THEME },
  cyan: {
    accent: '#06b6d4',
    accentLight: '#67e8f9',
    neonBorder: '#22d3ee',
    scrollbarThumb: '#22d3ee',
    bgDark: '#0a1214',
    bgCard: '#102028',
  },
  green: {
    accent: '#22c55e',
    accentLight: '#86efac',
    neonBorder: '#4ade80',
    scrollbarThumb: '#4ade80',
    bgDark: '#0a120e',
    bgCard: '#142018',
  },
  pink: {
    accent: '#ec4899',
    accentLight: '#f9a8d4',
    neonBorder: '#f472b6',
    scrollbarThumb: '#f472b6',
    bgDark: '#120a10',
    bgCard: '#201018',
  },
};

function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

function saveTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
}

function applyTheme(theme) {
  const root = document.documentElement;
  const scrollbarThumb = theme.scrollbarThumb || theme.neonBorder || DEFAULT_THEME.scrollbarThumb;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-light', theme.accentLight);
  root.style.setProperty('--neon-border', theme.neonBorder);
  root.style.setProperty('--scrollbar-thumb', scrollbarThumb);
  root.style.setProperty('--scrollbar-track', darkenHex(theme.bgDark, 0.06));
  root.style.setProperty('--bg-dark', theme.bgDark);
  root.style.setProperty('--bg-card', theme.bgCard);
  root.style.setProperty('--bg-card-hover', lightenHex(theme.bgCard, 0.08));
  root.style.setProperty('--bg-input', darkenHex(theme.bgDark, 0.04));
}

function initTheme() {
  applyTheme(loadTheme());
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function lightenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

function darkenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function syncThemeInputs(theme) {
  const map = {
    'theme-neon': theme.neonBorder,
    'theme-accent': theme.accent,
    'theme-accent-light': theme.accentLight,
    'theme-bg': theme.bgDark,
    'theme-card': theme.bgCard,
    'theme-scrollbar': theme.scrollbarThumb || theme.neonBorder,
  };
  for (const [id, value] of Object.entries(map)) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }
}

function updateMaximizeButton(isMaximized) {
  const btn = document.getElementById('win-maximize');
  if (!btn) return;
  btn.textContent = isMaximized ? '❐' : '□';
  btn.title = isMaximized ? 'Restore' : 'Maximize';
  btn.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
}

function parseCalcNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function setCalcText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setCalcProfitClass(id, amount) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('is-positive', 'is-negative', 'is-neutral');
  if (amount > 0) el.classList.add('is-positive');
  else if (amount < 0) el.classList.add('is-negative');
  else el.classList.add('is-neutral');
}

function formatCalcPercent(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function linkCalcPercentInputs(rangeId, numId, max, onChange) {
  const range = document.getElementById(rangeId);
  const num = document.getElementById(numId);
  if (!range || !num) return;

  range.addEventListener('input', () => {
    num.value = range.value;
    updateCalcRangeFill(rangeId);
    onChange();
  });

  num.addEventListener('input', () => {
    const v = Math.min(max, Math.max(0, parseCalcNum(num.value)));
    range.value = Math.min(parseCalcNum(range.max), v);
    updateCalcRangeFill(rangeId);
    onChange();
  });

  updateCalcRangeFill(rangeId);
}

function setCalcPercent(rangeId, numId, pct) {
  const range = document.getElementById(rangeId);
  const num = document.getElementById(numId);
  if (range) range.value = Math.min(parseCalcNum(range.max), pct);
  if (num) num.value = pct;
  updateCalcRangeFill(rangeId);
}

function updateCalcRangeFill(rangeId) {
  const range = document.getElementById(rangeId);
  if (!range) return;
  const max = parseCalcNum(range.max) || 100;
  const val = parseCalcNum(range.value);
  range.style.setProperty('--range-fill', `${Math.min(100, (val / max) * 100)}%`);
}

let calcTradeSide = 'selling';

function applyCalcSideUI() {
  const side = calcTradeSide;
  document.querySelectorAll('.calc-side-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.calcSide === side);
  });

  const priceLabel = document.getElementById('calc-discount-price-label');
  const finalLabel = document.getElementById('calc-discount-final-label');
  const diffLabel = document.getElementById('calc-discount-diff-label');
  const diffValue = document.getElementById('calc-discount-save');

  if (side === 'buying') {
    if (priceLabel) priceLabel.textContent = 'Asking price ($)';
    if (finalLabel) finalLabel.textContent = 'You pay';
    if (diffLabel) diffLabel.textContent = 'You save';
    diffValue?.classList.remove('calc-result-value--loss', 'is-negative');
    diffValue?.classList.add('calc-result-value--save', 'is-positive');
  } else {
    if (priceLabel) priceLabel.textContent = 'List price ($)';
    if (finalLabel) finalLabel.textContent = 'Sale price';
    if (diffLabel) diffLabel.textContent = 'You lose';
    diffValue?.classList.remove('calc-result-value--save', 'is-positive');
    diffValue?.classList.add('calc-result-value--loss', 'is-negative');
  }
}

function updateDiscountCalc() {
  const price = parseCalcNum(document.getElementById('calc-discount-price')?.value);
  const pct = parseCalcNum(document.getElementById('calc-discount-pct')?.value);
  const save = price * (pct / 100);
  const final = Math.max(0, price - save);
  setCalcText('calc-discount-final', formatMoney(final));
  setCalcText('calc-discount-save', formatMoney(save));
}

function updateMarkupCalc() {
  const cost = parseCalcNum(document.getElementById('calc-markup-cost')?.value);
  const pct = parseCalcNum(document.getElementById('calc-markup-pct')?.value);
  const sell = cost * (1 + pct / 100);
  const profit = sell - cost;
  setCalcText('calc-markup-sell', formatMoney(sell));
  setCalcText('calc-markup-profit', formatMoney(profit));
  setCalcProfitClass('calc-markup-profit', profit);
}

function updateProfitCalc() {
  const buy = parseCalcNum(document.getElementById('calc-profit-buy')?.value);
  const sell = parseCalcNum(document.getElementById('calc-profit-sell')?.value);
  const profit = sell - buy;
  const margin = sell > 0 ? (profit / sell) * 100 : 0;
  const roi = buy > 0 ? (profit / buy) * 100 : 0;
  setCalcText('calc-profit-amount', formatMoney(profit));
  setCalcText('calc-profit-margin', formatCalcPercent(margin));
  setCalcText('calc-profit-roi', formatCalcPercent(roi));
  setCalcProfitClass('calc-profit-amount', profit);
  setCalcProfitClass('calc-profit-margin', profit);
  setCalcProfitClass('calc-profit-roi', profit);
}

function initCalculator() {
  const modal = document.getElementById('calc-modal');
  if (!modal) return;

  const openCalc = () => modal.showModal();

  document.getElementById('open-calc-btn')?.addEventListener('click', openCalc);
  document.getElementById('desktop-calc-btn')?.addEventListener('click', openCalc);
  document.getElementById('calc-close')?.addEventListener('click', () => modal.close());

  document.querySelectorAll('.calc-side-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      calcTradeSide = btn.dataset.calcSide === 'buying' ? 'buying' : 'selling';
      applyCalcSideUI();
    });
  });

  const calcModes = ['discount', 'markup', 'profit'];
  document.querySelectorAll('.calc-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.calcMode;
      document.querySelectorAll('.calc-tab').forEach((t) => {
        const active = t.dataset.calcMode === mode;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      calcModes.forEach((m) => {
        document.getElementById(`calc-panel-${m}`)?.classList.toggle('hidden', m !== mode);
      });
    });
  });

  linkCalcPercentInputs('calc-discount-range', 'calc-discount-pct', 100, updateDiscountCalc);
  linkCalcPercentInputs('calc-markup-range', 'calc-markup-pct', 999, updateMarkupCalc);

  document.querySelectorAll('.calc-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = parseCalcNum(btn.dataset.pct);
      const panel = btn.closest('.calc-panel');
      if (panel?.id === 'calc-panel-discount') {
        setCalcPercent('calc-discount-range', 'calc-discount-pct', pct);
        updateDiscountCalc();
      } else if (panel?.id === 'calc-panel-markup') {
        setCalcPercent('calc-markup-range', 'calc-markup-pct', pct);
        updateMarkupCalc();
      }
    });
  });

  ['calc-discount-price', 'calc-discount-pct', 'calc-discount-range'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateDiscountCalc);
  });
  ['calc-markup-cost', 'calc-markup-pct', 'calc-markup-range'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateMarkupCalc);
  });
  ['calc-profit-buy', 'calc-profit-sell'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateProfitCalc);
  });

  updateDiscountCalc();
  updateMarkupCalc();
  updateProfitCalc();
  applyCalcSideUI();
}

function initDesktopShell() {
  const desktop = window.rotvaultDesktop;
  if (!desktop?.isDesktopApp) return;

  document.documentElement.classList.add('desktop-app');

  const titlebar = document.getElementById('desktop-titlebar');
  if (titlebar) titlebar.hidden = false;

  document.getElementById('win-minimize')?.addEventListener('click', () => {
    desktop.minimize();
  });

  document.getElementById('win-maximize')?.addEventListener('click', async () => {
    const isMaximized = await desktop.maximize();
    updateMaximizeButton(isMaximized);
  });

  document.getElementById('win-close')?.addEventListener('click', () => {
    desktop.close();
  });

  desktop.isMaximized().then(updateMaximizeButton);
  desktop.onMaximizeChange?.(updateMaximizeButton);

  const settingsModal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('desktop-settings-btn');
  const settingsClose = document.getElementById('settings-close');
  const settingsReset = document.getElementById('settings-reset');

  settingsBtn?.addEventListener('click', () => {
    syncThemeInputs(loadTheme());
    settingsModal?.showModal();
  });

  settingsClose?.addEventListener('click', () => settingsModal?.close());
  document.getElementById('settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    settingsModal?.close();
  });

  const colorIds = ['theme-neon', 'theme-accent', 'theme-accent-light', 'theme-bg', 'theme-card', 'theme-scrollbar'];
  const themeKeys = {
    'theme-neon': 'neonBorder',
    'theme-accent': 'accent',
    'theme-accent-light': 'accentLight',
    'theme-bg': 'bgDark',
    'theme-card': 'bgCard',
    'theme-scrollbar': 'scrollbarThumb',
  };

  function updateThemeFromInputs() {
    const current = loadTheme();
    for (const id of colorIds) {
      const input = document.getElementById(id);
      if (input) current[themeKeys[id]] = input.value;
    }
    applyTheme(current);
    saveTheme(current);
    document.querySelectorAll('.settings-preset').forEach((btn) => {
      btn.classList.remove('is-active');
    });
  }

  for (const id of colorIds) {
    document.getElementById(id)?.addEventListener('input', updateThemeFromInputs);
  }

  document.querySelectorAll('.settings-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = THEME_PRESETS[btn.dataset.preset];
      if (!preset) return;
      const next = { ...preset };
      applyTheme(next);
      saveTheme(next);
      syncThemeInputs(next);
      document.querySelectorAll('.settings-preset').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    });
  });

  settingsReset?.addEventListener('click', () => {
    const next = { ...DEFAULT_THEME };
    applyTheme(next);
    saveTheme(next);
    syncThemeInputs(next);
    document.querySelectorAll('.settings-preset').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.preset === 'purple');
    });
  });

  document.querySelector('.settings-preset[data-preset="purple"]')?.classList.add('is-active');
}

function bootstrap() {
  loadData();
  initDemoMode();
  initTabs();
  initModals();
  initPicker();
  initStatControls();
  initTheme();
  initCalculator();
  initDesktopShell();
  renderAll();
  initUpdateChecker();
  runWhenIdle(() => loadCatalog(), 1500);
}

bootstrap();
