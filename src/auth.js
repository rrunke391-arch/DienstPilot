"use strict";

const DIENSTPILOT_USERS_KEY = "dienstpilot_users_v1";
const DIENSTPILOT_SESSION_KEY = "dienstpilot_user";
const DIENSTPILOT_ROLE_KEY = "dienstpilot_role";
const DIENSTPILOT_UNLOCKED_KEY = "dienstpilot_unlocked";
const DIENSTPILOT_ACTIVE_DRIVER_KEY = "dienstpilot_aktiver_kollege";

const DIENSTPILOT_BUILTIN_USERS = [
  {
    username: "Runke",
    displayName: "Runke",
    role: "Administrator",
    functionTitle: "Entwickler von DienstPilot 2026",
    driverProfile: "runke",
    access: "Vollzugriff",
    passwordHash: "6c651e36960ed17a84e0ab3c3e927efc05f896976a1c29144b55a75a283c4e92",
    mustChangePassword: false,
    isBuiltin: true
  },
  {
    username: "Testfahrer",
    displayName: "Testfahrer",
    role: "Fahrer",
    functionTitle: "Testzugang Fahrer",
    driverProfile: "testfahrer",
    access: "Eigener Bereich",
    passwordHash: "",
    startPasswordHash: "90e38dea6fb5df0f0a5ca72be74bbf196e99d90faa6d0d3ee84dfc5b9a0209ae",
    mustChangePassword: true,
    isBuiltin: true
  }
];

function normalizeLoginValue(value) {
  return String(value || "").trim().toLowerCase();
}

