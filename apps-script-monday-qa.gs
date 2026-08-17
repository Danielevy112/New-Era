/**
 * Variant — Experiment QA wizard backend (v2 — checklist wizard).
 * Receives JSON from the HTML wizard and creates a row on the Monday board.
 *
 * Deploy: Apps Script → Deploy → New deployment → "Web app"
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Then copy the /exec URL and paste it into ENDPOINT in experiment-qa-checklist.html.
 *
 * Before deploying, set the Monday API token via:
 *   Project Settings → Script Properties → Add property
 *     name:  MONDAY_TOKEN
 *     value: <your monday personal API token>
 *
 * Get a token at: https://variantnow-company.monday.com/admin/integrations/api
 */

const BOARD_ID = 5088942350;
const MONDAY_API = "https://api.monday.com/v2";

/* ---------- field mappings ---------- */

// Column IDs on the board — keep in sync if you ever rename/recreate columns
const COL = {
  overallStatus: "color_mm3ssdz9",
  type:          "single_selectbxnam5t",
  experimentId:  "short_text9n3ths6b",
  url:           "link_mm3s6fhk",
  client:        "dropdown_mm3wfz7v",
  runsOn:        "single_selectwfp7noq",
  pages:         "multi_select174bl1y3",
  csmPeople:     "multiple_person_mm3semb5",
  submittedBy:   "text_mm3wwbv3",
  notes:         "long_text_mm3w78w1",
  dateNotified:  "date_mm3s1g3m",

  variantConfig: "color_mm3s27db",
  overrideHeader:"color_mm3sgttx",
  iphoneSE:      "color_mm3sjrge",
  iphone12:      "color_mm3s39xz",
  samsung:       "color_mm3sy509",
  desktop:       "color_mm3se3br",
  atc:           "color_mm3snbkc",
  checkout:      "color_mm3sq89x",
  pageTypes:     "color_mm3sg0qx",
  refresh5:      "color_mm3ss97a",
  openClose5:    "color_mm3ske7j",
  addRemove:     "color_mm3s10ab",
  debug1:        "color_mm3smxkx",
  organic:       "color_mm3seswm",
  atcLive:       "color_mm3sehvt",
  checkoutLive:  "color_mm3sr022",
  notified:      "color_mm3szx98",
};

// CSM display name -> Monday user ID
const CSM_USERS = {
  "Daniel Levy":  94349254,
  "Bar Karako":   101803411,
  "Ben Segal":    93922156,
  "Izzy Schack":  103588576,
  "Ilan Kogan":   93922067,
};

// Wizard "Runs on" -> Monday status label
const RUNS_ON = {
  "Mobile":  "Mobile Only",
  "Desktop": "Desktop Only",
  "Both":    "Both",
};

// Wizard page value -> Monday dropdown label
const PAGES = {
  "Home":       "Home Page",
  "Product":    "Product Page",
  "Collection": "Collection Page",
  "Menu":       "Menu",
  "Cart":       "Cart",
  "All over":   "All Over (Banner / Header / Etc.)",
  "Pop-up":     "Pop-up",
  "Other":      "Other",
};

// Wizard yes/no field ID -> Monday status column of the same key.
// v2 wizard sends: variantConfig, overrideHeader, atc, checkout, refresh5 (essentials)
// + debug1, organic, notified (post-launch). Device/legacy columns stay empty.
const YN_COLUMNS = [
  "variantConfig","overrideHeader","atc","checkout","refresh5",
  "debug1","organic","notified",
];

/* ---------- HTTP handlers ---------- */

function doGet(e) {
  // ?action=clients -> live customer list from HubSpot (for the wizard's Refresh button)
  const action = e && e.parameter && e.parameter.action;
  if (action === "clients") {
    try {
      const fresh = e.parameter.fresh === "1";
      return jsonResponse({ ok: true, clients: getHubspotCustomers(fresh) });
    } catch (err) {
      return jsonResponse({ ok: false, error: String(err && err.message || err) });
    }
  }
  // sanity check in browser — visiting the /exec URL shows this
  return jsonResponse({ ok: true, message: "Variant QA backend is live. POST JSON to create items." });
}

