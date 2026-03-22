/* =========================================================
Idaho Healthcare Access Map
Drivetime Trade Areas + Functional Healthcare Regions around regional hospitals.
Jon Waldrup
========================================================= */

console.log("idahohealthcare loaded");

function addHoverBehavior(layer, baseStyle) {
  layer.on("mouseover", function () {
    layer.setStyle({ weight: 4, fillOpacity: 0.35 });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();
  });

  layer.on("mouseout", function () {
    layer.setStyle(baseStyle);
  });
}

// add mapclick enabler
let enableMapClick = false;

/* =======================
   GLOBAL DATA STORAGE
============================ */

let hrrDataGlobal = null;
let hsaDataGlobal = null;

let zeroToThirtyData = null;
let thirtyToSixtyData = null;
let sixtyToNinetyData = null;
let ninetyToOneTwentyData = null;
let oneTwentyToOneFiftyData = null;

let HospitalsLayer;

let searchMarker = null;
let nearestLine = null;
let nearestLineHalo = null;
let nearestLnDHalo = null;
let distanceLabel = null;
let hospitalMarker = null;
let hospitalLabel = null;
let resultsPanel = null;

let nearestLnDHospitalLabel;
let nearestLnDLine = null;
let nearestLnDMarker = null;
let nearestLnDLabel = null;
let nearestLnDDistanceLabel = null;

/* ===============================
   MAP SETUP
================================ */

// Extent layer bounds from ArcGIS Pro (Web Mercator meters)
const rasterBounds = L.latLngBounds(
  [42.0, -118.5],
  [49.0, -108.5]
);

const map = L.map("map", {
  minZoom: 6,
  maxZoom: 12
});

map.fitBounds(rasterBounds.pad(0.22));

// --- Mapbox Studio style as raster tiles in Leaflet ---
const MAPBOX_TOKEN = "pk.eyJ1IjoianN3YWxkcnVwIiwiYSI6ImNtbGZoeXBmazAyNTczY29wazN6dnByMDMifQ.b-Mz0bka9Uw85H9hTMV1mg";

const MAPBOX_USERNAME = "jswaldrup";
const MAPBOX_STYLE_ID = "cmmoca1zh003x01rn6yrq472o";

const STYLE_BUST = "20260318roads1";

