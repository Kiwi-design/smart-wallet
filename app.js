// -------------------- CONFIG --------------------
const SUPABASE_URL = "https://iwqmmxgansutrjbegqva.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cW1teGdhbnN1dHJqYmVncXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjU2NzcsImV4cCI6MjA4NzI0MTY3N30.lLjygPN2qDnHeDh9ZlZnu2_DisFWlV_qEm16bv85qXs";

// EODHD
const EODHD_API_TOKEN = "6996bda2b9d900.81666647";
const EODHD_BASE = "https://eodhd.com/api";

const TX_TABLE = "financial_transactions";

// -------------------- DOM --------------------
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const statusEl = document.getElementById("status");

const signupTab = document.getElementById("signupTab");
const authForm = document.getElementById("authForm");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const menuToggle = document.getElementById("menuToggle");
const menuPanel = document.getElementById("menuPanel");
const menuItems = document.querySelectorAll(".menu-item");
const pageTitle = document.getElementById("pageTitle");
const pageBody = document.getElementById("pageBody");
const logoutBtn = document.getElementById("logoutBtn");

// -------------------- UI helpers --------------------
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status show ${type}`;
}
function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status";
}
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  logoutBtn.disabled = isLoading;
}
function showAuthView() {
  authView.classList.add("show");
  appView.classList.remove("show");
}
function showAppView() {
  authView.classList.remove("show");
  appView.classList.add("show");
}
function closeMenu() {
  menuPanel.classList.remove("show");
  menuToggle.setAttribute("aria-expanded", "false");
}
function openMenu() {
  menuPanel.classList.add("show");
  menuToggle.setAttribute("aria-expanded", "true");
}
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// -------------------- Supabase client hardening --------------------
if (!window.supabase || typeof window.supabase.createClient !== "function") {
  setStatus("Supabase library did not load. Check the UMD script tag.", "error");
  throw new Error("Supabase library missing.");
}

// Force apikey headers (defensive; you already needed this)
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  if (!headers.has("apikey")) headers.set("apikey", SUPABASE_ANON_KEY);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  return originalFetch(input, { ...init, headers });
};

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  },
});

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

function clearAuthStorage() {
  try {
    const projectPrefix = `sb-${projectRef}-`;

    for (const storage of [window.localStorage, window.sessionStorage]) {
      let len;
      try {
        len = storage.length;
      } catch {
        continue; // storage access blocked
      }

      const keysToRemove = [];
      for (let i = 0; i < len; i += 1) {
        const key = storage.key(i);
        if (key && (key === "supabase.auth.token" || key.startsWith(projectPrefix))) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) storage.removeItem(key);
    }
  } catch {
    // If storage is blocked, do nothing (don’t break login).
  }
}

// -------------------- Auth --------------------
let mode = "login";

function setMode(nextMode) {
  mode = nextMode;
  const isLogin = mode === "login";
  signupTab.classList.toggle("active", !isLogin);
  signupTab.textContent = isLogin ? "Sign up" : "Back to login";
  submitBtn.textContent = isLogin ? "Login" : "Sign up";
  passwordInput.autocomplete = isLogin ? "current-password" : "new-password";
  clearStatus();
}

async function refreshSession() {
  const { data, error } = await client.auth.getSession();
  if (error) {
    setStatus(error.message, "error");
    showAuthView();
    return;
  }
  const user = data.session?.user;
  if (!user) {
    showAuthView();
    return;
  }
  showAppView();
  closeMenu();
  setPage("Portfolio");
}

async function signup(email, password) {
  const { error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) throw error;
  setStatus("Sign-up successful. Confirm your email before logging in.", "success");
}

async function login(email, password) {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch (_) {}
  clearAuthStorage();

  const warnTimer = setTimeout(() => {
    setStatus("Still logging in… (project/network may be slow)", "error");
  }, 8000);

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    clearStatus();
    return data;
  } finally {
    clearTimeout(warnTimer);
  }
}

// -------------------- Navigation / Pages --------------------
function setPage(pageName) {
  pageTitle.textContent = pageName;

  if (pageName === "Add/Edit transactions") {
    renderAddEditTransactions();
    loadTransactionsIntoTable(); // show list below form
    return;
  }

  if (pageName === "Transactions") {
    renderTransactionsOnly();
    loadTransactionsIntoTable();
    return;
  }

  pageBody.innerHTML = `<p>under construction</p>`;
}

menuToggle.addEventListener("click", () => {
  if (menuPanel.classList.contains("show")) closeMenu();
  else openMenu();
});

for (const item of menuItems) {
  item.addEventListener("click", () => {
    const page = item.getAttribute("data-page");
    setPage(page || "Section");
    closeMenu();
  });
}

logoutBtn.addEventListener("click", async () => {
  try {
    setLoading(true);
    await client.auth.signOut({ scope: "local" });
    clearAuthStorage();
    setStatus("Logged out.", "success");
  } catch (error) {
    clearAuthStorage();
    setStatus(error?.message || String(error), "error");
  } finally {
    authForm.reset();
    setMode("login");
    showAuthView();
    closeMenu();
    setLoading(false);
  }
});

signupTab.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setStatus("Email and password are required.", "error");
    return;
  }

  try {
    setLoading(true);
    clearStatus();

    if (mode === "signup") await signup(email, password);
    else await login(email, password);

    await refreshSession();
  } catch (error) {
    setStatus(error?.message || String(error), "error");
  } finally {
    setLoading(false);
  }
});

client.auth.onAuthStateChange(() => refreshSession());

// -------------------- EODHD helpers --------------------
async function eodhdFetchJson(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`EODHD error ${res.status}: ${text || res.statusText}`);
  }
  return await res.json();
}

async function searchByISIN(isin) {
  const url = `${EODHD_BASE}/search/${encodeURIComponent(isin)}?api_token=${encodeURIComponent(
    EODHD_API_TOKEN
  )}&fmt=json`;
  const data = await eodhdFetchJson(url);
  if (!Array.isArray(data)) return [];
  // prefer exact ISIN matches if present
  const exact = data.filter((x) => (x?.ISIN || "").toUpperCase() === isin.toUpperCase());
  return exact.length ? exact : data;
}

async function fetchCloseOnDate(tickerWithExchange, dateYYYYMMDD) {
  const url = `${EODHD_BASE}/eod/${encodeURIComponent(
    tickerWithExchange
  )}?from=${encodeURIComponent(dateYYYYMMDD)}&to=${encodeURIComponent(
    dateYYYYMMDD
  )}&period=d&api_token=${encodeURIComponent(EODHD_API_TOKEN)}&fmt=json`;

  const data = await eodhdFetchJson(url);
  // expected: array of bars, each having date + close
  if (!Array.isArray(data) || data.length === 0) {
    return { close: null, raw: data };
  }
  const bar = data.find((b) => b?.date === dateYYYYMMDD) || data[0];
  const close = typeof bar?.close === "number" ? bar.close : bar?.close != null ? Number(bar.close) : null;
  return { close: Number.isFinite(close) ? close : null, raw: data };
}

// -------------------- Transactions UI / Logic --------------------
let txState = {
  editingId: null,
  lastSearchResults: [],
};

function renderAddEditTransactions() {
  pageBody.innerHTML = `
    <div style="display:grid; gap:14px;">
      <div class="small">
        Enter the ISIN and click <b>Lookup ISIN</b>. Then select the instrument (Code + Exchange). On save, we fetch and store the EOD close for the trade date.
      </div>

      <section id="txStatus" class="status" aria-live="polite"></section>

      <form id="txForm">
        <div class="row">
          <label>
            ISIN
            <input id="txIsin" required placeholder="e.g. US0378331005" />
          </label>

          <label>
            Date
            <input id="txDate" type="date" required />
          </label>
        </div>

        <div class="row">
          <label>
            Side
            <select id="txSide" required>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </label>

          <label>
            Quantity
            <input id="txQty" type="number" step="0.00000001" min="0" required />
          </label>
        </div>

        <div class="row">
          <label>
            Unit price
            <input id="txUnit" type="number" step="0.00000001" min="0" required />
          </label>

          <label>
            Transaction fee
            <input id="txFee" type="number" step="0.00000001" min="0" value="0" required />
          </label>
        </div>

        <div class="row">
          <button id="txLookupBtn" class="btn" type="button">Lookup ISIN</button>

          <label>
            Code / Exchange (select)
            <select id="txInstrumentSelect" required>
              <option value="">— lookup ISIN first —</option>
            </select>
          </label>
        </div>

        <div class="row">
          <label>
            Instrument name
            <input id="txName" disabled placeholder="auto-filled after selection" />
          </label>

          <label>
            Currency
            <input id="txCcy" disabled placeholder="auto-filled after selection" />
          </label>
        </div>

        <label>
          Description
          <textarea id="txDesc" placeholder="Short free text / description"></textarea>
        </label>

        <div class="row">
          <button id="txSaveBtn" class="primary" type="submit">Save transaction</button>
          <button id="txCancelEditBtn" class="btn" type="button" style="display:none;">Cancel edit</button>
        </div>
      </form>

      <div>
        <h3 style="margin:12px 0 0;">Saved transactions</h3>
        <div class="small">Click <b>Edit</b> to load a row back into the form.</div>
        <div id="txTableWrap"></div>
      </div>
    </div>
  `;

  wireTxHandlers();
}

function renderTransactionsOnly() {
  pageBody.innerHTML = `
    <section id="txStatus" class="status" aria-live="polite"></section>
    <div>
      <h3 style="margin:0 0 8px;">Transactions</h3>
      <div class="small">This is the same list as under Add/Edit transactions.</div>
      <div id="txTableWrap"></div>
    </div>
  `;
}

function txSetStatus(msg, type) {
  const el = document.getElementById("txStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = `status show ${type}`;
}
function txClearStatus() {
  const el = document.getElementById("txStatus");
  if (!el) return;
  el.textContent = "";
  el.className = "status";
}

function wireTxHandlers() {
  const lookupBtn = document.getElementById("txLookupBtn");
  const instrumentSelect = document.getElementById("txInstrumentSelect");
  const cancelBtn = document.getElementById("txCancelEditBtn");
  const form = document.getElementById("txForm");

  lookupBtn.addEventListener("click", async () => {
    txClearStatus();
    const isin = document.getElementById("txIsin").value.trim();
    if (!isin) {
      txSetStatus("Please enter an ISIN first.", "error");
      return;
    }

    try {
      lookupBtn.disabled = true;
      lookupBtn.textContent = "Looking up…";

      const results = await searchByISIN(isin);
      txState.lastSearchResults = results;

      if (!results.length) {
        instrumentSelect.innerHTML = `<option value="">No results for this ISIN</option>`;
        document.getElementById("txName").value = "";
        document.getElementById("txCcy").value = "";
        txSetStatus("No instruments found for that ISIN.", "error");
        return;
      }

      // Build dropdown options: "CODE.EXCHANGE — NAME (CCY)"
      instrumentSelect.innerHTML = `<option value="">— select —</option>` + results
        .map((r, idx) => {
          const code = r?.Code ?? "";
          const ex = r?.Exchange ?? "";
          const name = r?.Name ?? "";
          const ccy = r?.Currency ?? "";
          const label = `${code}.${ex} — ${name}${ccy ? ` (${ccy})` : ""}`;
          return `<option value="${idx}">${escapeHtml(label)}</option>`;
        })
        .join("");

      txSetStatus("Select the instrument (Code / Exchange) from the dropdown.", "success");
    } catch (e) {
      txSetStatus(e?.message || String(e), "error");
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.textContent = "Lookup ISIN";
    }
  });

  instrumentSelect.addEventListener("change", () => {
    const idxStr = instrumentSelect.value;
    const nameEl = document.getElementById("txName");
    const ccyEl = document.getElementById("txCcy");

    if (!idxStr) {
      nameEl.value = "";
      ccyEl.value = "";
      return;
    }

    const r = txState.lastSearchResults[Number(idxStr)];
    nameEl.value = r?.Name ?? "";
    ccyEl.value = r?.Currency ?? "";
  });

  cancelBtn?.addEventListener("click", () => {
    resetTxForm();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    txClearStatus();

    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      txSetStatus("You are not logged in.", "error");
      showAuthView();
      return;
    }

    const isin = document.getElementById("txIsin").value.trim();
    const tradeDate = document.getElementById("txDate").value; // YYYY-MM-DD
    const side = document.getElementById("txSide").value;
    const quantity = Number(document.getElementById("txQty").value);
    const unitPrice = Number(document.getElementById("txUnit").value);
    const fee = Number(document.getElementById("txFee").value);
    const description = document.getElementById("txDesc").value.trim();

    const idxStr = document.getElementById("txInstrumentSelect").value;
    if (!idxStr) {
      txSetStatus("Please select Code / Exchange (lookup ISIN first).", "error");
      return;
    }
    const sel = txState.lastSearchResults[Number(idxStr)];
    const eodhdCode = sel?.Code;
    const eodhdExchange = sel?.Exchange;
    const instrumentName = sel?.Name ?? null;
    const instrumentCurrency = sel?.Currency ?? null;

    if (!isin || !tradeDate || !side || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(fee)) {
      txSetStatus("Please fill all required fields with valid numbers.", "error");
      return;
    }
    if (!eodhdCode || !eodhdExchange) {
      txSetStatus("Selected instrument is missing Code or Exchange. Try another result.", "error");
      return;
    }

    const tickerWithExchange = `${eodhdCode}.${eodhdExchange}`;

    try {
      const saveBtn = document.getElementById("txSaveBtn");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      // Fetch EOD close for the trade date
      const { close, raw: eodRaw } = await fetchCloseOnDate(tickerWithExchange, tradeDate);

      const payload = {
        user_id: userId,
        isin,
        quantity,
        unit_price: unitPrice,
        transaction_fee: fee,
        trade_date: tradeDate,
        side,
        description: description || null,

        eodhd_code: eodhdCode,
        eodhd_exchange: eodhdExchange,
        instrument_currency: instrumentCurrency,
        instrument_name: instrumentName,

        close_price: close,

        eodhd_search_json: sel ?? null,
        eodhd_eod_json: eodRaw ?? null,
      };

      let upsertRes;
      if (txState.editingId) {
        upsertRes = await client
          .from(TX_TABLE)
          .update(payload)
          .eq("id", txState.editingId)
          .select()
          .single();
      } else {
        upsertRes = await client
          .from(TX_TABLE)
          .insert(payload)
          .select()
          .single();
      }

      if (upsertRes.error) throw upsertRes.error;

      txSetStatus(
        close == null
          ? "Saved. (No close found for that date; stored as null.)"
          : "Saved. Close price stored.",
        "success"
      );

      resetTxForm();
      await loadTransactionsIntoTable();
    } catch (e) {
      txSetStatus(e?.message || String(e), "error");
    } finally {
      const saveBtn = document.getElementById("txSaveBtn");
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save transaction";
      }
    }
  });

  // table actions (edit/delete)
  pageBody.addEventListener("click", async (e) => {
    const btn = e.target?.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id) return;

    if (action === "edit") {
      await loadTransactionIntoForm(id);
      return;
    }

    if (action === "delete") {
      const ok = confirm("Delete this transaction?");
      if (!ok) return;

      try {
        txClearStatus();
        const res = await client.from(TX_TABLE).delete().eq("id", id);
        if (res.error) throw res.error;
        txSetStatus("Deleted.", "success");
        await loadTransactionsIntoTable();
      } catch (err) {
        txSetStatus(err?.message || String(err), "error");
      }
    }
  });
}

function resetTxForm() {
  txState.editingId = null;
  const form = document.getElementById("txForm");
  form?.reset();

  const instrumentSelect = document.getElementById("txInstrumentSelect");
  if (instrumentSelect) instrumentSelect.innerHTML = `<option value="">— lookup ISIN first —</option>`;

  const nameEl = document.getElementById("txName");
  const ccyEl = document.getElementById("txCcy");
  if (nameEl) nameEl.value = "";
  if (ccyEl) ccyEl.value = "";

  const cancelBtn = document.getElementById("txCancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";

  const saveBtn = document.getElementById("txSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save transaction";

  txClearStatus();
}

async function loadTransactionsIntoTable() {
  const wrap = document.getElementById("txTableWrap");
  if (!wrap) return;

  wrap.innerHTML = `<div class="small">Loading…</div>`;

  const res = await client
    .from(TX_TABLE)
    .select(
      "id, isin, trade_date, side, quantity, unit_price, transaction_fee, description, eodhd_code, eodhd_exchange, instrument_currency, instrument_name, close_price, created_at"
    )
    .order("trade_date", { ascending: false })
    .limit(200);

  if (res.error) {
    wrap.innerHTML = `<div class="status show error">${escapeHtml(res.error.message)}</div>`;
    return;
  }

  const rows = res.data || [];
  if (!rows.length) {
    wrap.innerHTML = `<div class="small">No transactions yet.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Side</th>
          <th>ISIN</th>
          <th>Instrument</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Fee</th>
          <th>CCY</th>
          <th>Close</th>
          <th>Description</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((r) => {
            const ticker = `${r.eodhd_code}.${r.eodhd_exchange}`;
            return `
              <tr>
                <td>${escapeHtml(r.trade_date)}</td>
                <td><span class="pill">${escapeHtml(r.side)}</span></td>
                <td>${escapeHtml(r.isin)}</td>
                <td>
                  <div>${escapeHtml(ticker)}</div>
                  <div class="small">${escapeHtml(r.instrument_name || "")}</div>
                </td>
                <td>${escapeHtml(r.quantity)}</td>
                <td>${escapeHtml(r.unit_price)}</td>
                <td>${escapeHtml(r.transaction_fee)}</td>
                <td>${escapeHtml(r.instrument_currency || "")}</td>
                <td>${r.close_price == null ? "" : escapeHtml(r.close_price)}</td>
                <td>${escapeHtml(r.description || "")}</td>
                <td>
                  <div class="actions">
                    <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(r.id)}">Edit</button>
                    <button class="btn" type="button" data-action="delete" data-id="${escapeHtml(r.id)}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

async function loadTransactionIntoForm(id) {
  const res = await client.from(TX_TABLE).select("*").eq("id", id).single();
  if (res.error) {
    txSetStatus(res.error.message, "error");
    return;
  }

  const r = res.data;
  txState.editingId = r.id;

  // fill form
  document.getElementById("txIsin").value = r.isin || "";
  document.getElementById("txDate").value = r.trade_date || "";
  document.getElementById("txSide").value = r.side || "BUY";
  document.getElementById("txQty").value = r.quantity ?? "";
  document.getElementById("txUnit").value = r.unit_price ?? "";
  document.getElementById("txFee").value = r.transaction_fee ?? 0;
  document.getElementById("txDesc").value = r.description || "";

  // set selected instrument in dropdown (single option for edit)
  const instrumentSelect = document.getElementById("txInstrumentSelect");
  const ticker = `${r.eodhd_code}.${r.eodhd_exchange}`;
  const label = `${ticker} — ${r.instrument_name || ""}${r.instrument_currency ? ` (${r.instrument_currency})` : ""}`;

  txState.lastSearchResults = [
    {
      Code: r.eodhd_code,
      Exchange: r.eodhd_exchange,
      Name: r.instrument_name,
      Currency: r.instrument_currency,
      ISIN: r.isin,
    },
  ];

  instrumentSelect.innerHTML = `<option value="0">${escapeHtml(label)}</option>`;
  instrumentSelect.value = "0";

  document.getElementById("txName").value = r.instrument_name || "";
  document.getElementById("txCcy").value = r.instrument_currency || "";

  const cancelBtn = document.getElementById("txCancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  const saveBtn = document.getElementById("txSaveBtn");
  if (saveBtn) saveBtn.textContent = "Update transaction";

  txSetStatus("Editing loaded. Update fields and click Update transaction.", "success");
}

// -------------------- Boot --------------------
setMode("login");
showAuthView();
refreshSession();
