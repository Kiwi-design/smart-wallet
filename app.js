// ===============================
// Supabase config (YOUR PROJECT)
// ===============================
const SUPABASE_PROJECT_ID = "iwqmmxgansutrjbegqva";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cW1teGdhbnN1dHJqYmVncXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjU2NzcsImV4cCI6MjA4NzI0MTY3N30.lLjygPN2qDnHeDh9ZlZnu2_DisFWlV_qEm16bv85qXs";

if (!window.supabase || !window.supabase.createClient) {
  throw new Error(
    "Supabase library not loaded. Make sure you're using the UMD build and that the script tag is before app.js."
  );
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Where Supabase should redirect after email verification / magic links / password reset.
// IMPORTANT: This must be allowed in Supabase Auth settings.
const REDIRECT_TO = window.location.origin + window.location.pathname;

// ===============================
// UI helpers
// ===============================
const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");

const form = document.getElementById("auth-form");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

const submitBtn = document.getElementById("submit");
const resetBtn = document.getElementById("reset");

const msgEl = document.getElementById("message");

const authedBox = document.getElementById("authed");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout");

let mode = "login"; // "login" | "signup"

function setMode(nextMode) {
  mode = nextMode;

  if (mode === "login") {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    submitBtn.textContent = "Log in";
    passwordEl.autocomplete = "current-password";
  } else {
    tabLogin.classList.remove("active");
    tabSignup.classList.add("active");
    submitBtn.textContent = "Sign up";
    passwordEl.autocomplete = "new-password";
  }

  clearMessage();
}

function setMessage(text, kind = "") {
  msgEl.textContent = text;
  msgEl.classList.add("show");
  msgEl.classList.remove("ok", "err");
  if (kind === "ok") msgEl.classList.add("ok");
  if (kind === "err") msgEl.classList.add("err");
}

function clearMessage() {
  msgEl.textContent = "";
  msgEl.classList.remove("show", "ok", "err");
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  resetBtn.disabled = isLoading;
  logoutBtn.disabled = isLoading;
}

// ===============================
// Auth flows
// ===============================
async function signUpWithEmail(email, password) {
  // With email confirmations enabled in Supabase, this will send a verification email.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: REDIRECT_TO,
    },
  });

  if (error) throw error;

  // If email confirmation is required, user may be null until confirmed.
  // data.user may exist but not confirmed; data.session is typically null.
  setMessage(
    "Sign up successful.\nCheck your inbox to verify your email address, then return here via the link.",
    "ok"
  );
}

async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // If email confirmation is required and user isn't confirmed, Supabase usually errors.
  setMessage("Logged in successfully.", "ok");
  await renderSession();
}

async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: REDIRECT_TO,
  });
  if (error) throw error;

  setMessage(
    "Password reset email sent.\nUse the link in the email to set a new password, then return here.",
    "ok"
  );
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  setMessage("Logged out.", "ok");
  await renderSession();
}

// ===============================
// Session / verification handling
// ===============================
async function renderSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setMessage(error.message, "err");
    return;
  }

  const session = data.session;

  if (session?.user) {
    authedBox.classList.add("show");
    userEmailEl.textContent = session.user.email ?? "—";
  } else {
    authedBox.classList.remove("show");
    userEmailEl.textContent = "—";
  }
}

/**
 * When Supabase redirects back after email verification or password recovery,
 * the URL may contain auth-related params (code, error, etc).
 *
 * Supabase v2 handles these internally. We simply:
 * - render current session
 * - surface any URL error params nicely
 */
function showUrlErrorsIfAny() {
  const url = new URL(window.location.href);

  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error || errorDesc) {
    setMessage(
      `Auth redirect error:\n${error ?? ""}\n${errorDesc ?? ""}`.trim(),
      "err"
    );
  }
}

// ===============================
// Event listeners
// ===============================
tabLogin.addEventListener("click", () => setMode("login"));
tabSignup.addEventListener("click", () => setMode("signup"));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const email = (emailEl.value || "").trim();
  const password = passwordEl.value || "";

  if (!email) return setMessage("Please enter your email.", "err");
  if (!password || password.length < 6)
    return setMessage("Password must be at least 6 characters.", "err");

  try {
    setLoading(true);
    if (mode === "signup") {
      await signUpWithEmail(email, password);
    } else {
      await loginWithEmail(email, password);
    }
  } catch (err) {
    setMessage(err?.message ?? String(err), "err");
  } finally {
    setLoading(false);
  }
});

resetBtn.addEventListener("click", async () => {
  clearMessage();
  const email = (emailEl.value || "").trim();
  if (!email) return setMessage("Enter your email first, then click reset.", "err");

  try {
    setLoading(true);
    await sendPasswordReset(email);
  } catch (err) {
    setMessage(err?.message ?? String(err), "err");
  } finally {
    setLoading(false);
  }
});

logoutBtn.addEventListener("click", async () => {
  clearMessage();
  try {
    setLoading(true);
    await logout();
  } catch (err) {
    setMessage(err?.message ?? String(err), "err");
  } finally {
    setLoading(false);
  }
});

// Keep UI in sync if auth state changes in another tab, etc.
supabase.auth.onAuthStateChange(async (_event, _session) => {
  await renderSession();
});

// ===============================
// Init
// ===============================
setMode("login");
showUrlErrorsIfAny();
renderSession();
