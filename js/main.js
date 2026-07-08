import { haversineKm } from "./geo.js";
import { fetchLightningWindow, parseSgtInput, formatSgtDisplay } from "./neaApi.js";
import { createLightningMap } from "./map.js";

const STEP_MINUTES = 2; // matches NEA's native reading cadence
const RATE_CYCLE = [1, 2, 4];

const el = {
  form: document.getElementById("query-form"),
  lat: document.getElementById("lat"),
  lon: document.getElementById("lon"),
  startDate: document.getElementById("start-date"),
  startTime: document.getElementById("start-time"),
  endDate: document.getElementById("end-date"),
  endTime: document.getElementById("end-time"),
  status: document.getElementById("status"),
  refreshBtn: document.getElementById("refresh-btn"),
  toggleCircles: document.getElementById("toggle-circles"),
  toggleC2C: document.getElementById("toggle-c2c"),
  toggleC2G: document.getElementById("toggle-c2g"),
  slider: document.getElementById("time-slider"),
  readout: document.getElementById("time-readout"),
  playBtn: document.getElementById("play-btn"),
  ffBtn: document.getElementById("ff-btn"),
  c2cBody: document.querySelector("#c2c-table tbody"),
  c2gBody: document.querySelector("#c2g-table tbody"),
};

let lightningMap = null;
let events = [];
let plottedIds = new Set();
let windowStart = null;
let playTimer = null;
let rateIndex = 0;

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
el.slider.addEventListener("input", () => {
  plotUpToStep(Number(el.slider.value));
});
el.playBtn.addEventListener("click", togglePlay);
el.ffBtn.addEventListener("click", cycleRate);

function toggleLayer(layer, show) {
  if (!layer || !lightningMap) return;
  if (show) lightningMap.map.addLayer(layer);
  else lightningMap.map.removeLayer(layer);
}

function restoreLocationFromRefresh() {
  const saved = sessionStorage.getItem("lightning-location");
  if (!saved) return;
  sessionStorage.removeItem("lightning-location");
  try {
    const { lat, lon } = JSON.parse(saved);
    el.lat.value = lat;
    el.lon.value = lon;
  } catch {
    // ignore malformed storage
  }
}

function onRefresh() {
  const lat = el.lat.value.trim();
  const lon = el.lon.value.trim();
  if (lat && lon) {
    sessionStorage.setItem("lightning-location", JSON.stringify({ lat, lon }));
  }
  location.reload();
}

async function onSubmit(e) {
  e.preventDefault();
  stopPlay();

  const lat = Number(el.lat.value);
  const lon = Number(el.lon.value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    setStatus("Please enter a valid latitude and longitude.", true);
    return;
  }

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
      .filter((r) => r.distanceKm <= 6)
      .sort((a, b) => a.time - b.time);

    setupMap(lat, lon);
    setupTimeline(start, end);
    clearTables();
    plottedIds = new Set();

    setStatus(`${events.length} strike${events.length === 1 ? "" : "s"} within 6km of the given location.`);
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
  plotUpToStep(0);
}

function stepToTime(step) {
  return new Date(windowStart.getTime() + step * STEP_MINUTES * 60 * 1000);
}

function updateReadout(step) {
  el.readout.textContent = formatSgtDisplay(stepToTime(step));
}

function plotUpToStep(step) {
  updateReadout(step);
  const t = stepToTime(step);
  events.forEach((event, idx) => {
    if (plottedIds.has(idx) || event.time > t) return;
    plottedIds.add(idx);
    if (event.type === "C2C") {
      lightningMap.plotC2C({ ...event, displayTime: formatSgtDisplay(event.time) });
      addRow(el.c2cBody, event);
    } else {
      lightningMap.plotC2G({ ...event, displayTime: formatSgtDisplay(event.time) });
      addRow(el.c2gBody, event);
    }
  });
}

function addRow(tbody, event) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${event.lat.toFixed(4)}</td><td>${event.lon.toFixed(4)}</td>` +
    `<td>${formatSgtDisplay(event.time)}</td><td>${event.distanceKm.toFixed(2)}</td>`;
  tbody.appendChild(tr);
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
    plottedIds = new Set();
    clearTables();
    lightningMap.clearMarkers();
    plotUpToStep(0);
  }
  el.playBtn.innerHTML = "&#9208; Pause";
  playTimer = setInterval(() => {
    const next = Number(el.slider.value) + RATE_CYCLE[rateIndex];
    const max = Number(el.slider.max);
    if (next >= max) {
      el.slider.value = String(max);
      plotUpToStep(max);
      stopPlay();
    } else {
      el.slider.value = String(next);
      plotUpToStep(next);
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