const mapboxBasemap = L.tileLayer(
  `https://api.mapbox.com/styles/v1/${MAPBOX_USERNAME}/${MAPBOX_STYLE_ID}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}&v=${STYLE_BUST}`,
  {
    tileSize: 512,
    zoomOffset: -1,
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
/*
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
*/

/*
// ---- Load Idaho boundary ----
fetch("data/idaho.geojson")
  .then(res => res.json())
  .then(data => {
    idahoBoundaryLayer = L.geoJSON(data, {
      style: {
        color: "#333",
        weight: 2,
        fillOpacity: 0
      }
    }).addTo(map);

    idahoBoundaryLayer.bringToFront();
  });
  */

// ---- HRR layer ----
let hrrLayer;
fetch("data/hrr.geojson")
  .then(res => res.json())
  .then(data => {
    hrrDataGlobal = data;

    // define style once so hover can revert properly
    const hrrStyle = {
      color: "#000000",
      weight: 0.2,
      opacity: 0.9,
      fillColor: "#000000",
      fillOpacity: 0.02
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
    hsaDataGlobal = data;
    const hsaStyle = {
      color: "#000000",
      weight: 0.1,
      opacity: 0.9,
      fillColor: "#f4b6c2",
      fillOpacity: 0.01
    };

    hsaLayer = L.geoJSON(data, {
      style: function () {
        return hsaStyle;
      },

      onEachFeature: function (feature, layer) {
        const name = feature.properties.HSA_label || "Unknown";
        const popupText =
          feature.properties.popup_text ||
          feature.properties.CONCATENATE_facility_line ||
          "No details available";

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

        addHoverBehavior(layer, hsaStyle);
      }
    });

    updateLayers();
  });

let ZeroToThirtyLayer;
let ThirtyTo60Layer;
let SixtyToNinetyLayer;
let NinetyToOneTwentyLayer;
let OneTwentyToOneFiftyLayer;
let layerControl;

function refreshLayerControl() {
  if (layerControl) {
    map.removeControl(layerControl);
  }

  const overlayMaps = {};

  if (hrrLayer) overlayMaps["HRR Regions"] = hrrLayer;
  if (hsaLayer) overlayMaps["HSA Regions"] = hsaLayer;
  if (HospitalsLayer) overlayMaps["Hospitals"] = HospitalsLayer;

  layerControl = L.control.layers(null, overlayMaps, {
    collapsed: false
  }).addTo(map);
}

const hiddenDriveStyle = {
  stroke: false,
  fillOpacity: 0
};

fetch("data/ZeroToThirty.geojson")
  .then(res => res.json())
  .then(data => {
    zeroToThirtyData = data;
    ZeroToThirtyLayer = L.geoJSON(data, {
      style: styleZeroToThirty,
      interactive: false
    }).addTo(map);

    refreshLayerControl();
  });

fetch("data/ThirtyTo60.geojson")
  .then(res => res.json())
  .then(data => {
    thirtyToSixtyData = data;
    ThirtyTo60Layer = L.geoJSON(data, {
      style: styleThirtyTo60,
      interactive: false
    }).addTo(map);

    refreshLayerControl();
  });

fetch("data/SixtyToNinety.geojson")
  .then(res => res.json())
  .then(data => {
    sixtyToNinetyData = data;
    SixtyToNinetyLayer = L.geoJSON(data, {
      style: styleSixtyToNinety,
      interactive: false
    }).addTo(map);

    refreshLayerControl();
  });

fetch("data/NinetyToOneTwenty.geojson")
  .then(res => res.json())
  .then(data => {
    ninetyToOneTwentyData = data;
    NinetyToOneTwentyLayer = L.geoJSON(data, {
      style: styleNinetyToOneTwenty,
      interactive: false
    }).addTo(map);

    refreshLayerControl();
  });

fetch("data/OneTwentyToOneFifty.geojson")
  .then(res => res.json())
  .then(data => {
    oneTwentyToOneFiftyData = data;
    OneTwentyToOneFiftyLayer = L.geoJSON(data, {
      style: styleOneTwentyToOneFifty,
      interactive: false
    }).addTo(map);

    refreshLayerControl();
  });

function yesNo(value) {
  return value == 1 ? "Yes" : "No";
}

fetch("data/Hospitals.geojson")
  .then(res => res.json())
  .then(data => {
    HospitalsLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 6,
          color: "#000000",
          weight: 1,
          fillColor: "#ffffff",
          fillOpacity: 1
        });
      },
      onEachFeature: function (feature, layer) {
        const props = feature.properties;
        layer.bindPopup(`
          <strong>${props.name || props.NAME || "Hospital"}</strong><br>
          ${props.city || props.CITY || ""}
        `);
      }
    });
    refreshLayerControl();
  });

// add helper functions
function findContainingFeature(featureCollection, lng, lat) {
  if (!featureCollection || !featureCollection.features) return null;

  const pt = turf.point([lng, lat]);

  for (const feature of featureCollection.features) {
    if (turf.booleanPointInPolygon(pt, feature)) {
      return feature;
    }
  }

  return null;
}

function getDriveOpacity() {
  const z = map.getZoom();

  if (z <= 7) return 1.0;
  if (z === 8) return 0.65;
  if (z === 9) return 0.25;
  return 0.0;
}

function styleZeroToThirty() {
  return {
    stroke: false,
    fillColor: "#2F5C3C",
    fillOpacity: getDriveOpacity()
  };
}

function styleThirtyTo60() {
  return {
    stroke: false,
    fillColor: "#FFDF5A",
    fillOpacity: getDriveOpacity()
  };
}

