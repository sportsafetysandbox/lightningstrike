import { squareBoundsKm } from "./geo.js";

const HALF_SQUARE_KM = 12; // 24km x 24km square, given location at centre
const CIRCLE_INTERVAL_KM = 2;
const CIRCLE_MAX_KM = 10;

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
    plotC2C,
    plotC2G,
  };
}
