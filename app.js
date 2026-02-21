const SUPABASE_URL = "https://iwqmmxgansutrjbegqva.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cW1teGdhbnN1dHJqYmVncXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjU2NzcsImV4cCI6MjA4NzI0MTY3N30.lLjygPN2qDnHeDh9ZlZnu2_DisFWlV_qEm16bv85qXs";

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const statusEl = document.getElementById("status");

if (
  !window.supabase ||
  SUPABASE_URL.includes("YOUR_PROJECT") ||
  SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
) {
  statusEl.textContent =
    "Supabase is not configured yet. Open app.js and replace SUPABASE_URL and SUPABASE_ANON_KEY.";
  statusEl.className = "status show error";
  throw new Error("Missing Supabase configuration.");
}

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    }),
  ]);
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
    options: {
      emailRedirectTo: window.location.href,
    },
  });

  if (error) {
    throw error;
  }

  setStatus(
    "Sign-up successful. Check your email and confirm your account before logging in.",
    "success"
  );
}

async function login(email, password) {
  // Clear any stale local auth state before attempting a fresh sign-in.
  await Promise.race([
    client.auth.signOut({ scope: "local" }),
    new Promise((resolve) => setTimeout(resolve, 1200)),
  ]);
  clearAuthStorage();

  const loginResult = await withTimeout(
    client.auth.signInWithPassword({ email, password }),
    8000
  );

  if (loginResult?.timedOut) {
    throw new Error("Login timed out. Please try again.");
  }

  if (loginResult?.error) {
    throw loginResult.error;
  }

  clearStatus();
}

signupTab.addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

menuToggle.addEventListener("click", () => {
  if (menuPanel.classList.contains("show")) {
    closeMenu();
    return;
  }

  openMenu();
});

for (const item of menuItems) {
  item.addEventListener("click", () => {
    const page = item.getAttribute("data-page");
    setPage(page || "Section");
    closeMenu();
  });
}

logoutBtn.addEventListener("click", async () => {
  let shouldReload = false;

  try {
    setLoading(true);

    const signOutResult = await withTimeout(
      client.auth.signOut({ scope: "local" }),
      2000
    );

    clearAuthStorage();

    if (signOutResult?.error) {
      throw signOutResult.error;
    }

    setStatus(signOutResult?.timedOut ? "Logged out locally." : "Logged out.", "success");
  } catch (error) {
    clearAuthStorage();
    setStatus(error.message || String(error), "error");
  } finally {
    authForm.reset();
    setMode("login");
    showAuthView();
    closeMenu();
    setLoading(false);

    if (shouldReload) {
      window.location.reload();
    }
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
    if (mode === "signup") {
      await signup(email, password);
    } else {
      await login(email, password);
    }

    await refreshSession();
  } catch (error) {
    setStatus(error.message || String(error), "error");
  } finally {
    setLoading(false);
  }
});

client.auth.onAuthStateChange(async () => {
  await refreshSession();
});

setMode("login");
showAuthView();
refreshSession();
