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

function installUrlaubswunschStyles() {
  if (document.getElementById("urlaubswunschStyles")) return;

  const style = document.createElement("style");
  style.id = "urlaubswunschStyles";
  style.textContent = `
    .urlaubswunsch-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(15, 23, 42, 0.72);
      backdrop-filter: blur(8px);
    }

    .urlaubswunsch-modal {
      width: min(1180px, 100%);
      max-height: 92vh;
      overflow: auto;
      background: #f8fafc;
      border-radius: 26px;
      box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
      border: 1px solid rgba(148, 163, 184, 0.35);
    }

    .urlaubswunsch-head {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding: 22px;
      color: white;
      background: linear-gradient(135deg, #020617, #1d4ed8);
      border-radius: 26px 26px 0 0;
    }

    .urlaubswunsch-head h2 {
      margin: 0 0 6px;
      font-size: clamp(24px, 4vw, 34px);
    }

    .urlaubswunsch-head p {
      margin: 0;
      color: rgba(255, 255, 255, 0.78);
    }

    .urlaubswunsch-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .urlaubswunsch-year {
      min-width: 88px;
      text-align: center;
      font-size: 22px;
      font-weight: 800;
    }

    .urlaubswunsch-btn {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 800;
      cursor: pointer;
      color: #0f172a;
      background: white;
    }

    .urlaubswunsch-btn.secondary {
      background: rgba(255, 255, 255, 0.14);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.32);
    }

    .urlaubswunsch-body {
      padding: 20px;
    }

    .urlaubswunsch-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 18px;
      padding: 14px 16px;
      border-radius: 18px;
      background: white;
      border: 1px solid #e2e8f0;
      color: #334155;
    }

    .urlaubswunsch-count {
      font-weight: 900;
      color: #166534;
    }

    .urlaubswunsch-months {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .urlaubswunsch-month {
      padding: 14px;
      border-radius: 20px;
      background: white;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    }

    .urlaubswunsch-month-title {
      margin: 0 0 10px;
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
    }

    .urlaubswunsch-weekdays,
    .urlaubswunsch-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }

    .urlaubswunsch-weekdays span {
      text-align: center;
      font-size: 11px;
      font-weight: 900;
      color: #64748b;
    }

    .urlaubswunsch-empty,
    .urlaubswunsch-day {
      min-height: 32px;
      border-radius: 10px;
    }

    .urlaubswunsch-day {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #0f172a;
      font-weight: 800;
      cursor: pointer;
    }

    .urlaubswunsch-day:hover {
      background: #dbeafe;
      border-color: #93c5fd;
    }

    .urlaubswunsch-day.selected {
      background: #16a34a;
      border-color: #15803d;
      color: white;
      box-shadow: 0 6px 16px rgba(22, 163, 74, 0.26);
    }

    .urlaubswunsch-day.weekend:not(.selected) {
      background: #fff7ed;
      border-color: #fed7aa;
    }

    @media (max-width: 900px) {
      .urlaubswunsch-months {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .urlaubswunsch-backdrop {
        padding: 8px;
      }

      .urlaubswunsch-head {
        position: static;
      }

      .urlaubswunsch-months {
        grid-template-columns: 1fr;
      }

      .urlaubswunsch-day {
        min-height: 38px;
      }
    }
  `;
  document.head.appendChild(style);
}

function storageKeyForUrlaubswunsch(year) {
  return `dienstpilot_urlaubswunsch_${year}`;
}

