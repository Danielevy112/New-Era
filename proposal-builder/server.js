const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
const DATA_FILE = path.join(__dirname, 'data', 'store.json');

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Data store ───────────────────────────────────────────────────────────────

const DEFAULT_DATA = {
  settings: {
    businessName: 'Your Company',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    logoUrl: '',
    currency: '₪',
    taxRate: 0,           // percent, e.g. 17 for Israeli VAT. 0 = no tax line.
    validityDays: 14,
    footerNote: 'Thank you for your business. Prices are valid for the period stated above.'
  },
  products: [],
  packages: [],
  proposals: []
};

function ensureDataFile() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  // Fill in any missing top-level keys for forward compatibility.
  return {
    settings: { ...DEFAULT_DATA.settings, ...(data.settings || {}) },
    products: data.products || [],
    packages: data.packages || [],
    proposals: data.proposals || []
  };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  res.json(readData().settings);
});

app.put('/api/settings', (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  // Coerce numeric fields.
  data.settings.taxRate = Number(data.settings.taxRate) || 0;
  data.settings.validityDays = Number(data.settings.validityDays) || 0;
  writeData(data);
  res.json(data.settings);
});

// ── Products ─────────────────────────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  const data = readData();
  let products = [...data.products];
  if (req.query.q) {
    const q = req.query.q.toLowerCase();
    products = products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }
  if (req.query.category) {
    products = products.filter(p => p.category === req.query.category);
  }
  res.json({ products, count: products.length });
});

function sanitizeProduct(body) {
  return {
    name: (body.name || '').trim(),
    sku: (body.sku || '').trim(),
    category: (body.category || '').trim(),
    description: (body.description || '').trim(),
    price: round2(parseFloat(body.price) || 0),
    imageUrl: (body.imageUrl || '').trim()
  };
}