function styleSixtyToNinety() {
  return {
    stroke: false,
    fillColor: "#F58B54",
    fillOpacity: getDriveOpacity()
  };
}

function styleNinetyToOneTwenty() {
  return {
    stroke: false,
    fillColor: "#B82911",
    fillOpacity: getDriveOpacity()
  };
}

function styleOneTwentyToOneFifty() {
  return {
    stroke: false,
    fillColor: "#B77FE5",
    fillOpacity: getDriveOpacity() * 0.54
  };
}

function updateDriveLayers() {
  if (ZeroToThirtyLayer) ZeroToThirtyLayer.setStyle(styleZeroToThirty());
  if (ThirtyTo60Layer) ThirtyTo60Layer.setStyle(styleThirtyTo60());
  if (SixtyToNinetyLayer) SixtyToNinetyLayer.setStyle(styleSixtyToNinety());
  if (NinetyToOneTwentyLayer) NinetyToOneTwentyLayer.setStyle(styleNinetyToOneTwenty());
  if (OneTwentyToOneFiftyLayer) OneTwentyToOneFiftyLayer.setStyle(styleOneTwentyToOneFifty());
}

function getDriveTimeLabel(lng, lat) {
  if (findContainingFeature(zeroToThirtyData, lng, lat)) return "0–30 min";
  if (findContainingFeature(thirtyToSixtyData, lng, lat)) return "30–60 min";
  if (findContainingFeature(sixtyToNinetyData, lng, lat)) return "60–90 min";
  if (findContainingFeature(ninetyToOneTwentyData, lng, lat)) return "90–120 min";
  if (findContainingFeature(oneTwentyToOneFiftyData, lng, lat)) return "120–150 min";
  return "Outside mapped drivetime bands";
}

// ---- Zoom-based switching ----
function updateLayers() {
  if (!map.hasLayer(placeLabels)) placeLabels.addTo(map);
  if (map.hasLayer(hrrLabelLayer)) map.removeLayer(hrrLabelLayer);
}

/*
map.on("zoomend", function () {
  updateLayers();
  updateDriveLayers();
  if (idahoBoundaryLayer) idahoBoundaryLayer.bringToFront();
});
*/

const IDENTIFY_MIN_ZOOM = 7;

// Map click handler
map.on("click", function (e) {
  if (!enableMapClick) return;
  const lng = e.latlng.lng;
  const lat = e.latlng.lat;

  const hrrFeature = findContainingFeature(hrrDataGlobal, lng, lat);
  const hsaFeature = findContainingFeature(hsaDataGlobal, lng, lat);
  const driveTimeLabel = getDriveTimeLabel(lng, lat);

  const hrrName = hrrFeature
    ? (hrrFeature.properties.HRR_lbl || hrrFeature.properties.HRR_label || "HRR found")
    : "None";

  const hsaName = hsaFeature
    ? (hsaFeature.properties.HSA_label || "HSA found")
    : "None";

  const panel = document.getElementById("info-panel");

  panel.innerHTML = `
  <div class="panel-block">
    <strong style="font-size:14px; display:block; margin-bottom:6px; letter-spacing:0.3px;">
      Map summary
  </strong>
    <strong>HRR:</strong> ${hrrName}<br>
    <strong>HSA:</strong> ${hsaName}<br>
    <strong>Drivetime:</strong> ${driveTimeLabel || "None"}<br>
    <strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}
  </div>
`;
});

updateLayers();
updateDriveLayers();
refreshLayerControl();

/* =========================================
   CLEAR PREVIOUS SEARCH DISPLAY
========================================= */

