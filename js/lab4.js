console.log("lab4 loaded");

function addHoverBehavior(layer, baseStyle) {
  layer.on("mouseover", function () {
    layer.setStyle({ weight: 4, fillOpacity: 0.35 });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();
  });

  layer.on("mouseout", function () {
    layer.setStyle(baseStyle);
  });
}
const map = L.map("map").setView([44.5, -114.5], 6);

// --- Mapbox Studio style as raster tiles in Leaflet ---
const MAPBOX_TOKEN = "pk.eyJ1IjoianN3YWxkcnVwIiwiYSI6ImNtbGZoeXBmazAyNTczY29wazN6dnByMDMifQ.b-Mz0bka9Uw85H9hTMV1mg";

const MAPBOX_USERNAME = "jswaldrup";
const MAPBOX_STYLE_ID = "cmm1i7pdy005j01ptfjou4x9d"; // paste YOUR style id

const mapboxBasemap = L.tileLayer(
  `https://api.mapbox.com/styles/v1/${MAPBOX_USERNAME}/${MAPBOX_STYLE_ID}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
  {
    tileSize: 256,
    maxZoom: 22,
    attribution: "© Mapbox © OpenStreetMap"
  }
).addTo(map);

// --- Labels-only overlay (cities/towns) ---
map.createPane("labels");
map.getPane("labels").style.zIndex = 650;
map.getPane("labels").style.pointerEvents = "none";

const placeLabels = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  {
    subdomains: "abcd",
    maxZoom: 20,
    opacity: 0.9,
    pane: "labels",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  }
);

const hrrLabelLayer = L.layerGroup(); // don't add by default

const studyBounds = L.latLngBounds(

  [40.8, -124.9], // SW
  [49.2, -104.0]  // NE
);
map.fitBounds(studyBounds);

// ---- Title + Description ----
const titleControl = L.control({ position: "topright" });

titleControl.onAdd = function () {
  const div = L.DomUtil.create("div", "map-title");
  div.innerHTML = `
    <div style="
      background: rgba(255,255,255,0.95);
      padding: 12px 14px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      font-size: 13px;
      line-height: 1.35;
      max-width: 260px;
    ">
      <div style="font-weight:700; font-size:14px; margin-bottom:0px;">
        Dartmouth Atlas Health Regions
      </div>

      <div style="font-size:11px; font-style:italic; opacity:0.75; margin-bottom:6px;">
        Jon Waldrup · 02/26/2026
      </div>

      <div style="margin-bottom:6px;">
        <b>HRRs (Hospital Referral Regions)</b><br>
        Hospital Referral Regions (HRRs) were originally defined in the
        1996 Dartmouth Atlas of Health Care by aggregating 3,436 hospital
        service areas based on where residents were referred for major
        cardiovascular surgical procedures and neurosurgery
        (Wennberg et al., 1999).
        <br><br>
        <b>HSAs (Hospital Service Areas)</b><br>
        HSAs represent local health care markets for community-based
        inpatient care and were defined by assigning ZIP codes to the
        hospital area where the greatest proportion of residents were
        hospitalized, with adjustments to ensure geographic contiguity
        (NCBI, 2022).
      </div>

      <div style="font-size:12px; opacity:0.85;">
        Check out HRR by clicking a region (organized by city name).
        <br>
        Zoom in to view HSAs.
        <br>
        Click for details.
        <br>
        If hovering over the HRRs doesn't highlight them, try zooming in and out to reset the layers.
        <br><br>
        Data source: Dartmouth Atlas of Health Care.
      </div>
    </div>
  `;
  return div;
};

titleControl.addTo(map);

// ---- Load Idaho boundary ----
fetch("data/idaho.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: {
        color: "#333",
        weight: 2,
        fillOpacity: 0
      }
    }).addTo(map);
  });

// ---- HRR layer ----
let hrrLayer;
fetch("data/hrr.geojson")
  .then(res => res.json())
  .then(data => {

  // define style once so hover can revert properly
  const hrrStyle = {
    color: "#444",
    weight: 2,
    fillColor: "#6baed6",
    fillOpacity: 0.22
  };

  hrrLayer = L.geoJSON(data, {
    style: hrrStyle,
    onEachFeature: function (feature, layer) {

      const name = feature.properties.HRR_lbl || "Unknown";

// --- HRR label at polygon centroid ---
const c = layer.getBounds().getCenter();
L.marker(c, {
  interactive: false,
  icon: L.divIcon({
    className: "hrr-label",
    html: `<div>${name}</div>`
  })
}).addTo(hrrLabelLayer);

const totPop = feature.properties.populationtotals_TOTPOP_CY ?? "N/A";
const popDens = feature.properties.populationtotals_POPDENS_CY ?? "N/A";

const totPopFmt =
  totPop === "N/A" ? totPop : Number(totPop).toLocaleString();

const popDensFmt =
  popDens === "N/A"
    ? popDens
    : Number(popDens).toLocaleString(undefined, { maximumFractionDigits: 1 });

layer.bindPopup(`
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;">
    <div style="font-size:18px; font-weight:700; margin-bottom:2px;">
      ${name}
    </div>
    <div style="font-size:14px; opacity:0.85;">
      Total population: ${totPopFmt}<br>
      Population density: ${popDensFmt}
    </div>
  </div>
`);

addHoverBehavior(layer, hrrStyle);
}   // end onEachFeature
}); // end L.geoJSON

updateLayers();     // run zoom logic after HRR loads
});                 // end fetch

// ---- HSA layer ----
let hsaLayer;
fetch("data/HSAsForPopups.geojson")
  .then(res => res.json())
  .then(data => {
    hsaLayer = L.geoJSON(data, {
  // define style 
  style: (function () {
    const hsaStyle = {
      color: "#666",
      weight: 1,
      fillColor: "#31a354",
      fillOpacity: 0.25
    };
    return function () { return hsaStyle; };
  })(),

  onEachFeature: function (feature, layer) {
    const name = feature.properties.HSA_label || "Unknown";
const popupText = feature.properties.popup_text || feature.properties.CONCATENATE_facility_line || "No facility details available.";

layer.bindPopup(`
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; max-width: 320px;">
    <div style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">
      ${name}
    </div>
    <div style="font-size: 13px; line-height: 1.35;">
      ${popupText}
    </div>
  </div>
`);

    // match above style on mouseout
    addHoverBehavior(layer, {
      color: "#666",
      weight: 1,
      fillColor: "#31a354",
          fillOpacity: 0.25
        });
      }

    });   // ← CLOSE L.geoJSON

  });     // ← CLOSE .then(data

let under30Layer;
let band30to60Layer;
let band60to90Layer;
let band90to120Layer;
let band120to150Layer;
let layerControl; 

function refreshLayerControl() {
  if (layerControl) {
    map.removeControl(layerControl);
  }

  const overlayMaps = {};

  if (hrrLayer) overlayMaps["HRR Regions"] = hrrLayer;
  if (hsaLayer) overlayMaps["HSA Regions"] = hsaLayer;
  if (under30Layer) overlayMaps["Under 30 min"] = under30Layer;
  if (band30to60Layer) overlayMaps["30–60 min"] = band30to60Layer;
  if (band60to90Layer) overlayMaps["60–90 min"] = band60to90Layer;
  if (band90to120Layer) overlayMaps["90–120 min"] = band90to120Layer;
  if (band120to150Layer) overlayMaps["120–150 min"] = band120to150Layer;

  layerControl = L.control.layers(null, overlayMaps, {
    collapsed: false
  }).addTo(map);
}

fetch("data/under30band.geojson")
  .then(res => res.json())
  .then(data => {
    under30Layer = L.geoJSON(data, {
      style: {
        color: "#1b5e20",
        weight: 1,
        fillColor: "#2e7d32",
        fillOpacity: 0.55
      }
    });
    refreshLayerControl();
  });

fetch("data/30to60band.geojson")
  .then(res => res.json())
  .then(data => {
    band30to60Layer = L.geoJSON(data, {
      style: {
        color: "#bfa300",
        weight: 1,
        fillColor: "#f2d94e",
        fillOpacity: 0.5
      }
    });
    refreshLayerControl();
  });

fetch("data/60to90band.geojson")
  .then(res => res.json())
  .then(data => {
    band60to90Layer = L.geoJSON(data, {
      style: {
        color: "#d97a1e",
        weight: 1,
        fillColor: "#f28c52",
        fillOpacity: 0.5
      }
    });
    refreshLayerControl();
  });

fetch("data/90to120band.geojson")
  .then(res => res.json())
  .then(data => {
    band90to120Layer = L.geoJSON(data, {
      style: {
        color: "#a61c1c",
        weight: 1,
        fillColor: "#c62828",
        fillOpacity: 0.5
      }
    });
    refreshLayerControl();
  });

fetch("data/120to150band.geojson")
  .then(res => res.json())
  .then(data => {
    band120to150Layer = L.geoJSON(data, {
      style: {
        color: "#7b1fa2",
        weight: 1,
        fillColor: "#b39ddb",
        fillOpacity: 0.5
      }
    });
    refreshLayerControl();
  });
// ---- Zoom-based switching ----
const HSA_ZOOM = 7;

function updateLayers() {
  const zoom = map.getZoom();

  if (zoom < HSA_ZOOM) {
    // HRR mode
    if (hsaLayer && map.hasLayer(hsaLayer)) map.removeLayer(hsaLayer);
    if (hrrLayer && map.hasLayer(hrrLayer)) map.addLayer(hrrLayer);

    // labels: HRR labels ON, city labels OFF
    if (map.hasLayer(placeLabels)) map.removeLayer(placeLabels);
    if (!map.hasLayer(hrrLabelLayer)) hrrLabelLayer.addTo(map);

  } else {
    // HSA mode
    if (hrrLayer && map.hasLayer(hrrLayer)) map.removeLayer(hrrLayer);
    if (hsaLayer && !map.hasLayer(hsaLayer)) map.addLayer(hsaLayer);

    // labels: HRR labels OFF, city labels ON
    if (map.hasLayer(hrrLabelLayer)) map.removeLayer(hrrLabelLayer);
    if (!map.hasLayer(placeLabels)) placeLabels.addTo(map);
    if (under30Layer && map.hasLayer(under30Layer) && zoom < HSA_ZOOM) map.removeLayer(under30Layer);
    if (band30to60Layer && map.hasLayer(band30to60Layer) && zoom < HSA_ZOOM) map.removeLayer(band30to60Layer);
    if (band60to90Layer && map.hasLayer(band60to90Layer) && zoom < HSA_ZOOM) map.removeLayer(band60to90Layer);
    if (band90to120Layer && map.hasLayer(band90to120Layer) && zoom < HSA_ZOOM) map.removeLayer(band90to120Layer);
    if (band120to150Layer && map.hasLayer(band120to150Layer) && zoom < HSA_ZOOM) map.removeLayer(band120to150Layer);
  }
}

map.on("zoomend", updateLayers);

updateLayers(); // Initial layer setup based on starting zoom
refreshLayerControl();