// Live customer list from HubSpot (companies with lifecyclestage = customer).
// Cached 6h in CacheService; pass fresh=1 to bypass. Needs a HUBSPOT_TOKEN script property
// (Private App token, scope crm.objects.companies.read) — same place as MONDAY_TOKEN.
function getHubspotCustomers(forceFresh) {
  const cache = CacheService.getScriptCache();
  if (!forceFresh) {
    const hit = cache.get("hs_customers");
    if (hit) return JSON.parse(hit);
  }
  const token = PropertiesService.getScriptProperties().getProperty("HUBSPOT_TOKEN");
  if (!token) throw new Error("HUBSPOT_TOKEN not set");

  const names = [];
  let after = null;
  do {
    const body = {
      filterGroups: [{ filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: "customer" }] }],
      properties: ["name"],
      limit: 100,
    };
    if (after) body.after = after;
    const res = UrlFetchApp.fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
    const json = JSON.parse(res.getContentText());
    if (json.status === "error") throw new Error("HubSpot: " + (json.message || res.getContentText()));
    (json.results || []).forEach(r => {
      const n = r.properties && r.properties.name;
      if (n && n.trim()) names.push(n.trim());
    });
    after = json.paging && json.paging.next && json.paging.next.after;
  } while (after);

  const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  cache.put("hs_customers", JSON.stringify(unique), 21600);
  return unique;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const result = createMondayItem(body);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- core logic ---------- */

function createMondayItem(a) {
  const token = PropertiesService.getScriptProperties().getProperty("MONDAY_TOKEN");
  if (!token) throw new Error("MONDAY_TOKEN script property is not set");

  // Post-launch mode: complete the EXISTING pre-launch row for this experiment ID
  // instead of creating a duplicate. Falls back to create if none is found.
  if (a.mode === "postlaunch" && a.experimentId) {
    const existingId = findItemIdByExperimentId(token, a.experimentId);
    if (existingId) {
      const cv = buildPostLaunchColumns(a);
      changeColumns(token, existingId, cv);
      postUpdate(existingId, token, buildSummary(a));  // appends the post-launch recap
      return {
        itemId: existingId,
        updated: true,
        url: `https://variantnow-company.monday.com/boards/${BOARD_ID}/pulses/${existingId}`,
      };
    }
    // no existing row — fall through and create a fresh one
  }

  // Wizard sends test = "<client> — <experiment ID>" (no test-name question in v2)
  const itemName = (a.test || "Untitled test").slice(0, 250);
  const cv = buildColumnValues(a);

  const query = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
        id
      }
    }
  `;

  const res = UrlFetchApp.fetch(MONDAY_API, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: token },
    payload: JSON.stringify({
      query,
      variables: {
        boardId: String(BOARD_ID),
        itemName,
        columnValues: JSON.stringify(cv),
      },
    }),
    muteHttpExceptions: true,
  });

  const json = JSON.parse(res.getContentText());
  if (json.errors && json.errors.length) {
    throw new Error("Monday API: " + JSON.stringify(json.errors));
  }
  const itemId = json && json.data && json.data.create_item && json.data.create_item.id;
  if (!itemId) throw new Error("Monday API returned no item id: " + res.getContentText());

  // Optional: post a friendly Update with the human-readable summary
  if (a.notes || hasAnyAnswers(a)) postUpdate(itemId, token, buildSummary(a));

  return {
    itemId,
    url: `https://variantnow-company.monday.com/boards/${BOARD_ID}/pulses/${itemId}`,
  };
}

