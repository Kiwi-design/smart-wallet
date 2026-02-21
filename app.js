const SUPABASE_URL = "https://iwqmmxgansutrjbegqva.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cW1teGdhbnN1dHJqYmVncXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjU2NzcsImV4cCI6MjA4NzI0MTY3N30.lLjygPN2qDnHeDh9ZlZnu2_DisFWlV_qEm16bv85qXs";

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const statusEl = document.getElementById("status");

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status show ${type}`;
}
function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status";
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  setStatus("Supabase config missing in app.js.", "error");
  throw new Error("Missing Supabase configuration.");
}

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  setStatus(
    "Supabase library did not load. Check the script tag (use the UMD bundle) and your CSP/network.",
    "error"
  );
  throw new Error("Supabase library missing.");
}

/**
 * HARDENING FIX:
 * Some environments/extensions/proxies strip custom headers.
 * We force `apikey` and `Authorization` onto every outgoing request made by supabase-js.
 */
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});

  // Ensure apikey exists
  if (!headers.has("apikey")) headers.set("apikey", SUPABASE_ANON_KEY);

  // Ensure Authorization exists (Supabase often uses Bearer anon key for auth endpoints)
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

let mode = "login";

function showAuthView() {
  authView.classList.add("show");
  appView.classList.remove("show");
}
function showAppView() {
  authView.classList.remove("show");
  appView.classList.add("show");
}

function setMode(nextMode) {
  mode = nextMode;

  const isLogin = mode === "login";
  signupTab.classList.toggle("active", !isLogin);
  signupTab.textContent = isLogin ? "Sign up" : "Back to login";

  submitBtn.textContent = isLogin ? "Login" : "Sign up";
  passwordInput.autocomplete = isLogin ? "current-password" : "new-password";
  clearStatus();
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  logoutBtn.disabled = isLoading;
}

function closeMenu() {
  menuPanel.classList.remove("show");
  menuToggle.setAttribute("aria-expanded", "false");
}

function openMenu() {
  menuPanel.classList.add("show");
  menuToggle.setAttribute("aria-expanded", "true");
}

function setPage(pageName) {
  pageTitle.textContent = pageName;
  pageBody.textContent = "under construction";
}

function clearAuthStorage() {
  const projectPrefix = `sb-${projectRef}-`;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && (key === "supabase.auth.token" || key.startsWith(projectPrefix))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) storage.removeItem(key);
  }
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
  // Clear stale local auth state before attempting a fresh sign-in.
  try {
    await client.auth.signOut({ scope: "local" });
  } catch (_) {
    // ignore
  }
  clearAuthStorage();

  // IMPORTANT FIX: do NOT hard-fail early with a fake timeout.
  // Instead, show a "still working" message if it takes long.
  const warnTimer = setTimeout(() => {
    setStatus("Still logging in… (project/network may be slow)", "error");
  }, 8000);

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // If sign-in succeeded but session isn't present yet, refreshSession handles it.
    clearStatus();
    return data;
  } finally {
    clearTimeout(warnTimer);
  }
}

signupTab.addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

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

client.auth.onAuthStateChange(() => {
  refreshSession();
});

setMode("login");
showAuthView();
refreshSession();