function clearSearchDisplay() {

  if (searchMarker && map.hasLayer(searchMarker)) {
    map.removeLayer(searchMarker);
    searchMarker = null;
  }

  if (nearestLine && map.hasLayer(nearestLine)) {
    map.removeLayer(nearestLine);
    nearestLine = null;
  }

  if (nearestLineHalo && map.hasLayer(nearestLineHalo)) {
    map.removeLayer(nearestLineHalo);
    nearestLineHalo = null;
  }

  if (nearestLnDLine && map.hasLayer(nearestLnDLine)) {
    map.removeLayer(nearestLnDLine);
    nearestLnDLine = null;
  }

  if (nearestLnDHalo && map.hasLayer(nearestLnDHalo)) {
    map.removeLayer(nearestLnDHalo);
    nearestLnDHalo = null;
  }

  if (nearestLnDMarker && map.hasLayer(nearestLnDMarker)) {
    map.removeLayer(nearestLnDMarker);
    nearestLnDMarker = null;
  }

  if (nearestLnDLabel && map.hasLayer(nearestLnDLabel)) {
    map.removeLayer(nearestLnDLabel);
    nearestLnDLabel = null;
  }

  if (distanceLabel && map.hasLayer(distanceLabel)) {
    map.removeLayer(distanceLabel);
    distanceLabel = null;
  }

  if (hospitalMarker && map.hasLayer(hospitalMarker)) {
    map.removeLayer(hospitalMarker);
    hospitalMarker = null;
  }

  if (hospitalLabel && map.hasLayer(hospitalLabel)) {
    map.removeLayer(hospitalLabel);
    hospitalLabel = null;
  }

  if (nearestLnDHospitalLabel && map.hasLayer(nearestLnDHospitalLabel)) {
    map.removeLayer(nearestLnDHospitalLabel);
    nearestLnDHospitalLabel = null;
  }
}

/* =========================================
   DRAW SEARCH RESULT
========================================= */
function drawNearestResult(searchLat, searchLon, feature, distanceMiles, infoPanel) {
  const coords = feature.geometry.coordinates;
  const nearestLon = coords[0];
  const nearestLat = coords[1];

  nearestLineHalo = L.polyline(
    [
      [searchLat, searchLon],
      [nearestLat, nearestLon]
    ],
    {
      color: "#ffffff",
      weight: 6,
      opacity: 0.9
    }
  ).addTo(map);

  nearestLine = L.polyline(
    [
      [searchLat, searchLon],
      [nearestLat, nearestLon]
    ],
    {
      color: "#1f4e79",
      weight: 3,
      opacity: 1
    }
  ).addTo(map);

  hospitalMarker = L.circleMarker([nearestLat, nearestLon], {
    radius: 8,
    color: "#ffffff",
    weight: 2,
    fillColor: "#2F5C3C",
    fillOpacity: 1
  }).addTo(map);

  const hospName =
    feature.properties.USER_NAME ||
    feature.properties.NAME ||
    feature.properties.name ||
    "Hospital";

  const hospCity =
    feature.properties.USER_CITY ||
    feature.properties.CITY ||
    feature.properties.city ||
    "";

  const hospState =
    feature.properties.USER_STATE ||
    feature.properties.STATE ||
    feature.properties.state ||
    "";

  const hospAddress =
    feature.properties.USER_ADDRESS ||
    feature.properties.ADDRESS ||
    feature.properties.address ||
    "";

  hospitalLabel = L.marker([nearestLat, nearestLon], {
    icon: L.divIcon({
      className: "hospital-label",
      html: `
      <div class="result-label">
        <div class="result-label-title">${hospName}</div>
        <div class="result-label-subtitle">Nearest Hospital</div>
      </div>
    `,
      iconSize: [300, 34],
      iconAnchor: [-10, 20]
    })
  }).addTo(map);

  const midLat = (searchLat + nearestLat) / 2;
  const midLon = (searchLon + nearestLon) / 2;

  const dx = nearestLon - searchLon;
  const dy = nearestLat - searchLat;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;

  const offset = 0.015;
  const offsetLat = (-dx / length) * offset;
  const offsetLon = (dy / length) * offset;

  distanceLabel = L.marker([midLat + offsetLat, midLon + offsetLon], {
    icon: L.divIcon({
      className: "distance-label",
      html: `<div>${distanceMiles.toFixed(1)} mi</div>`,
      iconSize: [70, 20]
    })
  }).addTo(map);

  if (infoPanel) {
    const p = feature.properties;

    // Build panel shell
    resultsPanel.innerHTML = `
    <div class="panel-block">
      <div class="result-toggle" style="display:flex; gap:6px; margin-bottom:10px;">
        <button id="tab-hospital" class="result-tab active" style="flex:1;">Hospital</button>
        <button id="tab-lnd" class="result-tab" style="flex:1;">L&D</button>
      </div>

      <div id="result-details"></div>
    </div>
  `;

    const detailsDiv = document.getElementById("result-details");
    detailsDiv.innerHTML = renderHospitalDetails(p, distanceMiles);
    const tabHospital = document.getElementById("tab-hospital");
    const tabLnd = document.getElementById("tab-lnd");

    if (!tabHospital || !tabLnd) {
      console.warn("Tab buttons not found");
      return;
    }

    // default already showing hospital (you did this correctly)

    // Hospital tab click
    tabHospital.addEventListener("click", function () {
      tabHospital.classList.add("active");
      tabLnd.classList.remove("active");

      if (window.currentNearestHospital && window.currentNearestHospital.properties) {
        detailsDiv.innerHTML = renderHospitalDetails(
          window.currentNearestHospital.properties,
          window.currentNearestHospitalDistance
        );
      }
    });

    // LnD tab click
    tabLnd.addEventListener("click", function () {
      tabLnd.classList.add("active");
      tabHospital.classList.remove("active");

      if (window.currentNearestLnD && window.currentNearestLnD.properties) {
        detailsDiv.innerHTML = renderHospitalDetails(
          window.currentNearestLnD.properties,
          window.currentNearestLnDDistance / 1609.34
        );
      } else {
        detailsDiv.innerHTML = `<em>No L&D facility found.</em>`;
      }
    });

  }
}

