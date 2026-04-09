const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'expenses.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory and file exist
function ensureDataFile() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      categories: [
        "Food & Dining",
        "Transport",
        "Shopping",
        "Entertainment",
        "Health & Fitness",
        "Bills & Utilities",
        "Travel",
        "Groceries",
        "Coffee & Drinks",
        "Other"
      ],
      expenses: []
    }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Categories ─────────────────────────────────────────────────────────────

// GET /api/categories — list all categories
app.get('/api/categories', (req, res) => {
  const data = readData();
  res.json({ categories: data.categories });
});

// POST /api/categories — add a new category
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  const data = readData();
  const trimmed = name.trim();
  if (data.categories.includes(trimmed)) {
    return res.status(409).json({ error: 'Category already exists' });
  }
  data.categories.push(trimmed);
  writeData(data);
  res.status(201).json({ category: trimmed, categories: data.categories });
});

// DELETE /api/categories/:name — remove a category
app.delete('/api/categories/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const data = readData();
  const index = data.categories.indexOf(name);
  if (index === -1) return res.status(404).json({ error: 'Category not found' });
  data.categories.splice(index, 1);
  writeData(data);
  res.json({ categories: data.categories });
});

// ── Expenses ────────────────────────────────────────────────────────────────

// GET /api/expenses — list expenses (optional ?category=X&limit=N&month=YYYY-MM)
app.get('/api/expenses', (req, res) => {
  const data = readData();
  let expenses = [...data.expenses].reverse(); // newest first

  if (req.query.category) {
    expenses = expenses.filter(e => e.category === req.query.category);
  }
  if (req.query.month) {
    expenses = expenses.filter(e => e.date && e.date.startsWith(req.query.month));
  }
  if (req.query.limit) {
    expenses = expenses.slice(0, parseInt(req.query.limit, 10));
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  res.json({ expenses, total: parseFloat(total.toFixed(2)), count: expenses.length });
});

// POST /api/expenses — add a new expense (called by iPhone Shortcut)
// Body: { amount, category, note?, merchant?, date? }
app.post('/api/expenses', (req, res) => {
  const { amount, category, note, merchant, date } = req.body;

  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }
  if (!category || typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ error: 'Category is required' });
  }

  const data = readData();
  const expense = {
    id: Date.now().toString(),
    amount: parseFloat(parseFloat(amount).toFixed(2)),
    category: category.trim(),
    note: note ? note.trim() : '',
    merchant: merchant ? merchant.trim() : '',
    date: date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };

  data.expenses.push(expense);
  writeData(data);

  res.status(201).json({
    message: 'Expense added successfully',
    expense
  });
});

// DELETE /api/expenses/:id — remove an expense
app.delete('/api/expenses/:id', (req, res) => {
  const data = readData();
  const index = data.expenses.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Expense not found' });
  data.expenses.splice(index, 1);
  writeData(data);
  res.json({ message: 'Expense deleted' });
});

// GET /api/summary — spending summary by category
app.get('/api/summary', (req, res) => {
  const data = readData();
  let expenses = data.expenses;

  if (req.query.month) {
    expenses = expenses.filter(e => e.date && e.date.startsWith(req.query.month));
  }

  const summary = {};
  expenses.forEach(e => {
    if (!summary[e.category]) summary[e.category] = 0;
    summary[e.category] = parseFloat((summary[e.category] + e.amount).toFixed(2));
  });

  const total = Object.values(summary).reduce((s, v) => s + v, 0);
  res.json({ summary, total: parseFloat(total.toFixed(2)) });
});

app.listen(PORT, () => {
  console.log(`New Era Expense Tracker running on http://localhost:${PORT}`);
  ensureDataFile();
});