app.post('/api/products', (req, res) => {
  if (!req.body.name || !req.body.name.trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const data = readData();
  const product = {
    id: newId('prod'),
    ...sanitizeProduct(req.body),
    createdAt: new Date().toISOString()
  };
  data.products.push(product);
  writeData(data);
  res.status(201).json({ product });
});

app.put('/api/products/:id', (req, res) => {
  const data = readData();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  Object.assign(product, sanitizeProduct({ ...product, ...req.body }));
  product.updatedAt = new Date().toISOString();
  writeData(data);
  res.json({ product });
});

app.delete('/api/products/:id', (req, res) => {
  const data = readData();
  const index = data.products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  data.products.splice(index, 1);
  writeData(data);
  res.json({ ok: true });
});

// POST /api/products/import — bulk import from parsed rows.
// Body: { rows: [{ name, sku, category, description, price, imageUrl }], mode }
// mode: 'append' (default) or 'replace'
app.post('/api/products/import', (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No rows to import' });
  const data = readData();
  if (req.body.mode === 'replace') data.products = [];

  let imported = 0;
  let updated = 0;
  for (const row of rows) {
    const clean = sanitizeProduct(row);
    if (!clean.name) continue;
    // Match by SKU when present, else by name, to update instead of duplicate.
    const existing = data.products.find(p =>
      (clean.sku && p.sku && p.sku.toLowerCase() === clean.sku.toLowerCase()) ||
      (!clean.sku && p.name.toLowerCase() === clean.name.toLowerCase())
    );
    if (existing) {
      Object.assign(existing, clean, { updatedAt: new Date().toISOString() });
      updated++;
    } else {
      data.products.push({ id: newId('prod'), ...clean, createdAt: new Date().toISOString() });
      imported++;
    }
  }
  writeData(data);
  res.json({ imported, updated, total: data.products.length });
});

// ── Packages (reusable bundles) ──────────────────────────────────────────────

app.get('/api/packages', (req, res) => {
  res.json({ packages: readData().packages });
});

function sanitizePackage(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  return {
    name: (body.name || '').trim(),
    description: (body.description || '').trim(),
    items: items
      .filter(i => i.productId)
      .map(i => ({ productId: i.productId, quantity: Math.max(1, parseInt(i.quantity, 10) || 1) }))
  };
}

app.post('/api/packages', (req, res) => {
  if (!req.body.name || !req.body.name.trim()) {
    return res.status(400).json({ error: 'Package name is required' });
  }
  const data = readData();
  const pkg = { id: newId('pkg'), ...sanitizePackage(req.body), createdAt: new Date().toISOString() };
  data.packages.push(pkg);
  writeData(data);
  res.status(201).json({ package: pkg });
});

app.put('/api/packages/:id', (req, res) => {
  const data = readData();
  const pkg = data.packages.find(p => p.id === req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  Object.assign(pkg, sanitizePackage({ ...pkg, ...req.body }));
  pkg.updatedAt = new Date().toISOString();
  writeData(data);
  res.json({ package: pkg });
});

app.delete('/api/packages/:id', (req, res) => {
  const data = readData();
  const index = data.packages.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Package not found' });
  data.packages.splice(index, 1);
  writeData(data);
  res.json({ ok: true });
});

// ── Proposal calculation ─────────────────────────────────────────────────────
// Given raw line items and a product catalog, resolve current prices and totals.
// Line items are stored with a price snapshot so historic proposals stay stable,
// but the builder always pulls fresh prices from the catalog when composing.

function computeProposal(proposal, products) {
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  const lineItems = (proposal.lineItems || []).map(li => {
    const product = li.productId ? productMap[li.productId] : null;
    // Prefer an explicit price on the line; otherwise use catalog price.
    const unitPrice = li.unitPrice != null && li.unitPrice !== ''
      ? round2(parseFloat(li.unitPrice) || 0)
      : (product ? round2(product.price) : 0);
    const quantity = Math.max(1, parseInt(li.quantity, 10) || 1);
    return {
      productId: li.productId || null,
      name: li.name || (product ? product.name : 'Item'),
      description: li.description || (product ? product.description : ''),
      imageUrl: li.imageUrl || (product ? product.imageUrl : ''),
      sku: li.sku || (product ? product.sku : ''),
      unitPrice,
      quantity,
      lineTotal: round2(unitPrice * quantity)
    };
  });

  const extras = (proposal.extras || []).map(e => ({
    label: (e.label || 'Extra').trim(),
    amount: round2(parseFloat(e.amount) || 0)
  }));

  const itemsSubtotal = round2(lineItems.reduce((s, li) => s + li.lineTotal, 0));
  const extrasSubtotal = round2(extras.reduce((s, e) => s + e.amount, 0));
  const subtotal = round2(itemsSubtotal + extrasSubtotal);

  const discount = proposal.discount || { type: 'none', value: 0 };
  let discountAmount = 0;
  if (discount.type === 'percent') discountAmount = round2(subtotal * (parseFloat(discount.value) || 0) / 100);
  else if (discount.type === 'fixed') discountAmount = round2(parseFloat(discount.value) || 0);
  discountAmount = Math.min(discountAmount, subtotal);

  const afterDiscount = round2(subtotal - discountAmount);
  const taxRate = parseFloat(proposal.taxRate) || 0;
  const taxAmount = round2(afterDiscount * taxRate / 100);
  const grandTotal = round2(afterDiscount + taxAmount);

  return {
    ...proposal,
    lineItems,
    extras,
    totals: {
      itemsSubtotal,
      extrasSubtotal,
      subtotal,
      discountAmount,
      afterDiscount,
      taxRate,
      taxAmount,
      grandTotal
    }
  };
}

// ── Proposals ────────────────────────────────────────────────────────────────

const PROPOSAL_STATUSES = ['draft', 'sent', 'accepted', 'declined'];

app.get('/api/proposals', (req, res) => {
  const data = readData();
  let proposals = [...data.proposals].reverse(); // newest first
  if (req.query.status) proposals = proposals.filter(p => p.status === req.query.status);
  if (req.query.q) {
    const q = req.query.q.toLowerCase();
    proposals = proposals.filter(p =>
      (p.companyName || '').toLowerCase().includes(q) ||
      (p.contactName || '').toLowerCase().includes(q) ||
      (p.title || '').toLowerCase().includes(q)
    );
  }
  const enriched = proposals.map(p => computeProposal(p, data.products));
  res.json({ proposals: enriched, count: enriched.length });
});

app.get('/api/proposals/:id', (req, res) => {
  const data = readData();
  const proposal = data.proposals.find(p => p.id === req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  res.json({ proposal: computeProposal(proposal, data.products), settings: data.settings });
});

function sanitizeProposal(body, data) {
  const status = PROPOSAL_STATUSES.includes(body.status) ? body.status : 'draft';
  const discount = body.discount && ['percent', 'fixed', 'none'].includes(body.discount.type)
    ? { type: body.discount.type, value: parseFloat(body.discount.value) || 0 }
    : { type: 'none', value: 0 };
  return {
    title: (body.title || '').trim() || 'Gift Package Proposal',
    companyName: (body.companyName || '').trim(),
    contactName: (body.contactName || '').trim(),
    contactEmail: (body.contactEmail || '').trim(),
    contactPhone: (body.contactPhone || '').trim(),
    notes: (body.notes || '').trim(),
    status,
    lineItems: Array.isArray(body.lineItems) ? body.lineItems : [],
    extras: Array.isArray(body.extras) ? body.extras : [],
    discount,
    taxRate: body.taxRate != null ? (parseFloat(body.taxRate) || 0) : (data.settings.taxRate || 0)
  };
}

app.post('/api/proposals', (req, res) => {
  const data = readData();
  const now = new Date().toISOString();
  const seq = data.proposals.length + 1;
  const proposal = {
    id: newId('prop'),
    number: `P-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`,
    ...sanitizeProposal(req.body, data),
    createdAt: now,
    updatedAt: now
  };
  data.proposals.push(proposal);
  writeData(data);
  res.status(201).json({ proposal: computeProposal(proposal, data.products) });
});

app.put('/api/proposals/:id', (req, res) => {
  const data = readData();
  const proposal = data.proposals.find(p => p.id === req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  Object.assign(proposal, sanitizeProposal({ ...proposal, ...req.body }, data));
  proposal.updatedAt = new Date().toISOString();
  writeData(data);
  res.json({ proposal: computeProposal(proposal, data.products) });
});

// PATCH-style quick status change.
app.put('/api/proposals/:id/status', (req, res) => {
  const data = readData();
  const proposal = data.proposals.find(p => p.id === req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  if (!PROPOSAL_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  proposal.status = req.body.status;
  proposal.updatedAt = new Date().toISOString();
  writeData(data);
  res.json({ proposal: computeProposal(proposal, data.products) });
});

// Duplicate a proposal (e.g. reuse for another company).
app.post('/api/proposals/:id/duplicate', (req, res) => {
  const data = readData();
  const source = data.proposals.find(p => p.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'Proposal not found' });
  const now = new Date().toISOString();
  const seq = data.proposals.length + 1;
  const copy = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId('prop'),
    number: `P-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`,
    title: source.title + ' (copy)',
    status: 'draft',
    createdAt: now,
    updatedAt: now
  };
  data.proposals.push(copy);
  writeData(data);
  res.status(201).json({ proposal: computeProposal(copy, data.products) });
});

app.delete('/api/proposals/:id', (req, res) => {
  const data = readData();
  const index = data.proposals.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Proposal not found' });
  data.proposals.splice(index, 1);
  writeData(data);
  res.json({ ok: true });
});

// ── Dashboard summary ────────────────────────────────────────────────────────

app.get('/api/summary', (req, res) => {
  const data = readData();
  const byStatus = { draft: 0, sent: 0, accepted: 0, declined: 0 };
  let pipelineValue = 0;
  let acceptedValue = 0;
  data.proposals.forEach(p => {
    const computed = computeProposal(p, data.products);
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    if (p.status === 'sent') pipelineValue += computed.totals.grandTotal;
    if (p.status === 'accepted') acceptedValue += computed.totals.grandTotal;
  });
  res.json({
    products: data.products.length,
    packages: data.packages.length,
    proposals: data.proposals.length,
    byStatus,
    pipelineValue: round2(pipelineValue),
    acceptedValue: round2(acceptedValue),
    currency: data.settings.currency
  });
});

// Printable / PDF-ready proposal view.
app.get('/proposal/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'proposal.html'));
});

app.listen(PORT, () => {
  ensureDataFile();
  console.log(`New Era Proposal Builder running on http://localhost:${PORT}`);
});