/* =========================================
   RENDER HOSPITAL DETAILS
========================================= */
function renderHospitalDetails(p, distanceMiles) {

  function valueOrBlank(v) {
    return (v === null || v === undefined || v === "") ? "" : v;
  }

  function yesNoUnknown(v) {
    if (v === 1 || v === "1" || v === "Yes" || v === "YES" || v === "Y") return "Yes";
    if (v === 0 || v === "0" || v === "No" || v === "NO" || v === "N") return "No";
    return valueOrBlank(v);
  }

  function row(label, value) {
    return (
      '<div style="margin-bottom:6px;">' +
      '<span style="opacity:0.7;">' + label + ':</span> ' +
      '<strong>' + valueOrBlank(value) + '</strong>' +
      '</div>'
    );
  }

  return (
    '<div style="font-size:12px; letter-spacing:1px; opacity:0.7; margin-bottom:8px;">NEAREST HOSPITAL</div>' +

    '<div style="font-size:18px; font-weight:700; line-height:1.25; margin-bottom:14px;">' +
    valueOrBlank(p.USER_NAME) +
    '</div>' +

    row("Address", p.USER_ADDRESS) +
    row("City", p.USER_CITY) +
    row("State", p.USER_STATE) +
    row("ZIP", p.USER_ZIP) +
    row("Telephone", p.USER_TELEPHONE) +
    row("Type", p.USER_TYPE) +
    row("County", p.USER_COUNTY) +
    row("Website", p.USER_WEBSITE) +
    row("Beds", p.USER_BEDS) +
    row("Trauma", yesNoUnknown(p.USER_TRAUMA)) +
    row("Helipad", yesNoUnknown(p.USER_HELIPAD)) +
    row("Hospital Count", p.USER_hosp_cnt) +
    row("HSA Label", p.USER_HSA_label) +
    row("L&D", yesNoUnknown(p.USER_LnD)) +
    row("Pediatric", yesNoUnknown(p.USER_Pediatric)) +
    row("Gyn", yesNoUnknown(p.USER_Gyn)) +
    row("MFM", yesNoUnknown(p.USER_MFM)) +
    row("Critical Access", yesNoUnknown(p.USER_CriticalAccess)) +
    row("Acute Care", yesNoUnknown(p.USER_Acute_care)) +
    row("Distance", distanceMiles.toFixed(1) + " miles")
  );
}