// Find the most recent item whose Experiment ID column contains the given id.
function findItemIdByExperimentId(token, expId) {
  const query = `query ($boardId: ID!, $colId: String!, $val: String!) {
    boards(ids: [$boardId]) {
      items_page(limit: 25, query_params: {
        rules: [{ column_id: $colId, compare_value: $val, operator: contains_text }]
      }) {
        items { id }
      }
    }
  }`;
  const res = UrlFetchApp.fetch(MONDAY_API, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: token },
    payload: JSON.stringify({ query, variables: {
      boardId: String(BOARD_ID), colId: COL.experimentId, val: String(expId),
    }}),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  const items = json && json.data && json.data.boards && json.data.boards[0] &&
    json.data.boards[0].items_page && json.data.boards[0].items_page.items;
  // Prefer the highest id (most recently created) if there are several
  if (items && items.length) {
    return items.map(i => i.id).sort((x, y) => Number(y) - Number(x))[0];
  }
  return null;
}

function changeColumns(token, itemId, cv) {
  const query = `mutation ($boardId: ID!, $itemId: ID!, $cols: JSON!) {
    change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $cols, create_labels_if_missing: true) { id }
  }`;
  const res = UrlFetchApp.fetch(MONDAY_API, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: token },
    payload: JSON.stringify({ query, variables: {
      boardId: String(BOARD_ID), itemId: String(itemId), cols: JSON.stringify(cv),
    }}),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  if (json.errors && json.errors.length) {
    throw new Error("Monday API (update): " + JSON.stringify(json.errors));
  }
  return json;
}

// Columns updated when COMPLETING a row in post-launch mode.
// Deliberately does NOT touch the Notes column (keeps the pre-launch recap);
// the post-launch recap goes into the Update thread instead.
function buildPostLaunchColumns(a) {
  const cv = {};
  const anyNo = ["debug1","organic","liveAtcCheckout","notified"].some(k => a[k] === "No");
  cv[COL.overallStatus] = { label: anyNo ? "Issues found" : "Live" };

  ["debug1","organic","notified"].forEach(k => {
    if (a[k] === "Yes" || a[k] === "No") cv[COL[k]] = { label: a[k] };
  });
  if (a.liveAtcCheckout === "Yes" || a.liveAtcCheckout === "No") {
    cv[COL.atcLive] = { label: a.liveAtcCheckout };
    cv[COL.checkoutLive] = { label: a.liveAtcCheckout };
  }
  if (a.notified === "Yes") cv[COL.dateNotified] = { date: isoToday() };
  return cv;
}

function isoToday() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

// All check field ids the wizard can send (essentials + per-page + post-launch).
// Used to derive the verdict server-side, independent of the client.
function allCheckKeys(a) {
  const keys = ["variantConfig","overrideHeader","atc","checkout","refresh5","clickDest","consoleErrors",
                "debug1","organic","liveAtcCheckout","notified"];
  Object.keys(a || {}).forEach(k => {
    if (/^(home|prod|col|menu|cart|ao|pop|oth|dm|dd)_/.test(k) && !/__(note|evidence)$/.test(k)) keys.push(k);
  });
  return keys;
}

