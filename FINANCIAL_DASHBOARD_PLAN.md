# Financial Dashboard — The Plan

From expense log to full money picture. Where the project stands, what's decided,
everything not yet tackled, and the open questions that gate the build.

- **Date:** 2026-07-11
- **Branch:** `claude/financial-dashboard-plan-i4u4up`
- **Status:** Awaiting answers → build

---

## 1. Where things stand today

What exists is a solid **expense logger**: an Express server (`server.js`), a web
dashboard (`public/index.html`), and an iOS app with Siri Shortcuts for one-tap
logging. It is not yet a financial dashboard — it sees money leaving, never money
arriving or accumulating.

| Area | Today | State |
|---|---|---|
| Expense logging | Add & delete via web, iPhone Shortcut, API. Editable categories. | ✅ Working |
| Editing an entry | No update endpoint — typos mean delete and re-enter. | ⚠️ Gap |
| Income | Not tracked at all. | ⚠️ Gap |
| Savings & goals | Nothing. | ⚠️ Gap |
| Rent & recurring bills | Typed by hand monthly, or silently missing. | ⚠️ Gap |
| Budgets | No limits, no alerts. | ⚠️ Gap |
| Currency | A bare number — no currency field or conversion. | ⚠️ Gap |
| Storage | Single JSON file, rewritten fully on every save; vanishes on cloud redeploy. | 🔴 Risk |
| Security | Zero authentication on every endpoint. | 🔴 Risk |
| iOS ↔ server | iOS keeps its own local store; source of truth undefined. | 🔴 Risk |

## 2. Decisions locked (answered 2026-07-11)

| Decision | Choice |
|---|---|
| Currency | **Full multi-currency** — accounts and transactions in any currency, with rates for reporting |
| Scope | **Everything** — income, savings & goals, recurring bills & rent, per-category budgets |
| Data entry | **Manual + CSV import** — keep Shortcut & web form; add statement upload. No live bank sync for now |
| Hosting | **Cloud + real database** — deployed with a proper DB and a login |

## 3. Everything we haven't tackled

### Product — never discussed

- **Transfers are not expenses.** Moving ₪2,000 into savings isn't spending; without a
  transfer type, expense totals and savings rate are both wrong.
- **Refunds & reimbursements.** Returns, friends paying you back, work reimbursements —
  reduce the expense, count as income, or ignore?
- **Accounts as a first-class idea.** Checking, credit card, cash, savings — today it's
  one pile. Budgets, transfers, net worth, and CSV import all need to know *which account*.
- **Credit-card timing.** Card purchases hit the bank ~a month later; installments
  (תשלומים) spread over months. Show swipe date or charge date?
- **Category structure.** Flat list with overlaps ("Groceries" vs "Food & Dining" vs
  "Coffee & Drinks"). Groups? And deleting a category today orphans its expenses silently.
- **Split & shared expenses.** Mixed receipts, dinners split with friends, partner costs —
  in or out of scope?
- **Historical backfill.** Trends need history. Any past statements worth importing?
- **What the dashboard actually answers.** Proposed headline metrics: net cash flow this
  month, spend vs budget by category, savings rate, goal progress, bills due in 14 days.
- **Annual & irregular costs.** Insurance, car test, holidays, gifts — sinking funds
  ("set aside ₪X/month") are the standard fix; unplanned today.

### Technical — must be fixed under the new features

- **Open API, no auth** — unacceptable once deployed. Login + tokens on every route,
  including the iPhone Shortcut.
- **JSON file → Postgres.** Whole-file rewrite per request, no concurrency safety,
  ephemeral cloud filesystems. One-time migration of existing data.
- **Money stored as floats.** Move to integer minor-units (agorot/cents) before totals drift.
- **IDs from `Date.now()`** can collide. Switch to UUIDs.
- **Timezone handling.** Server stamps UTC — a 1:30 AM purchase in Tel Aviv lands on the
  wrong day/month. Use Asia/Jerusalem.
- **No edit endpoint, no pagination, no tests.** Add PUT/PATCH, pagination, and a test
  suite for the money math.
- **iOS sync model.** Server becomes the single source of truth; app gets an offline
  queue and the new features.
- **Backups & export.** Automatic DB backups + one-click full CSV export.

## 4. Open questions — answer these and building starts

Each has a default used if you say "go with your defaults."

### Money basics

1. **Base reporting currency?** Every chart needs one denominator.
   *Default: ILS (₪), original currency preserved per transaction.*
2. **Which currencies day to day?** Sets the quick-pick list and which rates to fetch.
   *Default: ILS + USD + EUR, daily rates stored historically.*
3. **Solo or shared with a partner?** Shared means two logins, "who paid," joint vs
   personal views. *Default: single user.*

### Income, rent & budgets