/* =========================================
   FIND NEAREST HOSPITAL
========================================= */
function findNearestHospital(searchLat, searchLon, infoPanel) {
  if (!HospitalsLayer) {
    console.log("HospitalsLayer not ready");
    alert("Hospital layer is still loading.");
    return;
  }

  const searchPoint = turf.point([searchLon, searchLat]);
  let nearestFeature = null;
  let nearestDistance = Infinity;

  HospitalsLayer.eachLayer(function (layer) {
    if (!layer.feature || !layer.feature.geometry || !layer.feature.geometry.coordinates) return;

    const coords = layer.feature.geometry.coordinates;
    const hospitalPoint = turf.point(coords);
    const dist = turf.distance(searchPoint, hospitalPoint, { units: "miles" });

    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestFeature = layer.feature;
    }
  });

  if (!nearestFeature) {
    alert("No hospital features available for search.");
    return;
  }

  drawNearestResult(searchLat, searchLon, nearestFeature, nearestDistance, infoPanel);

  let nearestLnD = null;
  let minLnDDist = Infinity;

  HospitalsLayer.eachLayer(function (layer) {
    const props = layer.feature.properties;

    if (Number(props.USER_LnD) === 1) {
      const coords = layer.feature.geometry.coordinates;
      const latlng = [coords[1], coords[0]];
      const d = map.distance([searchLat, searchLon], latlng);

      if (d < minLnDDist) {
        minLnDDist = d;
        nearestLnD = layer.feature;
      }
    }
  });

  window.currentNearestHospital = nearestFeature;
  window.currentNearestHospitalDistance = nearestDistance;
  window.currentNearestLnD = nearestLnD;
  window.currentNearestLnDDistance = minLnDDist;

  if (nearestLnD) {
    console.log("Nearest LnD found:", nearestLnD.properties.USER_NAME, minLnDDist);

    const coords = nearestLnD.geometry.coordinates;
    const lndLatLng = [coords[1], coords[0]];

    const nearestName =
      nearestFeature.properties.USER_NAME ||
      nearestFeature.properties.NAME ||
      nearestFeature.properties.name ||
      "Hospital";

    const lndName =
      nearestLnD.properties.USER_NAME ||
      nearestLnD.properties.NAME ||
      nearestLnD.properties.name ||
      "Hospital";

    const sameFacility =
      (
        (nearestFeature.properties.USER_NAME || nearestFeature.properties.NAME || nearestFeature.properties.name || "") ===
        (nearestLnD.properties.USER_NAME || nearestLnD.properties.NAME || nearestLnD.properties.name || "")
      ) &&
      nearestFeature.geometry.coordinates[0] === nearestLnD.geometry.coordinates[0] &&
      nearestFeature.geometry.coordinates[1] === nearestLnD.geometry.coordinates[1];

    console.log("sameFacility:", sameFacility, nearestName, lndName);

    if (!sameFacility) {
      nearestLnDMarker = L.circleMarker(lndLatLng, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#C98F2B",
        fillOpacity: 1
      }).addTo(map);

      nearestLnDHospitalLabel = L.marker(lndLatLng, {
        icon: L.divIcon({
          className: "hospital-label",
          html: `
            <div class="result-label">
              <div class="result-label-title">${lndName}</div>
              <div class="result-label-subtitle">Nearest LnD</div>
            </div>
          `,
          iconSize: [300, 34],
          iconAnchor: [-10, 20]
        })
      }).addTo(map);

      nearestLnDHalo = L.polyline(
        [[searchLat, searchLon], lndLatLng],
        {
          color: "#ffffff",
          weight: 6,
          opacity: 0.9
        }
      ).addTo(map);

      nearestLnDLine = L.polyline(
        [[searchLat, searchLon], lndLatLng],
        {
          color: "#C98F2B",
          weight: 2,
          dashArray: "6,4"
        }
      ).addTo(map);

      const lndMiles = (minLnDDist / 1609.34).toFixed(1);
      const midLat = (searchLat + lndLatLng[0]) / 2;
      const midLng = (searchLon + lndLatLng[1]) / 2;

      nearestLnDDistanceLabel = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "distance-label",
          html: `<div>${lndMiles} mi</div>`,
          iconSize: [70, 20]
        })
      }).addTo(map);
    }

    const bounds = L.latLngBounds([
      [searchLat, searchLon],
      [nearestFeature.geometry.coordinates[1], nearestFeature.geometry.coordinates[0]]
    ]);

    if (!sameFacility) {
      bounds.extend([
        nearestLnD.geometry.coordinates[1],
        nearestLnD.geometry.coordinates[0]
      ]);
    }

    map.fitBounds(bounds, {
      paddingTopLeft: [360, 40],
      paddingBottomRight: [40, 40]
    });
  }
}

