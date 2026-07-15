import { haversineKm, parseLatLon } from "./geo.js";
import { fetchLightningWindow, fetchTwoHrForecastWindow, parseSgtInput, formatSgtDisplay } from "./neaApi.js";
import { createLightningMap } from "./map.js";
import { FORECAST_LEGEND } from "./forecastColors.js";

const STEP_MINUTES = 2; // matches NEA's native reading cadence
const RATE_CYCLE = [1, 2, 4];

const el = {
  form: document.getElementById("query-form"),
  location: document.getElementById("location"),
  startDate: document.getElementById("start-date"),
  startTime: document.getElementById("start-time"),
  endDate: document.getElementById("end-date"),
  endTime: document.getElementById("end-time"),
  status: document.getElementById("status"),
  refreshBtn: document.getElementById("refresh-btn"),
  toggleCircles: document.getElementById("toggle-circles"),
  toggleC2C: document.getElementById("toggle-c2c"),
  toggleC2G: document.getElementById("toggle-c2g"),
  toggleCloud: document.getElementById("toggle-cloud"),
  cloudLegendItems: document.getElementById("cloud-legend-items"),
  slider: document.getElementById("time-slider"),
  readout: document.getElementById("time-readout"),
  playBtn: document.getElementById("play-btn"),
  ffBtn: document.getElementById("ff-btn"),
  c2cBody: document.querySelector("#c2c-table tbody"),
  c2gBody: document.querySelector("#c2g-table tbody"),
};

let lightningMap = null;
let events = [];
let plotted = new Map(); // event index -> { marker, row }
let windowStart = null;
let playTimer = null;
let rateIndex = 0;
let forecastAreaMetadata = [];
let forecastSnapshots = [];
let activeForecastIssuedAt = null;

renderCloudLegend();
restoreLocationFromRefresh();

el.form.addEventListener("submit", onSubmit);
el.refreshBtn.addEventListener("click", onRefresh);
el.toggleCircles.addEventListener("change", () => {
  toggleLayer(lightningMap?.circleLayer, el.toggleCircles.checked);
});
el.toggleC2C.addEventListener("change", () => {
  toggleLayer(lightningMap?.c2cLayer, el.toggleC2C.checked);
});
el.toggleC2G.addEventListener("change", () => {
  toggleLayer(lightningMap?.c2gLayer, el.toggleC2G.checked);
});
el.toggleCloud.addEventListener("change", () => {
  toggleLayer(lightningMap?.forecastLayer, el.toggleCloud.checked);
});
el.slider.addEventListener("input", () => {
  syncToStep(Number(el.slider.value));
});
el.playBtn.addEventListener("click", togglePlay);
el.ffBtn.addEventListener("click", cycleRate);

function renderCloudLegend() {
  el.cloudLegendItems.innerHTML = FORECAST_LEGEND.map(
    ({ label, color }) =>
      `<div class="cloud-legend-item"><span class="cloud-legend-swatch" style="background:${color}"></span>${label}</div>`
  ).join("");
}

function toggleLayer(layer, show) {
  if (!layer || !lightningMap) return;
  if (show) lightningMap.map.addLayer(layer);
  else lightningMap.map.removeLayer(layer);
}

function restoreLocationFromRefresh() {
  const saved = sessionStorage.getItem("lightning-location");
  if (!saved) return;
  sessionStorage.removeItem("lightning-location");
  el.location.value = saved;
}

function onRefresh() {
  const value = el.location.value.trim();
  if (value) {
    sessionStorage.setItem("lightning-location", value);
  }
  location.reload();
}

async function onSubmit(e) {
  e.preventDefault();
  stopPlay();

  const coords = parseLatLon(el.location.value);
  if (!coords) {
    setStatus("Please enter a valid “lat, lon” pair (e.g. pasted from Google Maps).", true);
    return;
  }
  const { lat, lon } = coords;

  const start = parseSgtInput(el.startDate.value, el.startTime.value);
  const end = parseSgtInput(el.endDate.value, el.endTime.value);
  if (!start || !end) {
    setStatus("Please enter dates as dd/mm/yy and times as a 4-digit 24h value (e.g. 1430).", true);
    return;
  }
  if (start >= end) {
    setStatus("Start must be before End.", true);
    return;
  }

  setStatus("Loading lightning data…");
  el.slider.disabled = true;
  el.playBtn.disabled = true;
  el.ffBtn.disabled = true;

  try {
    const raw = await fetchLightningWindow(start, end, ({ pages, readings }) => {
      setStatus(`Loading lightning data… (${pages} page${pages === 1 ? "" : "s"}, ${readings} strikes found so far)`);
    });

    events = raw
      .map((r) => ({ ...r, distanceKm: haversineKm(lat, lon, r.lat, r.lon) }))
      .filter((r) => r.distanceKm <= 12)
      .sort((a, b) => a.time - b.time);

    plotted = new Map();
    clearTables();
    forecastAreaMetadata = [];
    forecastSnapshots = [];
    activeForecastIssuedAt = null;
    setupMap(lat, lon);
    setupTimeline(start, end);

    setStatus(`${events.length} strike${events.length === 1 ? "" : "s"} within 12km of the given location.`);

    try {
      const { areaMetadata, snapshots } = await fetchTwoHrForecastWindow(start, end, ({ done, total }) => {
        setStatus(`${events.length} strike${events.length === 1 ? "" : "s"} within 12km. Loading cloud cover… (${done}/${total})`);
      });
      forecastAreaMetadata = areaMetadata;
      forecastSnapshots = snapshots;
      activeForecastIssuedAt = null;
      syncToStep(Number(el.slider.value));
      setStatus(`${events.length} strike${events.length === 1 ? "" : "s"} within 12km of the given location.`);
    } catch (forecastErr) {
      console.error(forecastErr);
      forecastAreaMetadata = [];
      forecastSnapshots = [];
      setStatus(`${events.length} strike${events.length === 1 ? "" : "s"} within 12km. Cloud cover unavailable: ${forecastErr.message}`, true);
    }
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, true);
  }
}

