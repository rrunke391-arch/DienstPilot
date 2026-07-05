"use strict";

const DIENSTPILOT_ADMIN = {
  username: "Runke",
  codeHash: "6c651e36960ed17a84e0ab3c3e927efc05f896976a1c29144b55a75a283c4e92",
  displayName: "Runke",
  role: "Administrator",
  functionTitle: "Entwickler von DienstPilot 2026",
  driverProfile: "runke",
  access: "Vollzugriff"
};

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

function getPublicUserData() {
  return {
    username: DIENSTPILOT_ADMIN.username,
    displayName: DIENSTPILOT_ADMIN.displayName,
    role: DIENSTPILOT_ADMIN.role,
    functionTitle: DIENSTPILOT_ADMIN.functionTitle,
    driverProfile: DIENSTPILOT_ADMIN.driverProfile,
    access: DIENSTPILOT_ADMIN.access
  };
}

function saveLoginSession() {
  sessionStorage.setItem("dienstpilot_unlocked", "yes");
  sessionStorage.setItem("dienstpilot_user", JSON.stringify(getPublicUserData()));
  sessionStorage.setItem("dienstpilot_role", DIENSTPILOT_ADMIN.role);
  localStorage.setItem("dienstpilot_aktiver_kollege", DIENSTPILOT_ADMIN.driverProfile);
}

function clearOldLoginSession() {
  if (sessionStorage.getItem("dienstpilot_unlocked") === "yes" && !sessionStorage.getItem("dienstpilot_user")) {
    sessionStorage.removeItem("dienstpilot_unlocked");
  }
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
    usernameInput.value = DIENSTPILOT_ADMIN.username;
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

async function checkPassword() {
  const fields = ensureLoginFields();
  const error = document.getElementById("loginError");
  if (!fields) return;

  const userOk = normalizeLoginValue(fields.usernameInput.value) === normalizeLoginValue(DIENSTPILOT_ADMIN.username);
  const codeOk = await digestText(fields.passwordInput.value) === DIENSTPILOT_ADMIN.codeHash;

  if (userOk && codeOk) {
    if (error) error.textContent = "";
    saveLoginSession();
    unlockApp();
    return;
  }

  if (error) {
    error.textContent = "Benutzername oder Passwort ist falsch.";
  }

  fields.passwordInput.value = "";
  fields.passwordInput.focus();
}

document.addEventListener("DOMContentLoaded", () => {
  clearOldLoginSession();
  const fields = ensureLoginFields();

  if (sessionStorage.getItem("dienstpilot_unlocked") === "yes" && sessionStorage.getItem("dienstpilot_user")) {
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
