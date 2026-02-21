const SUPABASE_URL = "https://iwqmmxgansutrjbegqva.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cW1teGdhbnN1dHJqYmVncXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjU2NzcsImV4cCI6MjA4NzI0MTY3N30.lLjygPN2qDnHeDh9ZlZnu2_DisFWlV_qEm16bv85qXs";

if (
  !window.supabase ||
  SUPABASE_URL.includes("YOUR_PROJECT") ||
  SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
) {
  const statusEl = document.getElementById("status");
  statusEl.textContent =
    "Supabase is not configured yet. Open app.js and replace SUPABASE_URL and SUPABASE_ANON_KEY.";
  statusEl.className = "status show error";
  throw new Error("Missing Supabase configuration.");
}

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const authForm = document.getElementById("authForm");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusEl = document.getElementById("status");
const sessionEl = document.getElementById("session");
const sessionEmail = document.getElementById("sessionEmail");
const logoutBtn = document.getElementById("logoutBtn");

let mode = "login";

function setMode(nextMode) {
  mode = nextMode;

  const isLogin = mode === "login";
  loginTab.classList.toggle("active", isLogin);
  signupTab.classList.toggle("active", !isLogin);

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

async function refreshSession() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  const user = data.session?.user;

  if (!user) {
    sessionEl.classList.remove("show");
    sessionEmail.textContent = "-";
    return;
  }

  sessionEl.classList.add("show");
  sessionEmail.textContent = user.email || "Unknown";
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
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  setStatus("Login successful.", "success");
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

logoutBtn.addEventListener("click", async () => {
  try {
    setLoading(true);
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }

    setStatus("Logged out.", "success");
    await refreshSession();
  } catch (error) {
    setStatus(error.message || String(error), "error");
  } finally {
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
refreshSession();