function setStatus(msg, isError = false) {
  el.status.textContent = msg;
  el.status.style.color = isError ? "#ff6b6b" : "";
}

function setupMap(lat, lon) {
  if (lightningMap) {
    lightningMap.map.remove();
  }
  lightningMap = createLightningMap("map", lat, lon);
  toggleLayer(lightningMap.circleLayer, el.toggleCircles.checked);
  toggleLayer(lightningMap.c2cLayer, el.toggleC2C.checked);
  toggleLayer(lightningMap.c2gLayer, el.toggleC2G.checked);
  toggleLayer(lightningMap.forecastLayer, el.toggleCloud.checked);
}

function setupTimeline(start, end) {
  windowStart = start;
  const totalSteps = Math.max(1, Math.round((end - start) / (STEP_MINUTES * 60 * 1000)));
  el.slider.min = "0";
  el.slider.max = String(totalSteps);
  el.slider.value = "0";
  el.slider.disabled = false;
  el.playBtn.disabled = false;
  el.ffBtn.disabled = false;
  rateIndex = 0;
  el.ffBtn.textContent = `⏭ x${RATE_CYCLE[rateIndex]}`;
  updateReadout(0);
  syncToStep(0);
}

function stepToTime(step) {
  return new Date(windowStart.getTime() + step * STEP_MINUTES * 60 * 1000);
}

function updateReadout(step) {
  el.readout.textContent = formatSgtDisplay(stepToTime(step));
}

// Adds markers/rows for events now within [windowStart, t], and removes ones
// that were plotted but are now after t (i.e. the slider scrubbed back past them).
function syncToStep(step) {
  updateReadout(step);
  const t = stepToTime(step);
  applyForecastForTime(t);
  events.forEach((event, idx) => {
    const visible = event.time <= t;
    const existing = plotted.get(idx);
    if (visible && !existing) {
      const marker = event.type === "C2C"
        ? lightningMap.plotC2C({ ...event, displayTime: formatSgtDisplay(event.time) })
        : lightningMap.plotC2G({ ...event, displayTime: formatSgtDisplay(event.time) });
      const row = addRow(event.type === "C2C" ? el.c2cBody : el.c2gBody, event);
      plotted.set(idx, { marker, row });
    } else if (!visible && existing) {
      existing.marker.remove();
      existing.row.remove();
      plotted.delete(idx);
    }
  });
}

// Picks the most recent forecast snapshot issued at or before time `t` and
// (re)draws the cloud cover layer, but only when the active snapshot actually
// changes — avoids redrawing/reopening popups on every 2-min slider step when
// the forecast (issued every 30 min) hasn't moved on.
function applyForecastForTime(t) {
  if (!lightningMap || forecastSnapshots.length === 0) return;
  let candidate = null;
  for (const snap of forecastSnapshots) {
    if (snap.issuedAt <= t) candidate = snap;
    else break;
  }
  candidate = candidate ?? forecastSnapshots[0];
  if (candidate.issuedAt.getTime() === activeForecastIssuedAt) return;
  activeForecastIssuedAt = candidate.issuedAt.getTime();
  lightningMap.setForecastAreas(
    { ...candidate, issuedLabel: formatSgtDisplay(candidate.issuedAt) },
    forecastAreaMetadata
  );
}

function addRow(tbody, event) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${event.lat.toFixed(4)}</td><td>${event.lon.toFixed(4)}</td>` +
    `<td>${formatSgtDisplay(event.time)}</td><td>${event.distanceKm.toFixed(2)}</td>`;
  tbody.appendChild(tr);
  return tr;
}

function clearTables() {
  el.c2cBody.innerHTML = "";
  el.c2gBody.innerHTML = "";
}

function togglePlay() {
  if (playTimer) {
    stopPlay();
  } else {
    startPlay();
  }
}

function startPlay() {
  if (Number(el.slider.value) >= Number(el.slider.max)) {
    el.slider.value = "0";
    syncToStep(0);
  }
  el.playBtn.innerHTML = "&#9208; Pause";
  playTimer = setInterval(() => {
    const next = Number(el.slider.value) + RATE_CYCLE[rateIndex];
    const max = Number(el.slider.max);
    if (next >= max) {
      el.slider.value = String(max);
      syncToStep(max);
      stopPlay();
    } else {
      el.slider.value = String(next);
      syncToStep(next);
    }
  }, 1000);
}

function stopPlay() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  el.playBtn.innerHTML = "&#9654; Play";
}

function cycleRate() {
  rateIndex = (rateIndex + 1) % RATE_CYCLE.length;
  el.ffBtn.textContent = `⏭ x${RATE_CYCLE[rateIndex]}`;
}