async function digestText(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function loadStoredUsers() {
  try {
    const raw = localStorage.getItem(DIENSTPILOT_USERS_KEY);
    const users = JSON.parse(raw || "[]");
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(DIENSTPILOT_USERS_KEY, JSON.stringify(users));
}

function normalizeUserRecord(user) {
  return {
    username: String(user.username || "").trim(),
    displayName: String(user.displayName || user.username || "").trim(),
    email: String(user.email || "").trim(),
    role: String(user.role || "Fahrer").trim(),
    functionTitle: String(user.functionTitle || "").trim(),
    driverProfile: String(user.driverProfile || "").trim(),
    access: String(user.access || "").trim(),
    passwordHash: user.passwordHash || "",
    startPasswordHash: user.startPasswordHash || "",
    mustChangePassword: user.mustChangePassword === true,
    isBuiltin: user.isBuiltin === true
  };
}

function getAllUsers() {
  const map = new Map();

  DIENSTPILOT_BUILTIN_USERS.forEach((user) => {
    const normalized = normalizeUserRecord(user);
    map.set(normalizeLoginValue(normalized.username), normalized);
  });

  loadStoredUsers().forEach((user) => {
    const normalized = normalizeUserRecord(user);
    if (!normalized.username) return;
    const key = normalizeLoginValue(normalized.username);
    const existing = map.get(key) || {};
    map.set(key, { ...existing, ...normalized, isBuiltin: existing.isBuiltin === true });
  });

  return Array.from(map.values());
}

function findUser(username) {
  const key = normalizeLoginValue(username);
  return getAllUsers().find((user) => normalizeLoginValue(user.username) === key) || null;
}

function getPublicUserData(user) {
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    functionTitle: user.functionTitle,
    driverProfile: user.driverProfile,
    access: user.access
  };
}

function saveLoginSession(user) {
  sessionStorage.setItem(DIENSTPILOT_UNLOCKED_KEY, "yes");
  sessionStorage.setItem(DIENSTPILOT_SESSION_KEY, JSON.stringify(getPublicUserData(user)));
  sessionStorage.setItem(DIENSTPILOT_ROLE_KEY, user.role);
  if (user.driverProfile) {
    localStorage.setItem(DIENSTPILOT_ACTIVE_DRIVER_KEY, user.driverProfile);
  }
}

function clearOldLoginSession() {
  if (sessionStorage.getItem(DIENSTPILOT_UNLOCKED_KEY) === "yes" && !sessionStorage.getItem(DIENSTPILOT_SESSION_KEY)) {
    sessionStorage.removeItem(DIENSTPILOT_UNLOCKED_KEY);
  }
}

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(DIENSTPILOT_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function currentRole() {
  const user = getCurrentUser();
  return user ? user.role : "";
}

function hasRole(...roles) {
  const role = currentRole();
  return roles.includes(role);
}

function unlockApp() {
  document.body.classList.remove("auth-locked");

  const loginScreen = document.getElementById("loginScreen");
  if (loginScreen) {
    loginScreen.style.display = "none";
  }
}

function ensureLoginFields() {
  const passwordInput = document.getElementById("appPassword");
  if (!passwordInput) return null;

  let usernameInput = document.getElementById("appUsername");
  if (!usernameInput) {
    usernameInput = document.createElement("input");
    usernameInput.id = "appUsername";
    usernameInput.type = "text";
    usernameInput.placeholder = "Benutzername";
    usernameInput.autocomplete = "username";
    usernameInput.value = "Runke";
    passwordInput.parentElement.insertBefore(usernameInput, passwordInput);
  }

  passwordInput.placeholder = "Passwort";
  passwordInput.autocomplete = "current-password";

  const infoText = document.querySelector("#loginScreen .login-box p");
  if (infoText) {
    infoText.textContent = "Bitte Benutzername und Passwort eingeben, um DienstPilot zu öffnen.";
  }

  return { usernameInput, passwordInput };
}

async function verifyLogin(user, enteredPassword) {
  const enteredHash = await digestText(enteredPassword);

  if (user.passwordHash && enteredHash === user.passwordHash) {
    return { ok: true, mustChangePassword: user.mustChangePassword === true };
  }

  if (user.startPasswordHash && enteredHash === user.startPasswordHash) {
    return { ok: true, mustChangePassword: true };
  }

  return { ok: false, mustChangePassword: false };
}

function setLoginError(text) {
  const error = document.getElementById("loginError");
  if (error) error.textContent = text;
}

function createInput(type, placeholder) {
  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = "new-password";
  return input;
}

function showPasswordChangeForm(user) {
  const box = document.querySelector("#loginScreen .login-box");
  if (!box) return;

  box.innerHTML = "";

  const logo = document.createElement("img");
  logo.src = "favicon.png?v=dienstpilot-8";
  logo.alt = "DienstPilot Logo";
  logo.className = "login-logo";

  const title = document.createElement("h1");
  title.textContent = "Neues Passwort festlegen";

  const info = document.createElement("p");
  info.textContent = "Das Startpasswort war nur einmalig gültig. Bitte lege jetzt dein eigenes Passwort fest.";

  const firstInput = createInput("password", "Neues Passwort");
  const secondInput = createInput("password", "Neues Passwort wiederholen");

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Passwort speichern";

  const error = document.createElement("div");
  error.className = "login-error";

  box.append(logo, title, info, firstInput, secondInput, button, error);

  async function saveNewPassword() {
    const first = firstInput.value.trim();
    const second = secondInput.value.trim();

    if (first.length < 8) {
      error.textContent = "Das neue Passwort muss mindestens 8 Zeichen haben.";
      return;
    }

    if (first !== second) {
      error.textContent = "Die beiden Passwörter stimmen nicht überein.";
      return;
    }

    const newHash = await digestText(first);
    const users = loadStoredUsers();
    const key = normalizeLoginValue(user.username);
    const index = users.findIndex((item) => normalizeLoginValue(item.username) === key);
    const updatedUser = {
      ...user,
      passwordHash: newHash,
      startPasswordHash: "",
      mustChangePassword: false,
      isBuiltin: false
    };

    if (index >= 0) users[index] = updatedUser;
    else users.push(updatedUser);

    saveStoredUsers(users);
    saveLoginSession(updatedUser);
    unlockApp();
  }

  button.addEventListener("click", saveNewPassword);
  [firstInput, secondInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveNewPassword();
    });
  });

  firstInput.focus();
}

async function checkPassword() {
  const fields = ensureLoginFields();
  if (!fields) return;

  const user = findUser(fields.usernameInput.value);
  const result = user ? await verifyLogin(user, fields.passwordInput.value) : { ok: false };

  if (result.ok && result.mustChangePassword) {
    showPasswordChangeForm(user);
    return;
  }

  if (result.ok) {
    setLoginError("");
    saveLoginSession(user);
    unlockApp();
    return;
  }

  setLoginError("Benutzername oder Passwort ist falsch.");
  fields.passwordInput.value = "";
  fields.passwordInput.focus();
}

window.DienstPilotAuth = {
  getCurrentUser,
  currentRole,
  hasRole,
  getAllUsers
};

document.addEventListener("DOMContentLoaded", () => {
  clearOldLoginSession();
  const fields = ensureLoginFields();

  if (sessionStorage.getItem(DIENSTPILOT_UNLOCKED_KEY) === "yes" && sessionStorage.getItem(DIENSTPILOT_SESSION_KEY)) {
    unlockApp();
    return;
  }

  const button = document.getElementById("loginButton");
  if (button) {
    button.addEventListener("click", checkPassword);
  }

  if (fields) {
    [fields.usernameInput, fields.passwordInput].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          checkPassword();
        }
      });
    });

    fields.passwordInput.focus();
  }
});
