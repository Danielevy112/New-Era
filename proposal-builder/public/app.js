/* New Era — Gift Package Proposal Builder (frontend SPA) */

const state = {
  view: 'dashboard',
  settings: {},
  products: [],
  packages: [],
  proposals: [],
  summary: null
};

// ── API helpers ──────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadAll() {
  const [settings, products, packages, proposals, summary] = await Promise.all([
    api('GET', '/api/settings'),
    api('GET', '/api/products'),
    api('GET', '/api/packages'),
    api('GET', '/api/proposals'),
    api('GET', '/api/summary')
  ]);
  state.settings = settings;
  state.products = products.products;
  state.packages = packages.packages;
  state.proposals = proposals.proposals;
  state.summary = summary;
}

// ── Formatting ───────────────────────────────────────────────────────────────
function money(n) {
  const cur = state.settings.currency || '₪';
  return `${cur}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, kind = 'ok') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── Modal ────────────────────────────────────────────────────────────────────
function openModal(html, wide) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
  root.querySelector('.modal-backdrop').addEventListener('mousedown', e => {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
  });
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function confirmAction(message, onYes) {
  openModal(`
    <h2>Please confirm</h2>
    <p class="modal-sub">${esc(message)}</p>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn danger" id="confirm-yes">Delete</button>
    </div>`);
  document.getElementById('confirm-yes').onclick = async () => { await onYes(); closeModal(); };
}

// ── Navigation ───────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item[data-view]').forEach(i =>
    i.classList.toggle('active', i.dataset.view === view));
  render();
}

async function render() {
  const main = document.getElementById('main');
  if (state.view === 'dashboard') main.innerHTML = renderDashboard();
  else if (state.view === 'proposals') main.innerHTML = renderProposals();
  else if (state.view === 'packages') main.innerHTML = renderPackages();
  else if (state.view === 'products') main.innerHTML = renderProducts();
  else if (state.view === 'settings') main.innerHTML = renderSettings();
  bindViewEvents();
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const s = state.summary || {};
  const bs = s.byStatus || {};
  const recent = state.proposals.slice(0, 6);
  return `
    <div class="page-head">
      <div><h1>Dashboard</h1><p>Overview of your gifting proposals pipeline.</p></div>
      <button class="btn primary" onclick="openProposalBuilder()">+ New Proposal</button>
    </div>
    <div class="stat-grid">
      <div class="stat"><div class="label">Open pipeline</div><div class="value">${money(s.pipelineValue)}</div><div class="sub">${bs.sent || 0} proposals sent</div></div>
      <div class="stat"><div class="label">Won</div><div class="value">${money(s.acceptedValue)}</div><div class="sub">${bs.accepted || 0} accepted</div></div>
      <div class="stat"><div class="label">Products</div><div class="value">${s.products || 0}</div><div class="sub">${s.packages || 0} packages</div></div>
      <div class="stat"><div class="label">Total proposals</div><div class="value">${s.proposals || 0}</div><div class="sub">${bs.draft || 0} drafts</div></div>
    </div>
    <div class="card">
      <div class="toolbar"><h2 style="margin:0;font-size:16px">Recent proposals</h2><div class="spacer"></div>
        <button class="btn sm" onclick="switchView('proposals')">View all →</button></div>
      ${recent.length ? `<table><thead><tr><th>Number</th><th>Company</th><th>Title</th><th>Status</th><th class="num">Total</th><th>Updated</th></tr></thead>
      <tbody>${recent.map(p => `
        <tr style="cursor:pointer" onclick="openProposalBuilder('${p.id}')">
          <td>${esc(p.number)}</td>
          <td>${esc(p.companyName) || '<span class="muted">—</span>'}</td>
          <td>${esc(p.title)}</td>
          <td><span class="badge ${p.status}">${p.status}</span></td>
          <td class="num">${money(p.totals.grandTotal)}</td>
          <td>${fmtDate(p.updatedAt)}</td>
        </tr>`).join('')}</tbody></table>`
      : emptyState('No proposals yet', 'Create your first proposal to get started.', 'New Proposal', 'openProposalBuilder()')}
    </div>`;
}

function emptyState(title, sub, btnLabel, btnAction) {
  return `<div class="empty"><div class="big">📦</div><div style="font-weight:600;color:var(--text)">${esc(title)}</div>
    <div style="margin:6px 0 16px">${esc(sub)}</div>
    ${btnLabel ? `<button class="btn primary" onclick="${btnAction}">+ ${esc(btnLabel)}</button>` : ''}</div>`;
}

// ── Proposals list ───────────────────────────────────────────────────────────
function renderProposals() {
  const rows = state.proposals;
  return `
    <div class="page-head">
      <div><h1>Proposals</h1><p>Every company inquiry and the offer you sent.</p></div>
      <button class="btn primary" onclick="openProposalBuilder()">+ New Proposal</button>
    </div>
    <div class="toolbar">
      <input class="search" id="prop-search" placeholder="Search company, contact, title…" oninput="filterProposals(this.value)">
      <select id="prop-status" onchange="filterProposals()" style="max-width:160px">
        <option value="">All statuses</option>
        <option value="draft">Draft</option><option value="sent">Sent</option>
        <option value="accepted">Accepted</option><option value="declined">Declined</option>
      </select>
    </div>
    <div class="card" id="prop-table">${proposalTable(rows)}</div>`;
}

function proposalTable(rows) {
  if (!rows.length) return emptyState('No proposals match', 'Try a different search or create a new proposal.', 'New Proposal', 'openProposalBuilder()');
  return `<table><thead><tr><th>Number</th><th>Company</th><th>Title</th><th>Status</th><th class="num">Total</th><th>Created</th><th></th></tr></thead>
    <tbody>${rows.map(p => `
      <tr>
        <td onclick="openProposalBuilder('${p.id}')" style="cursor:pointer">${esc(p.number)}</td>
        <td onclick="openProposalBuilder('${p.id}')" style="cursor:pointer;font-weight:600">${esc(p.companyName) || '—'}</td>
        <td>${esc(p.title)}</td>
        <td><span class="badge ${p.status}">${p.status}</span></td>
        <td class="num">${money(p.totals.grandTotal)}</td>
        <td>${fmtDate(p.createdAt)}</td>
        <td class="num">
          <button class="btn sm ghost" title="Open printable proposal" onclick="window.open('/proposal/${p.id}','_blank')">🖨</button>
          <button class="btn sm ghost" title="Duplicate" onclick="duplicateProposal('${p.id}')">⧉</button>
          <button class="btn sm danger" title="Delete" onclick="deleteProposal('${p.id}','${esc(p.number)}')">🗑</button>
        </td>
      </tr>`).join('')}</tbody></table>`;
}

function filterProposals() {
  const q = (document.getElementById('prop-search')?.value || '').toLowerCase();
  const status = document.getElementById('prop-status')?.value || '';
  let rows = state.proposals;
  if (status) rows = rows.filter(p => p.status === status);
  if (q) rows = rows.filter(p =>
    (p.companyName || '').toLowerCase().includes(q) ||
    (p.contactName || '').toLowerCase().includes(q) ||
    (p.title || '').toLowerCase().includes(q));
  document.getElementById('prop-table').innerHTML = proposalTable(rows);
}

async function duplicateProposal(id) {
  try {
    await api('POST', `/api/proposals/${id}/duplicate`);
    await loadAll(); render();
    toast('Proposal duplicated');
  } catch (e) { toast(e.message, 'err'); }
}
function deleteProposal(id, number) {
  confirmAction(`Delete proposal ${number}? This cannot be undone.`, async () => {
    await api('DELETE', `/api/proposals/${id}`);
    await loadAll(); render();
    toast('Proposal deleted');
  });
}

// ── Products ─────────────────────────────────────────────────────────────────
function renderProducts() {
  return `
    <div class="page-head">
      <div><h1>Products</h1><p>Your catalog — prices flow automatically into proposals.</p></div>
      <div style="display:flex;gap:10px">
        <button class="btn" onclick="openImport()">⇪ Import CSV</button>
        <button class="btn primary" onclick="openProductForm()">+ Add Product</button>
      </div>
    </div>
    <div class="toolbar">
      <input class="search" id="prod-search" placeholder="Search products…" oninput="filterProducts(this.value)">
    </div>
    <div class="card" id="prod-table">${productTable(state.products)}</div>`;
}

function productTable(rows) {
  if (!rows.length) return emptyState('No products yet', 'Add products or import your price spreadsheet as CSV.', 'Add Product', 'openProductForm()');
  return `<table><thead><tr><th></th><th>Name</th><th>SKU</th><th>Category</th><th class="num">Price</th><th></th></tr></thead>
    <tbody>${rows.map(p => `
      <tr>
        <td>${p.imageUrl ? `<img class="thumb" src="${esc(p.imageUrl)}" onerror="this.style.display='none'">` : '<span class="thumb ph">📦</span>'}</td>
        <td style="font-weight:600">${esc(p.name)}<div class="help">${esc(p.description).slice(0, 60)}</div></td>
        <td>${esc(p.sku) || '—'}</td>
        <td>${esc(p.category) || '—'}</td>
        <td class="num">${money(p.price)}</td>
        <td class="num">
          <button class="btn sm ghost" onclick="openProductForm('${p.id}')">Edit</button>
          <button class="btn sm danger" onclick="deleteProduct('${p.id}','${esc(p.name)}')">🗑</button>
        </td>
      </tr>`).join('')}</tbody></table>`;
}

function filterProducts(q) {
  q = (q || '').toLowerCase();
  const rows = state.products.filter(p =>
    p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  document.getElementById('prod-table').innerHTML = productTable(rows);
}

function openProductForm(id) {
  const p = id ? state.products.find(x => x.id === id) : {};
  openModal(`
    <h2>${id ? 'Edit' : 'Add'} product</h2>
    <p class="modal-sub">Prices here are pulled into any package or proposal automatically.</p>
    <label class="field"><span>Product name *</span><input id="pf-name" value="${esc(p.name)}"></label>
    <div class="row">
      <label class="field"><span>SKU</span><input id="pf-sku" value="${esc(p.sku)}"></label>
      <label class="field"><span>Category</span><input id="pf-category" value="${esc(p.category)}"></label>
      <label class="field"><span>Price</span><input id="pf-price" type="number" step="0.01" value="${p.price != null ? p.price : ''}"></label>
    </div>
    <label class="field"><span>Image URL</span><input id="pf-image" value="${esc(p.imageUrl)}" placeholder="https://yoursite.com/images/gift.jpg"></label>
    <label class="field"><span>Description</span><textarea id="pf-desc">${esc(p.description)}</textarea></label>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="pf-save">Save</button>
    </div>`);
  document.getElementById('pf-save').onclick = async () => {
    const body = {
      name: val('pf-name'), sku: val('pf-sku'), category: val('pf-category'),
      price: val('pf-price'), imageUrl: val('pf-image'), description: val('pf-desc')
    };
    if (!body.name.trim()) return toast('Name is required', 'err');
    try {
      if (id) await api('PUT', `/api/products/${id}`, body);
      else await api('POST', '/api/products', body);
      await loadAll(); closeModal(); render(); toast('Product saved');
    } catch (e) { toast(e.message, 'err'); }
  };
}

function deleteProduct(id, name) {
  confirmAction(`Delete "${name}" from your catalog?`, async () => {
    await api('DELETE', `/api/products/${id}`);
    await loadAll(); render(); toast('Product deleted');
  });
}

// CSV import
function openImport() {
  openModal(`
    <h2>Import products from CSV</h2>
    <p class="modal-sub">Paste from your spreadsheet or upload a .csv file. Expected columns (header row):
      <b>name, sku, category, price, description, imageUrl</b>. Only <b>name</b> is required; column order is auto-detected.</p>
    <input type="file" id="imp-file" accept=".csv,text/csv" style="margin-bottom:10px">
    <label class="field"><span>Or paste CSV / tab-separated rows here</span>
      <textarea id="imp-text" style="min-height:160px" placeholder="name,price,category&#10;Wine Gift Box,120,Premium&#10;Chocolate Set,65,Sweets"></textarea></label>
    <label class="field"><span>Import mode</span>
      <select id="imp-mode"><option value="append">Add / update existing (match by SKU or name)</option>
        <option value="replace">Replace entire catalog</option></select></label>
    <div id="imp-preview" class="help"></div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="imp-run">Import</button>
    </div>`);
  document.getElementById('imp-file').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { document.getElementById('imp-text').value = reader.result; previewImport(); };
    reader.readAsText(file);
  };
  document.getElementById('imp-text').oninput = previewImport;
  document.getElementById('imp-run').onclick = async () => {
    const rows = parseCSV(val('imp-text'));
    if (!rows.length) return toast('Nothing to import — check your columns', 'err');
    try {
      const r = await api('POST', '/api/products/import', { rows, mode: val('imp-mode') });
      await loadAll(); closeModal(); render();
      toast(`Imported ${r.imported} new, updated ${r.updated}`);
    } catch (e) { toast(e.message, 'err'); }
  };
}
function previewImport() {
  const rows = parseCSV(val('imp-text'));
  document.getElementById('imp-preview').textContent = rows.length
    ? `Detected ${rows.length} product row(s) ready to import.` : 'No valid rows detected yet.';
}

// Parse CSV or TSV with header-based column mapping. Handles quoted fields.
function parseCSV(text) {
  text = (text || '').trim();
  if (!text) return [];
  const lines = splitLines(text);
  if (lines.length < 1) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const header = parseLine(lines[0], delim).map(h => h.trim().toLowerCase());
  const map = {};
  header.forEach((h, i) => {
    if (['name', 'product', 'title', 'item'].includes(h)) map.name = i;
    else if (['sku', 'code', 'id'].includes(h)) map.sku = i;
    else if (['category', 'type', 'group'].includes(h)) map.category = i;
    else if (['price', 'cost', 'unit price', 'amount'].includes(h)) map.price = i;
    else if (['description', 'desc', 'details'].includes(h)) map.description = i;
    else if (['imageurl', 'image', 'image url', 'photo', 'img'].includes(h)) map.imageUrl = i;
  });
  // If no recognizable header, assume: name, price, category.
  const hasHeader = Object.keys(map).length > 0;
  const startRow = hasHeader ? 1 : 0;
  if (!hasHeader) { map.name = 0; map.price = 1; map.category = 2; }

  const out = [];
  for (let i = startRow; i < lines.length; i++) {
    const cells = parseLine(lines[i], delim);
    const name = (cells[map.name] || '').trim();
    if (!name) continue;
    out.push({
      name,
      sku: map.sku != null ? (cells[map.sku] || '').trim() : '',
      category: map.category != null ? (cells[map.category] || '').trim() : '',
      price: map.price != null ? parseFloat((cells[map.price] || '0').replace(/[^0-9.\-]/g, '')) || 0 : 0,
      description: map.description != null ? (cells[map.description] || '').trim() : '',
      imageUrl: map.imageUrl != null ? (cells[map.imageUrl] || '').trim() : ''
    });
  }
  return out;
}
function splitLines(text) { return text.split(/\r\n|\n|\r/).filter(l => l.trim().length); }
function parseLine(line, delim) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === delim && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// ── Packages ─────────────────────────────────────────────────────────────────
function renderPackages() {
  return `
    <div class="page-head">
      <div><h1>Packages</h1><p>Reusable bundles you can drop into a proposal in one click.</p></div>
      <button class="btn primary" onclick="openPackageForm()">+ New Package</button>
    </div>
    <div id="pkg-list">${packageCards()}</div>`;
}
function packageCards() {
  if (!state.packages.length) return emptyState('No packages yet', 'Build a bundle of products you offer repeatedly.', 'New Package', 'openPackageForm()');
  return state.packages.map(pkg => {
    const total = packageTotal(pkg);
    const items = pkg.items.map(it => {
      const prod = state.products.find(p => p.id === it.productId);
      return prod ? `<span class="chip">${esc(prod.name)} ×${it.quantity}</span>` : '';
    }).join('');
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
        <div>
          <div style="font-weight:700;font-size:16px">${esc(pkg.name)}</div>
          <div class="help">${esc(pkg.description)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:18px">${money(total)}</div>
          <div class="help">${pkg.items.length} item(s)</div>
        </div>
      </div>
      <div style="margin:12px 0">${items || '<span class="help">No products in this package.</span>'}</div>
      <div style="display:flex;gap:8px">
        <button class="btn sm primary" onclick="openProposalBuilder(null,'${pkg.id}')">Use in proposal</button>
        <button class="btn sm ghost" onclick="openPackageForm('${pkg.id}')">Edit</button>
        <button class="btn sm danger" onclick="deletePackage('${pkg.id}','${esc(pkg.name)}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}
function packageTotal(pkg) {
  return pkg.items.reduce((s, it) => {
    const prod = state.products.find(p => p.id === it.productId);
    return s + (prod ? prod.price * it.quantity : 0);
  }, 0);
}

// Package builder — a lightweight product picker with quantities.
let pkgDraft = { id: null, name: '', description: '', items: [] };
function openPackageForm(id) {
  const pkg = id ? state.packages.find(p => p.id === id) : { name: '', description: '', items: [] };
  pkgDraft = {
    id: id || null,
    name: pkg.name || '',
    description: pkg.description || '',
    items: JSON.parse(JSON.stringify(pkg.items || []))
  };
  renderPackageForm();
}
function pkgCollectFromForm() {
  if (document.getElementById('pkg-name')) pkgDraft.name = val('pkg-name');
  if (document.getElementById('pkg-desc')) pkgDraft.description = val('pkg-desc');
}
function renderPackageForm() {
  openModal(`
    <h2>${pkgDraft.id ? 'Edit' : 'New'} package</h2>
    <p class="modal-sub">A package is a reusable set of products. Prices are always taken live from the catalog.</p>
    <label class="field"><span>Package name *</span><input id="pkg-name" value="${esc(pkgDraft.name)}"></label>
    <label class="field"><span>Description</span><textarea id="pkg-desc">${esc(pkgDraft.description)}</textarea></label>
    <div style="font-weight:600;margin:6px 0">Products</div>
    <div id="pkg-items"></div>
    <button class="btn sm" style="margin-top:8px" onclick="pkgAddPicker()">+ Add product</button>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="pkg-save">Save package</button>
    </div>`, true);
  renderPkgItems();
  document.getElementById('pkg-save').onclick = async () => {
    pkgCollectFromForm();
    if (!pkgDraft.name.trim()) return toast('Package name is required', 'err');
    const body = { name: pkgDraft.name, description: pkgDraft.description, items: pkgDraft.items };
    try {
      if (pkgDraft.id) await api('PUT', `/api/packages/${pkgDraft.id}`, body);
      else await api('POST', '/api/packages', body);
      await loadAll(); window.__reopen = null; closeModal(); render(); toast('Package saved');
    } catch (e) { toast(e.message, 'err'); }
  };
}
function renderPkgItems() {
  const host = document.getElementById('pkg-items');
  if (!pkgDraft.items.length) { host.innerHTML = '<div class="help">No products added yet.</div>'; return; }
  host.innerHTML = pkgDraft.items.map((it, idx) => {
    const prod = state.products.find(p => p.id === it.productId);
    return `<div class="li-row">
      <div class="name">${prod && prod.imageUrl ? `<img class="thumb" src="${esc(prod.imageUrl)}">` : '<span class="thumb ph">📦</span>'}${esc(prod ? prod.name : 'Unknown')}</div>
      <input type="number" min="1" value="${it.quantity}" onchange="pkgQty(${idx}, this.value)">
      <div class="num">${money(prod ? prod.price : 0)}</div>
      <div class="num">${money((prod ? prod.price : 0) * it.quantity)}</div>
      <button class="li-remove" onclick="pkgRemove(${idx})">×</button>
    </div>`;
  }).join('');
}
function pkgQty(idx, v) { pkgDraft.items[idx].quantity = Math.max(1, parseInt(v, 10) || 1); renderPkgItems(); }
function pkgRemove(idx) { pkgDraft.items.splice(idx, 1); renderPkgItems(); }
function pkgAddPicker() {
  pkgCollectFromForm();
  window.__reopen = renderPackageForm;
  productPicker(prod => {
    const existing = pkgDraft.items.find(i => i.productId === prod.id);
    if (existing) existing.quantity++;
    else pkgDraft.items.push({ productId: prod.id, quantity: 1 });
  });
}
function deletePackage(id, name) {
  confirmAction(`Delete package "${name}"?`, async () => {
    await api('DELETE', `/api/packages/${id}`);
    await loadAll(); render(); toast('Package deleted');
  });
}

// Reusable product picker overlay (returns chosen product via callback).
function productPicker(onPick) {
  const listId = 'picker-' + Date.now();
  openModal(`
    <h2>Pick a product</h2>
    <input class="search" id="picker-search" placeholder="Search…" style="max-width:100%;margin-bottom:10px" oninput="renderPicker('${listId}', this.value)">
    <div class="picker-list" id="${listId}"></div>
    <div class="modal-foot"><button class="btn ghost" onclick="reopenLast()">Done</button></div>`);
  window.__pickerCb = onPick;
  renderPicker(listId, '');
  setTimeout(() => document.getElementById('picker-search')?.focus(), 50);
}
function renderPicker(listId, q) {
  q = (q || '').toLowerCase();
  const rows = state.products.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  const host = document.getElementById(listId);
  if (!host) return;
  host.innerHTML = rows.length ? rows.map(p => `
    <div class="picker-item" onclick="pickProduct('${p.id}')">
      ${p.imageUrl ? `<img class="thumb" src="${esc(p.imageUrl)}">` : '<span class="thumb ph">📦</span>'}
      <span class="pname">${esc(p.name)}${p.category ? ` <span class="help">· ${esc(p.category)}</span>` : ''}</span>
      <span class="pprice">${money(p.price)}</span>
    </div>`).join('') : '<div class="help" style="padding:14px">No products. Add some in the Products tab.</div>';
}
function pickProduct(id) {
  const prod = state.products.find(p => p.id === id);
  if (prod && window.__pickerCb) window.__pickerCb(prod);
  closeModal();
  if (window.__reopen) window.__reopen();
}
function reopenLast() { closeModal(); if (window.__reopen) window.__reopen(); }

// ── Proposal builder ─────────────────────────────────────────────────────────
let propDraft = null;
function openProposalBuilder(id, presetPackageId) {
  let base;
  if (id) {
    const p = state.proposals.find(x => x.id === id);
    base = JSON.parse(JSON.stringify(p));
  } else {
    base = {
      id: null, title: 'Gift Package Proposal', companyName: '', contactName: '',
      contactEmail: '', contactPhone: '', notes: '', status: 'draft',
      lineItems: [], extras: [], discount: { type: 'none', value: 0 },
      taxRate: state.settings.taxRate || 0
    };
    if (presetPackageId) {
      const pkg = state.packages.find(p => p.id === presetPackageId);
      if (pkg) {
        base.title = pkg.name;
        base.lineItems = pkg.items.map(it => ({ productId: it.productId, quantity: it.quantity }));
      }
    }
  }
  propDraft = base;
  // Reopen this builder after any picker overlay closes.
  window.__reopen = () => renderBuilder(id);
  renderBuilder(id);
}

function renderBuilder(id) {
  const p = propDraft;
  openModal(`
    <h2>${id ? 'Edit proposal' : 'New proposal'}</h2>
    <p class="modal-sub">Pick products or a package, add delivery & extras — the total updates live from your catalog prices.</p>

    <div class="row">
      <label class="field"><span>Company name *</span><input id="b-company" value="${esc(p.companyName)}"></label>
      <label class="field"><span>Proposal title</span><input id="b-title" value="${esc(p.title)}"></label>
    </div>
    <div class="row">
      <label class="field"><span>Contact name</span><input id="b-contact" value="${esc(p.contactName)}"></label>
      <label class="field"><span>Contact email</span><input id="b-email" value="${esc(p.contactEmail)}"></label>
      <label class="field"><span>Contact phone</span><input id="b-phone" value="${esc(p.contactPhone)}"></label>
    </div>

    <div style="display:flex;gap:8px;margin:10px 0 6px;flex-wrap:wrap">
      <button class="btn sm" onclick="builderAddProduct()">+ Add product</button>
      <button class="btn sm" onclick="builderAddPackage()">+ Add a package</button>
      <button class="btn sm ghost" onclick="builderAddCustomLine()">+ Custom line</button>
    </div>
    <div class="li-row head"><div>Item</div><div>Qty</div><div>Unit</div><div class="num">Total</div><div></div></div>
    <div id="b-items"></div>

    <div style="font-weight:600;margin:16px 0 6px">Extras (delivery, logistics, setup…)</div>
    <div id="b-extras"></div>
    <button class="btn sm ghost" style="margin-top:6px" onclick="builderAddExtra()">+ Add extra</button>

    <div class="row" style="margin-top:16px">
      <label class="field"><span>Discount</span>
        <div style="display:flex;gap:6px">
          <select id="b-disc-type" style="max-width:110px" onchange="builderRecalc()">
            <option value="none"${p.discount.type === 'none' ? ' selected' : ''}>None</option>
            <option value="percent"${p.discount.type === 'percent' ? ' selected' : ''}>%</option>
            <option value="fixed"${p.discount.type === 'fixed' ? ' selected' : ''}>Fixed</option>
          </select>
          <input id="b-disc-val" type="number" step="0.01" value="${p.discount.value || ''}" oninput="builderRecalc()">
        </div>
      </label>
      <label class="field"><span>Tax / VAT rate (%)</span><input id="b-tax" type="number" step="0.01" value="${p.taxRate || 0}" oninput="builderRecalc()"></label>
      <label class="field"><span>Status</span>
        <select id="b-status">
          <option value="draft"${p.status === 'draft' ? ' selected' : ''}>Draft</option>
          <option value="sent"${p.status === 'sent' ? ' selected' : ''}>Sent</option>
          <option value="accepted"${p.status === 'accepted' ? ' selected' : ''}>Accepted</option>
          <option value="declined"${p.status === 'declined' ? ' selected' : ''}>Declined</option>
        </select>
      </label>
    </div>

    <label class="field"><span>Notes for the client</span><textarea id="b-notes">${esc(p.notes)}</textarea></label>

    <div class="totals-box" id="b-totals"></div>

    <div class="modal-foot">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      ${id ? `<button class="btn" onclick="window.open('/proposal/${id}','_blank')">🖨 Open PDF view</button>` : ''}
      <button class="btn primary" id="b-save">${id ? 'Save changes' : 'Create proposal'}</button>
    </div>`, true);

  renderBuilderItems();
  renderBuilderExtras();
  builderRecalc();
  document.getElementById('b-save').onclick = () => saveProposal(id);
}

function collectDraftFromForm() {
  propDraft.companyName = val('b-company');
  propDraft.title = val('b-title');
  propDraft.contactName = val('b-contact');
  propDraft.contactEmail = val('b-email');
  propDraft.contactPhone = val('b-phone');
  propDraft.notes = val('b-notes');
  propDraft.status = val('b-status') || propDraft.status;
  propDraft.discount = { type: val('b-disc-type'), value: parseFloat(val('b-disc-val')) || 0 };
  propDraft.taxRate = parseFloat(val('b-tax')) || 0;
}

function renderBuilderItems() {
  const host = document.getElementById('b-items');
  if (!propDraft.lineItems.length) { host.innerHTML = '<div class="help" style="padding:8px 0">No items yet — add a product, a package, or a custom line.</div>'; return; }
  host.innerHTML = propDraft.lineItems.map((li, idx) => {
    const prod = li.productId ? state.products.find(p => p.id === li.productId) : null;
    const unit = li.unitPrice != null && li.unitPrice !== '' ? li.unitPrice : (prod ? prod.price : 0);
    const name = li.name || (prod ? prod.name : 'Item');
    const img = (prod && prod.imageUrl) || li.imageUrl;
    return `<div class="li-row">
      <div class="name">${img ? `<img class="thumb" src="${esc(img)}">` : '<span class="thumb ph">📦</span>'}
        ${li.productId ? esc(name) : `<input value="${esc(name)}" onchange="builderSetName(${idx}, this.value)" placeholder="Item name">`}</div>
      <input type="number" min="1" value="${li.quantity || 1}" onchange="builderSetQty(${idx}, this.value)">
      <input type="number" step="0.01" value="${unit}" onchange="builderSetUnit(${idx}, this.value)">
      <div class="num">${money((parseFloat(unit) || 0) * (li.quantity || 1))}</div>
      <button class="li-remove" onclick="builderRemoveItem(${idx})">×</button>
    </div>`;
  }).join('');
}
function builderSetQty(i, v) { propDraft.lineItems[i].quantity = Math.max(1, parseInt(v, 10) || 1); renderBuilderItems(); builderRecalc(); }
function builderSetUnit(i, v) { propDraft.lineItems[i].unitPrice = parseFloat(v) || 0; renderBuilderItems(); builderRecalc(); }
function builderSetName(i, v) { propDraft.lineItems[i].name = v; }
function builderRemoveItem(i) { propDraft.lineItems.splice(i, 1); renderBuilderItems(); builderRecalc(); }

function builderAddProduct() {
  collectDraftFromForm();
  productPicker(prod => {
    const existing = propDraft.lineItems.find(li => li.productId === prod.id);
    if (existing) existing.quantity = (existing.quantity || 1) + 1;
    else propDraft.lineItems.push({ productId: prod.id, quantity: 1 });
  });
}
function builderAddPackage() {
  collectDraftFromForm();
  if (!state.packages.length) return toast('No packages yet — create one first', 'err');
  openModal(`
    <h2>Add a package</h2>
    <div class="picker-list">${state.packages.map(pkg => `
      <div class="picker-item" onclick="builderApplyPackage('${pkg.id}')">
        <span class="pname">${esc(pkg.name)} <span class="help">· ${pkg.items.length} items</span></span>
        <span class="pprice">${money(packageTotal(pkg))}</span>
      </div>`).join('')}</div>
    <div class="modal-foot"><button class="btn ghost" onclick="reopenLast()">Cancel</button></div>`);
}
function builderApplyPackage(pkgId) {
  const pkg = state.packages.find(p => p.id === pkgId);
  if (pkg) pkg.items.forEach(it => {
    const existing = propDraft.lineItems.find(li => li.productId === it.productId);
    if (existing) existing.quantity += it.quantity;
    else propDraft.lineItems.push({ productId: it.productId, quantity: it.quantity });
  });
  closeModal();
  renderBuilder(propDraft.id);
}
function builderAddCustomLine() {
  collectDraftFromForm();
  propDraft.lineItems.push({ productId: null, name: '', quantity: 1, unitPrice: 0 });
  renderBuilder(propDraft.id);
}

function renderBuilderExtras() {
  const host = document.getElementById('b-extras');
  if (!propDraft.extras.length) { host.innerHTML = '<div class="help">No extras. Add delivery, gift wrapping, logistics, etc.</div>'; return; }
  host.innerHTML = propDraft.extras.map((e, idx) => `
    <div class="li-row" style="grid-template-columns:1fr 130px 32px">
      <input value="${esc(e.label)}" placeholder="e.g. Delivery" onchange="builderSetExtraLabel(${idx}, this.value)">
      <input type="number" step="0.01" value="${e.amount || 0}" onchange="builderSetExtraAmount(${idx}, this.value)">
      <button class="li-remove" onclick="builderRemoveExtra(${idx})">×</button>
    </div>`).join('');
}
function builderAddExtra() { collectDraftFromForm(); propDraft.extras.push({ label: 'Delivery', amount: 0 }); renderBuilder(propDraft.id); }
function builderSetExtraLabel(i, v) { propDraft.extras[i].label = v; }
function builderSetExtraAmount(i, v) { propDraft.extras[i].amount = parseFloat(v) || 0; builderRecalc(); }
function builderRemoveExtra(i) { propDraft.extras.splice(i, 1); renderBuilderExtras(); builderRecalc(); }

function builderRecalc() {
  // Read current discount/tax straight from inputs so totals are always live.
  const discType = val('b-disc-type');
  const discVal = parseFloat(val('b-disc-val')) || 0;
  const taxRate = parseFloat(val('b-tax')) || 0;

  const itemsSubtotal = propDraft.lineItems.reduce((s, li) => {
    const prod = li.productId ? state.products.find(p => p.id === li.productId) : null;
    const unit = li.unitPrice != null && li.unitPrice !== '' ? parseFloat(li.unitPrice) : (prod ? prod.price : 0);
    return s + (parseFloat(unit) || 0) * (li.quantity || 1);
  }, 0);
  const extrasSubtotal = propDraft.extras.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const subtotal = itemsSubtotal + extrasSubtotal;
  let discountAmount = 0;
  if (discType === 'percent') discountAmount = subtotal * discVal / 100;
  else if (discType === 'fixed') discountAmount = discVal;
  discountAmount = Math.min(discountAmount, subtotal);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * taxRate / 100;
  const grand = afterDiscount + taxAmount;

  document.getElementById('b-totals').innerHTML = `
    <div class="line muted"><span>Items</span><span>${money(itemsSubtotal)}</span></div>
    ${extrasSubtotal ? `<div class="line muted"><span>Extras</span><span>${money(extrasSubtotal)}</span></div>` : ''}
    <div class="line"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    ${discountAmount ? `<div class="line muted"><span>Discount</span><span>−${money(discountAmount)}</span></div>` : ''}
    ${taxRate ? `<div class="line muted"><span>Tax (${taxRate}%)</span><span>${money(taxAmount)}</span></div>` : ''}
    <div class="line grand"><span>Total</span><span>${money(grand)}</span></div>`;
}

async function saveProposal(id) {
  collectDraftFromForm();
  if (!propDraft.companyName.trim()) return toast('Company name is required', 'err');
  const body = {
    title: propDraft.title, companyName: propDraft.companyName,
    contactName: propDraft.contactName, contactEmail: propDraft.contactEmail, contactPhone: propDraft.contactPhone,
    notes: propDraft.notes, status: propDraft.status,
    lineItems: propDraft.lineItems, extras: propDraft.extras,
    discount: propDraft.discount, taxRate: propDraft.taxRate
  };
  try {
    let saved;
    if (id) saved = await api('PUT', `/api/proposals/${id}`, body);
    else saved = await api('POST', '/api/proposals', body);
    await loadAll();
    window.__reopen = null;
    closeModal();
    render();
    toast('Proposal saved');
    if (!id && saved.proposal) {
      // Offer to open the printable version straight away.
      toast('Tip: open 🖨 to save the PDF');
    }
  } catch (e) { toast(e.message, 'err'); }
}

// ── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  const s = state.settings;
  return `
    <div class="page-head"><div><h1>Settings</h1><p>Your business details appear on every proposal.</p></div></div>
    <div class="card" style="max-width:640px">
      <label class="field"><span>Business name</span><input id="s-name" value="${esc(s.businessName)}"></label>
      <div class="row">
        <label class="field"><span>Contact name</span><input id="s-contact" value="${esc(s.contactName)}"></label>
        <label class="field"><span>Email</span><input id="s-email" value="${esc(s.email)}"></label>
      </div>
      <div class="row">
        <label class="field"><span>Phone</span><input id="s-phone" value="${esc(s.phone)}"></label>
        <label class="field"><span>Website</span><input id="s-website" value="${esc(s.website)}"></label>
      </div>
      <label class="field"><span>Logo URL</span><input id="s-logo" value="${esc(s.logoUrl)}" placeholder="https://yoursite.com/logo.png"></label>
      <div class="row">
        <label class="field"><span>Currency symbol</span><input id="s-currency" value="${esc(s.currency)}"></label>
        <label class="field"><span>Default tax / VAT (%)</span><input id="s-tax" type="number" step="0.01" value="${s.taxRate || 0}"></label>
        <label class="field"><span>Quote validity (days)</span><input id="s-validity" type="number" value="${s.validityDays || 14}"></label>
      </div>
      <label class="field"><span>Footer note on proposals</span><textarea id="s-footer">${esc(s.footerNote)}</textarea></label>
      <div class="modal-foot" style="justify-content:flex-start">
        <button class="btn primary" id="s-save">Save settings</button>
      </div>
    </div>`;
}

function bindViewEvents() {
  if (state.view === 'settings') {
    const btn = document.getElementById('s-save');
    if (btn) btn.onclick = async () => {
      const body = {
        businessName: val('s-name'), contactName: val('s-contact'), email: val('s-email'),
        phone: val('s-phone'), website: val('s-website'), logoUrl: val('s-logo'),
        currency: val('s-currency') || '₪', taxRate: val('s-tax'), validityDays: val('s-validity'),
        footerNote: val('s-footer')
      };
      try { await api('PUT', '/api/settings', body); await loadAll(); render(); toast('Settings saved'); }
      catch (e) { toast(e.message, 'err'); }
    };
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

// Expose functions used in inline handlers.
Object.assign(window, {
  switchView, openProposalBuilder, duplicateProposal, deleteProposal, filterProposals,
  openProductForm, deleteProduct, filterProducts, openImport, previewImport,
  openPackageForm, deletePackage, pkgQty, pkgRemove, pkgAddPicker,
  productPicker, renderPicker, pickProduct, reopenLast,
  builderAddProduct, builderAddPackage, builderApplyPackage, builderAddCustomLine,
  builderSetQty, builderSetUnit, builderSetName, builderRemoveItem,
  builderAddExtra, builderSetExtraLabel, builderSetExtraAmount, builderRemoveExtra,
  builderRecalc, closeModal
});

// ── Boot ─────────────────────────────────────────────────────────────────────
(async function init() {
  try { await loadAll(); render(); }
  catch (e) { document.getElementById('main').innerHTML = `<div class="empty">Could not load data: ${esc(e.message)}</div>`; }
})();
