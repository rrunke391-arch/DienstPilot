"use strict";

const APP_PASSWORD = "DienstPilot2026";

function unlockApp() {
  document.body.classList.remove("auth-locked");

  const loginScreen = document.getElementById("loginScreen");
  if (loginScreen) {
    loginScreen.style.display = "none";
  }

  sessionStorage.setItem("dienstpilot_unlocked", "yes");
}

function checkPassword() {
  const input = document.getElementById("appPassword");
  const error = document.getElementById("loginError");

  if (!input) return;

  if (input.value === APP_PASSWORD) {
    unlockApp();
  } else {
    if (error) {
      error.textContent = "Passwort ist falsch.";
    }

    input.value = "";
    input.focus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("dienstpilot_unlocked") === "yes") {
    unlockApp();
    return;
  }

  const button = document.getElementById("loginButton");
  const input = document.getElementById("appPassword");

  if (button) {
    button.addEventListener("click", checkPassword);
  }

  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        checkPassword();
      }
    });

    input.focus();
  }
});
