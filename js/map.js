import { squareBoundsKm } from "./geo.js";
import { classifyForecast } from "./forecastColors.js";

const HALF_SQUARE_KM = 14; // 28km x 28km square, given location at centre
const CIRCLE_INTERVAL_KM = 2;
const CIRCLE_MAX_KM = 8;

function boltIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22">
      <path d="M13 2 L4 14 h6 l-2 8 9-13 h-6 z"
            fill="${color}" stroke="#000" stroke-width="1" stroke-linejoin="round"/>
    </svg>`;
  return L.divIcon({
    className: "bolt-icon",
    html: svg,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function createLightningMap(containerId, centerLat, centerLon) {
  const map = L.map(containerId, {
    zoomControl: true,
    maxBoundsViscosity: 1.0,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  const box = squareBoundsKm(centerLat, centerLon, HALF_SQUARE_KM);
  const bounds = L.latLngBounds([box.south, box.west], [box.north, box.east]);
  map.fitBounds(bounds);
  map.setMaxBounds(bounds.pad(0.05));
  map.setMinZoom(map.getBoundsZoom(bounds));

  L.marker([centerLat, centerLon], {
    title: "Given Location",
    zIndexOffset: 1000,
  })
    .addTo(map)
    .bindPopup("Given Location");

  const circleLayer = L.layerGroup();
  for (let r = CIRCLE_INTERVAL_KM; r <= CIRCLE_MAX_KM; r += CIRCLE_INTERVAL_KM) {
    L.circle([centerLat, centerLon], {
      radius: r * 1000,
      color: "red",
      weight: 2,
      fill: false,
    }).addTo(circleLayer);
  }
  circleLayer.addTo(map);

  const c2cLayer = L.layerGroup().addTo(map);
  const c2gLayer = L.layerGroup().addTo(map);
  const c2cIcon = boltIcon("#ffffff");
  const c2gIcon = boltIcon("#ffd700");

  const forecastLayer = L.layerGroup();
  const AREA_RADIUS_M = 2200;

  // Draws one circle per forecast area whose label falls within the base map
  // square, colour-coded by classifyForecast. Replaces whatever was drawn for
  // the previous snapshot.
  function setForecastAreas(snapshot, areaMetadata) {
    forecastLayer.clearLayers();
    if (!snapshot) return;

    const locByArea = new Map(areaMetadata.map((a) => [a.name, a.label_location]));
    snapshot.forecasts.forEach(({ area, forecast }) => {
      const loc = locByArea.get(area);
      if (!loc) return;
      if (loc.latitude < box.south || loc.latitude > box.north || loc.longitude < box.west || loc.longitude > box.east) {
        return;
      }
      const info = classifyForecast(forecast);
      L.circle([loc.latitude, loc.longitude], {
        radius: AREA_RADIUS_M,
        color: info.color,
        weight: 1,
        fillColor: info.color,
        fillOpacity: 0.25,
      })
        .addTo(forecastLayer)
        .bindPopup(`<strong>${area}</strong><br>${forecast}<br>Issued ${snapshot.issuedLabel ?? ""}`);
    });
  }

  function plotC2C(event) {
    return L.marker([event.lat, event.lon], { icon: c2cIcon }).addTo(c2cLayer).bindPopup(
      `Cloud to Cloud<br>${event.displayTime}<br>${event.distanceKm.toFixed(2)} km away`
    );
  }

  function plotC2G(event) {
    return L.marker([event.lat, event.lon], { icon: c2gIcon }).addTo(c2gLayer).bindPopup(
      `Cloud to Ground<br>${event.displayTime}<br>${event.distanceKm.toFixed(2)} km away`
    );
  }

  return {
    map,
    circleLayer,
    c2cLayer,
    c2gLayer,
    forecastLayer,
    plotC2C,
    plotC2G,
    setForecastAreas,
  };
}
