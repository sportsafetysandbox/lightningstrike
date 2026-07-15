const EARTH_RADIUS_KM = 6371;

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Parses a pasted "lat, lon" pair (e.g. copied straight from Google Maps,
// which puts "1.352083, 103.819836" on the clipboard when you click a
// location). Accepts comma and/or whitespace as the separator, and tolerates
// a surrounding degree symbol. Returns { lat, lon } or null if invalid.
export function parseLatLon(text) {
  if (!text) return null;
  const cleaned = text.trim().replace(/°/g, "");
  const parts = cleaned.split(/[,\s]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

// Bounding box offset by `km` in each cardinal direction from (lat, lon),
// correcting the longitude delta for latitude so the box is square in real distance.
export function squareBoundsKm(lat, lon, km) {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.cos(toRad(lat)));
  return {
    north: lat + dLat,
    south: lat - dLat,
    east: lon + dLon,
    west: lon - dLon,
  };
}