function buildColumnValues(a) {
  const cv = {};

  // Auto-verdict: any check marked "No" => Issues found. Else Live if a post-launch
  // check was done, else Pre-launch QA. (Client also sends a.verdict as a cross-check.)
  const anyNo = allCheckKeys(a).some(k => a[k] === "No") || a.verdict === "Issues found";
  const postLaunchAnswered = ["debug1","organic","liveAtcCheckout","notified"]
    .some(k => a[k] === "Yes");
  cv[COL.overallStatus] = { label: anyNo ? "Issues found" : (postLaunchAnswered ? "Live" : "Pre-launch QA") };

  if (a.url) cv[COL.url] = { url: a.url, text: a.url };
  if (a.client) cv[COL.client] = { labels: [a.client] };
  if (a.type === "Experiment" || a.type === "Experience") {
    cv[COL.type] = { label: a.type };
  }
  if (a.experimentId) cv[COL.experimentId] = a.experimentId;

  if (a.runsOn && RUNS_ON[a.runsOn]) {
    cv[COL.runsOn] = { label: RUNS_ON[a.runsOn] };
  }

  // Auto-fill Date client notified when notified=Yes
  if (a.notified === "Yes") {
    const d = new Date();
    const iso = d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
    cv[COL.dateNotified] = { date: iso };
  }

  if (Array.isArray(a.pages) && a.pages.length) {
    cv[COL.pages] = { labels: a.pages.map(p => PAGES[p] || p) };
  }

  if (a.csm) {
    cv[COL.submittedBy] = a.csm;
    const uid = CSM_USERS[a.csm];
    if (uid) {
      cv[COL.csmPeople] = { personsAndTeams: [{ id: uid, kind: "person" }] };
    }
  }

  // Write the FULL recap into the Notes column so the row itself is readable
  // (the same recap also goes into the Update thread). User notes are included.
  cv[COL.notes] = { text: buildSummary(a).replace(/<\/?b>/g, "") };

  // Yes / No status checks (skip N/A — leaves the cell empty)
  YN_COLUMNS.forEach(k => {
    if (a[k] === "Yes" || a[k] === "No") {
      cv[COL[k]] = { label: a[k] };
    }
  });

  // v2 merges "ATC live" + "Checkout live" into one wizard row — fill both columns
  if (a.liveAtcCheckout === "Yes" || a.liveAtcCheckout === "No") {
    cv[COL.atcLive] = { label: a.liveAtcCheckout };
    cv[COL.checkoutLive] = { label: a.liveAtcCheckout };
  }

  return cv;
}

function postUpdate(itemId, token, body) {
  const query = `mutation ($itemId: ID!, $body: String!) {
    create_update(item_id: $itemId, body: $body) { id }
  }`;
  UrlFetchApp.fetch(MONDAY_API, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: token },
    payload: JSON.stringify({ query, variables: { itemId: String(itemId), body } }),
    muteHttpExceptions: true,
  });
}

function hasAnyAnswers(a) {
  // Any yes/no answered anywhere in the wizard
  return Object.values(a || {}).some(v => v === "Yes" || v === "No" || v === "N/A");
}

/* ---------- summary (mirrors the v2 wizard check definitions) ---------- */