/* =========================================
   SET UP SEARCH
========================================= */
document.addEventListener("DOMContentLoaded", function () {
  console.log("search block loaded");

  const searchBtn = document.getElementById("search-btn");
  const addressInput = document.getElementById("address-input");
  const infoPanel = document.getElementById("info-panel");
  const clearBtn = document.getElementById("clear-btn");
  const openPanelBtn = document.getElementById("open-panel-btn");
  const closePanelBtn = document.getElementById("close-panel-btn");

  console.log("openPanelBtn:", openPanelBtn);

  resultsPanel = document.getElementById("search-results");

  console.log("searchBtn:", !!searchBtn, "addressInput:", !!addressInput, "infoPanel:", !!infoPanel);

  if (!searchBtn || !addressInput || !infoPanel || !clearBtn) {
    console.error("Search UI elements not found.");
    return;
  }

  openPanelBtn.addEventListener("click", function () {
    console.log("open panel clicked");
    infoPanel.style.display = "block";
    openPanelBtn.style.display = "none";
  });

  closePanelBtn.addEventListener("click", function () {
    console.log("close panel clicked");
    infoPanel.style.display = "none";
    openPanelBtn.style.display = "block";
  });

  clearBtn.addEventListener("click", function () {
    console.log("clear button clicked");

    // clear everything via one function
    clearSearchDisplay();

    // reset panel
    resultsPanel.innerHTML = `< em > Click search to locate address</em> `;

    // clear input
    addressInput.value = "";
  });

  searchBtn.addEventListener("click", function () {
    console.log("search button clicked");

    const address = addressInput.value.trim();

    if (!address) {
      alert("Enter an Idaho address");
      return;
    }

    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&bbox=-117.243027,41.988057,-111.043564,49.001146&country=US&types=address,place,postcode,locality,neighborhood`;

    console.log("geocoding:", address);

    fetch(geocodeUrl)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        console.log("geocode response:", data);

        if (!data.features || data.features.length === 0) {
          alert("Address not found in Idaho");
          return;
        }

        const result = data.features[0];
        const searchLon = result.center[0];
        const searchLat = result.center[1];

        console.log("about to clear search display");
        clearSearchDisplay();
        if (nearestLnDHalo && map.hasLayer(nearestLnDHalo)) {
          map.removeLayer(nearestLnDHalo);
          nearestLnDHalo = null;
        }

        console.log("about to add search marker");
        searchMarker = L.marker([searchLat, searchLon]).addTo(map);

        console.log("about to update panel");
        resultsPanel.innerHTML = `
  <div style="opacity:0.7;">Finding nearest hospital...</div>
`;

        console.log("about to find nearest hospital");
        findNearestHospital(searchLat, searchLon, resultsPanel);
        console.log("nearest hospital search completed");

      }).catch(function (err) {
        console.error("Search workflow error:", err, err?.stack);
        alert("Search workflow error. Check console.");
      });

  });
});