function loadUrlaubswunschDates(year) {
  try {
    const raw = localStorage.getItem(storageKeyForUrlaubswunsch(year));
    const arr = JSON.parse(raw || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveUrlaubswunschDates(year, dates) {
  localStorage.setItem(storageKeyForUrlaubswunsch(year), JSON.stringify([...dates].sort()));
}

function isoDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstWeekdayMondayBased(year, monthIndex) {
  return (new Date(year, monthIndex, 1).getDay() + 6) % 7;
}

function openUrlaubswunschCalendar() {
  installUrlaubswunschStyles();

  const existing = document.getElementById("urlaubswunschBackdrop");
  if (existing) existing.remove();

  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  let activeYear = new Date().getFullYear();
  let selectedDates = loadUrlaubswunschDates(activeYear);

  const backdrop = document.createElement("div");
  backdrop.id = "urlaubswunschBackdrop";
  backdrop.className = "urlaubswunsch-backdrop";

  const modal = document.createElement("div");
  modal.className = "urlaubswunsch-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  modal.innerHTML = `
    <div class="urlaubswunsch-head">
      <div>
        <h2>🌴 Urlaubswunsch</h2>
        <p>Jahreskalender: Tage anklicken, um Urlaubswünsche zu markieren oder wieder zu entfernen.</p>
      </div>
      <div class="urlaubswunsch-controls">
        <button type="button" class="urlaubswunsch-btn secondary" id="urlaubswunschPrev">‹</button>
        <span class="urlaubswunsch-year" id="urlaubswunschYear"></span>
        <button type="button" class="urlaubswunsch-btn secondary" id="urlaubswunschNext">›</button>
        <button type="button" class="urlaubswunsch-btn secondary" id="urlaubswunschClose">Schließen</button>
      </div>
    </div>
    <div class="urlaubswunsch-body">
      <div class="urlaubswunsch-summary">
        <span id="urlaubswunschInfo"></span>
        <button type="button" class="urlaubswunsch-btn" id="urlaubswunschClear">Auswahl löschen</button>
      </div>
      <div class="urlaubswunsch-months" id="urlaubswunschMonths"></div>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  const render = () => {
    const yearLabel = modal.querySelector("#urlaubswunschYear");
    const info = modal.querySelector("#urlaubswunschInfo");
    const months = modal.querySelector("#urlaubswunschMonths");

    yearLabel.textContent = String(activeYear);
    info.innerHTML = `<span class="urlaubswunsch-count">${selectedDates.size}</span> Urlaubswunsch-Tag${selectedDates.size === 1 ? "" : "e"} im Jahr ${activeYear} markiert.`;
    months.innerHTML = "";

    for (let m = 0; m < 12; m += 1) {
      const month = document.createElement("section");
      month.className = "urlaubswunsch-month";

      const title = document.createElement("h3");
      title.className = "urlaubswunsch-month-title";
      title.textContent = monthNames[m];
      month.appendChild(title);

      const weekdaysRow = document.createElement("div");
      weekdaysRow.className = "urlaubswunsch-weekdays";
      weekdays.forEach(w => {
        const span = document.createElement("span");
        span.textContent = w;
        weekdaysRow.appendChild(span);
      });
      month.appendChild(weekdaysRow);

      const daysGrid = document.createElement("div");
      daysGrid.className = "urlaubswunsch-days";

      const blanks = firstWeekdayMondayBased(activeYear, m);
      for (let i = 0; i < blanks; i += 1) {
        const blank = document.createElement("div");
        blank.className = "urlaubswunsch-empty";
        daysGrid.appendChild(blank);
      }

      const daysInMonth = new Date(activeYear, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d += 1) {
        const date = isoDate(activeYear, m, d);
        const weekday = new Date(activeYear, m, d).getDay();
        const dayButton = document.createElement("button");
        dayButton.type = "button";
        dayButton.className = "urlaubswunsch-day";
        if (weekday === 0 || weekday === 6) dayButton.classList.add("weekend");
        if (selectedDates.has(date)) dayButton.classList.add("selected");
        dayButton.textContent = String(d);
        dayButton.title = date;
        dayButton.addEventListener("click", () => {
          if (selectedDates.has(date)) {
            selectedDates.delete(date);
          } else {
            selectedDates.add(date);
          }
          saveUrlaubswunschDates(activeYear, selectedDates);
          render();
        });
        daysGrid.appendChild(dayButton);
      }

      month.appendChild(daysGrid);
      months.appendChild(month);
    }
  };

  modal.querySelector("#urlaubswunschClose").addEventListener("click", close);
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", function onKey(event) {
    if (event.key === "Escape" && document.body.contains(backdrop)) {
      close();
      document.removeEventListener("keydown", onKey);
    }
  });

  modal.querySelector("#urlaubswunschPrev").addEventListener("click", () => {
    activeYear -= 1;
    selectedDates = loadUrlaubswunschDates(activeYear);
    render();
  });

  modal.querySelector("#urlaubswunschNext").addEventListener("click", () => {
    activeYear += 1;
    selectedDates = loadUrlaubswunschDates(activeYear);
    render();
  });

  modal.querySelector("#urlaubswunschClear").addEventListener("click", () => {
    if (!selectedDates.size) return;
    if (!confirm(`Alle Urlaubswünsche für ${activeYear} löschen?`)) return;
    selectedDates.clear();
    saveUrlaubswunschDates(activeYear, selectedDates);
    render();
  });

  render();
}

function addUrlaubswunschButton() {
  if (document.getElementById("openUrlaubswunsch")) return;

  const runkeButton = document.getElementById("loadRunke");
  const syncStatus = document.getElementById("syncStatus");
  if (!runkeButton || !runkeButton.parentElement) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "openUrlaubswunsch";
  button.className = "btn-secondary";
  button.textContent = "🌴 Urlaubswunsch";
  button.addEventListener("click", openUrlaubswunschCalendar);

  if (syncStatus && syncStatus.parentElement === runkeButton.parentElement) {
    runkeButton.parentElement.insertBefore(button, syncStatus);
  } else {
    runkeButton.parentElement.appendChild(button);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("dienstpilot_unlocked") === "yes") {
    unlockApp();
  } else {
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
  }

  addUrlaubswunschButton();
});