function buildSummary(a) {
  // The wizard sends a fully-rendered recap (single source of truth). Use it verbatim
  // so the board always matches the form. The block below is a legacy fallback only.
  if (a.recap && String(a.recap).trim()) return String(a.recap);

  // A yes/no line, with the CSM's follow-up comment / evidence indented beneath it.
  const yn = (label, id) => {
    if (!a[id]) return null;
    let line = `${a[id] === "Yes" ? "✅" : a[id] === "No" ? "❌" : "➖"} ${label}`;
    if (a[id] === "No" && a[id + "__note"]) line += `\n   ↳ ${a[id + "__note"]}`;
    if (a[id] === "Yes" && a[id + "__evidence"]) line += `\n   ↳ ${a[id + "__evidence"]}`;
    return line;
  };
  const section = (title, items) => {
    const filled = items.map(([id, lbl]) => yn(lbl, id)).filter(Boolean);
    return filled.length ? ["", title, ...filled] : [];
  };
  // Expand [key, label] rows into 📱 mobile + 🖥 desktop entries
  const perDevice = (key, rows) => {
    const out = [];
    ["m", "d"].forEach(dev => {
      const icon = dev === "m" ? "📱" : "🖥";
      rows.forEach(([k, lbl]) => out.push([`${key}_${dev}_${k}`, `${icon} ${lbl}`]));
    });
    return out;
  };

  const anyNo = allCheckKeys(a).some(k => a[k] === "No") || a.verdict === "Issues found";
  const out = [];
  out.push(anyNo ? "<b>VERDICT: ⚠️ Issues found</b>" : "<b>VERDICT: ✅ Passed</b>");
  out.push(`Mode: ${a.mode === "postlaunch" ? "Post-launch" : "Pre-launch"}`);
  if (a.experimentId) out.push(`ID: ${a.experimentId}`);
  if (a.client) out.push(`Client: ${a.client}`);
  out.push(`Type: ${a.type || "—"} · CSM: ${a.csm || "—"} · Device: ${a.runsOn || "—"} · Pages: ${(a.pages || []).join(", ") || "—"}`);
  const isExp = a.type === "Experience";
  if (a.otherDesc) out.push(`Other: ${a.otherDesc}`);
  if (a.durationSec != null) {
    const m = Math.floor(a.durationSec / 60), s = a.durationSec % 60;
    out.push(`Time: ${m ? m + "m " : ""}${s}s${a.fast ? "  ⚠ fast — worth a spot-check" : ""}`);
  }

  out.push(...section("✅ Essentials:", [
    ["variantConfig","Variant platform config correct"],
    ["overrideHeader","Header / menu / cart / search intact"],
    ["atc","Add to Cart works"],
    ["checkout","Cart → Checkout works"],
    ["refresh5", isExp ? "Refresh — loads cleanly, no flicker" : "Refresh — same variant, no flicker"],
    ["clickDest","Click destinations correct"],
  ]));

  out.push(...section("🏠 Home:", perDevice("home", [
    ["hero","Hero + CTAs correct"],
    ["carousel","Carousels / sliders work"],
    ["banners","Banners & category tiles correct"],
    ["floating","Floating elements OK"],
    ["layout","No horizontal scroll / layout jump"],
  ])));

  out.push(...section("🛍 Product:", perDevice("prod", [
    ["variants","Variant switching — image & price update"],
    ["soldOut","Sold-out renders"],
    ["atc","ATC → drawer; remove & re-add works"],
    ["upsells","Upsells addable"],
    ["gallery","Image gallery works"],
  ])));

  out.push(...section("🗂 Collection:", perDevice("col", [
    ["filters","Filters & sort work"],
    ["pagination","Pagination / infinite scroll works"],
    ["cards","Product cards OK (swatches, sold-out)"],
    ["quickView","Quick-view modal works"],
  ])));

  out.push(...section("📂 Mobile menu:", [
    ["menu_m_open","📱 Opens/closes — on top, scroll locks"],
    ["menu_m_links","📱 Links & sub-menus correct"],
    ["menu_m_icons","📱 Inner icons work"],
    ["menu_m_fit","📱 Fits viewport, scrolls on overflow"],
  ]));

  out.push(...section("🛒 Cart:", perDevice("cart", [
    ["items","Line items, remove & qty → totals correct"],
    ["promo", isExp ? "Promo works" : "Promo works on control + every variant"],
    ["shipBar","Free-shipping bar accurate"],
    ["empty","Empty cart renders"],
    ["drawer","Drawer opens/closes"],
  ])));

  out.push(...section("🌐 All over:", perDevice("ao", [
    ["shows","Shows on every relevant page"],
    ["layout","Layouts intact everywhere"],
    ["dismiss","Dismiss works + stays dismissed"],
    ["zindex","Z-index OK; CTA correct"],
  ])));

  out.push(...section("🎯 Pop-up:", perDevice("pop", [
    ["trigger","Triggers correctly"],
    ["close","Close works + stays closed"],
    ["conflict","No pop-up collisions"],
    ["form","Form submits"],
    ["block","Doesn't block ATC / checkout"],
  ])));

  out.push(...section("✍️ Other:", [
    ["oth_works","Works end-to-end as specced"],
    ["oth_break","Doesn't break surrounding UI"],
  ]));

  out.push(...section("🚀 After launch:", [
    ["debug1", isExp ? "Previewed before 100% deploy" : "?debug=1 verified"],
    ["organic", isExp ? "Renders for a normal visitor" : "Renders organically"],
    ["liveAtcCheckout","ATC + Checkout re-tested live"],
    ["notified","Client notified"],
  ]));

  if (a.notes && a.notes.trim()) {
    out.push("");
    out.push("Notes:");
    out.push(a.notes.trim());
  }
  return out.join("\n");
}
