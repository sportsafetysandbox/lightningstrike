const API_URL = "https://api-open.data.gov.sg/v2/real-time/api/weather";
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_PAGES = 1000; // safety cap (~35 days at 25 records/2min per page)

// Parse a dd/mm/yy date + 4-digit 24h time string as Singapore local time,
// returning a real epoch-based Date regardless of the browser's own timezone.
export function parseSgtInput(ddmmyy, hhmm) {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(ddmmyy.trim());
  const t = /^(\d{2})(\d{2})$/.exec(hhmm.trim());
  if (!m || !t) return null;
  const [, dd, mm, yy] = m;
  const [, hh, min] = t;
  const yyyy = 2000 + Number(yy);
  if (Number(hh) > 23 || Number(min) > 59) return null;
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:00+08:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// Format an epoch-based Date as an SGT "YYYY-MM-DDTHH:mm:ss" string for the API's `date` param.
export function formatSgtParam(date) {
  const shifted = new Date(date.getTime() + SGT_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
  );
}

// Format an epoch-based Date as SGT "dd/mm/yy HHmm hrs" for display.
export function formatSgtDisplay(date) {
  const shifted = new Date(date.getTime() + SGT_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, "0");
  const yy = String(shifted.getUTCFullYear()).slice(2);
  return (
    `${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)}/${yy} ` +
    `${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())} hrs`
  );
}

async function fetchPage(dateParam, paginationToken, attempt = 0) {
  const url = new URL(API_URL);
  url.searchParams.set("api", "lightning");
  url.searchParams.set("date", dateParam);
  if (paginationToken) url.searchParams.set("paginationToken", paginationToken);

  const res = await fetch(url.toString());
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return fetchPage(dateParam, paginationToken, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`NEA API request failed (${res.status})`);
  }
  const body = await res.json();
  if (body.code !== 0) {
    throw new Error(body.errorMsg || "NEA API returned an error");
  }
  return body.data;
}

// Fetches every lightning reading between startDate and endDate (inclusive), paginating
// backward from endDate. Returns a flat array of { lat, lon, type, text, time } sorted ascending.
export async function fetchLightningWindow(startDate, endDate, onProgress) {
  const readings = [];
  let dateParam = formatSgtParam(endDate);
  let paginationToken = undefined;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const data = await fetchPage(dateParam, paginationToken);
    pages += 1;

    let oldestInPage = null;
    for (const record of data.records ?? []) {
      const recordTime = new Date(record.datetime);
      if (oldestInPage === null || recordTime < oldestInPage) oldestInPage = recordTime;
      for (const r of record.item?.readings ?? []) {
        const time = new Date(r.datetime);
        if (time < startDate || time > endDate) continue;
        readings.push({
          lat: Number(r.location.latitude),
          lon: Number(r.location.longitude),
          type: r.type === "G" ? "C2G" : "C2C",
          text: r.text,
          time,
        });
      }
    }

    onProgress?.({ pages, readings: readings.length });

    if (!data.paginationToken || (oldestInPage && oldestInPage < startDate)) break;
    paginationToken = data.paginationToken;
  }

  readings.sort((a, b) => a.time - b.time);
  return readings;
}