4. **What does your income look like?** Fixed salary on a known day, or irregular?
   Budget month from the 1st or from payday? *Default: one monthly salary, calendar month.*
5. **List your fixed monthly commitments.** Rent (amount + day), utilities, phone,
   subscriptions, insurance — seeded as recurring rules. *Default: ship empty, add in UI.*
6. **How should budget alerts reach you?** *Default: in-dashboard at 80%/100%;
   iOS push later.*

### Savings & goals

7. **What counts as "savings"?** Manual balance snapshots vs tracked holdings
   (pension, קרן השתלמות, brokerage, crypto) with market values.
   *Default: manual monthly snapshots per account.*
8. **What are the actual goals?** Emergency fund? Apartment? Trip? Amount + deadline each.
   *Default: one emergency-fund goal of 3× monthly expenses, auto-computed.*
9. **Should debts and loans appear?** Net worth without them is fiction if they exist.
   *Default: excluded for v1 unless you have any.*

### Import & infrastructure

10. **Which banks/cards for CSV export?** Leumi, Hapoalim, Discount, Isracard, Max, Cal…
    each format needs a parser; Israeli exports are often Hebrew/RTL/Excel.
    *Default: generic column-mapping importer with dedupe.*
11. **How do you want to log in?** *Default: email + password, separate API token for
    the Shortcut.*
12. **Preferred cloud home?** You have Vercel connected. *Default: Vercel + Neon Postgres.*

## 5. Roadmap

Each phase is shippable on its own.

### Phase 0 — Foundations: make it safe to build on
- Postgres + schema; one-time migration of existing JSON data
- Login + API tokens on every endpoint (web, API, Shortcut)
- Integer minor-units, UUIDs, Asia/Jerusalem-aware dates
- Edit endpoint, pagination, test suite for money math
- Cloud deploy; automatic backups + full CSV export

**Ships →** the current tracker, but secure, durable, and editable from anywhere.

### Phase 1 — Income, accounts & multi-currency core
- Accounts (checking / card / cash / savings) with per-account currency
- Transaction types: expense · income · transfer (transfers excluded from spend totals)
- Daily exchange rates stored historically; reporting converted to base currency
- Dashboard headline: net cash flow — in vs out vs left this month

**Ships →** "am I ahead or behind this month?" at a glance.

### Phase 2 — Recurring bills & rent
- Recurring rules (amount, cadence, day, account, category) that auto-post each cycle
- "Upcoming bills — next 14 days" panel; projected end-of-month balance
- Variable bills (electricity) post as estimates you confirm

**Ships →** rent and bills appear by themselves.

### Phase 3 — Budgets
- Monthly limit per category, optional rollover
- Pace indicators (spent vs mid-month expectation), 80%/100% alerts
- Sinking funds for annual/irregular costs

**Ships →** overspending visible while it's happening.

### Phase 4 — Savings, goals & net worth
- Balance snapshots per account; net-worth trend
- Goals with target + deadline, funded by transfers; monthly savings rate
- On-track / off-track projection per goal

**Ships →** the accumulation side of the picture.

### Phase 5 — CSV import & intelligence
- CSV/XLSX upload with column mapping, Hebrew/RTL support, dedupe
- Auto-categorization that learns from corrections (merchant → category)
- Historical backfill

**Ships →** a month of statements imported and categorized in minutes.

### Phase 6 — Polish & iOS parity
- Trends: month-over-month, category history, top merchants
- iOS app updated for income/budgets/bills; offline queue syncing to server
- Budget push notifications; monthly summary review

**Ships →** the full dashboard in your pocket.

## 6. Proposed data model

Amounts are integer minor-units; every table has a UUID + timestamps.

| Table | Purpose | Key fields |
|---|---|---|
| `users` | Login + Shortcut tokens | email, password_hash, api_token, base_currency, timezone |
| `accounts` | Checking, cards, cash, savings | name, type, currency, is_savings |
| `categories` | Grouped, safely deletable | name, group, icon, archived_at |
| `transactions` | All money movement | type (expense\|income\|transfer), amount_minor, currency, fx_rate, account_id, transfer_account_id, category_id, merchant, note, date, recurring_rule_id, import_id |
| `recurring_rules` | Rent, salary, subscriptions | cadence, day, amount_minor, is_estimate, next_run |
| `budgets` | Per category per month | category_id, month, limit_minor, rollover |
| `goals` | Targets with deadlines | name, target_minor, deadline, linked_account_id |
| `balance_snapshots` | Net-worth history | account_id, date, balance_minor |
| `exchange_rates` | Historical daily rates | date, from_ccy, to_ccy, rate |
| `imports` | CSV upload audit + undo | filename, source, row_count, created_at |

---

**Next step:** answer the twelve questions above — or say "go with your defaults" —
and Phase 0 starts immediately.
