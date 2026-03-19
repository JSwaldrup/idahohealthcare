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

let idahoBoundaryLayer = null;

let searchMarker = null;
let nearestLine = null;
let nearestLineHalo = null;
let distanceLabel = null;
let hospitalMarker = null;
let hospitalLabel = null;

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
const MAPBOX_STYLE_ID = "cmmocalzh003x01rn6yrq472o";
const DT_TILE_ZOOM = 10; // zoom level at which to switch from vector to raster drivetime layers (if using Mapbox raster tiles for drivetime)

const mapboxBasemap = L.tileLayer(
  `https://api.mapbox.com/styles/v1/${MAPBOX_USERNAME}/${MAPBOX_STYLE_ID}/tiles/512/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
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
let HospitalsLayer;
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
  const zoom = map.getZoom();
  const showVectors = zoom < DT_TILE_ZOOM;

  if (ZeroToThirtyLayer) {
    ZeroToThirtyLayer.setStyle(showVectors ? styleZeroToThirty() : hiddenDriveStyle);
  }

  if (ThirtyTo60Layer) {
    ThirtyTo60Layer.setStyle(showVectors ? styleThirtyTo60() : hiddenDriveStyle);
  }

  if (SixtyToNinetyLayer) {
    SixtyToNinetyLayer.setStyle(showVectors ? styleSixtyToNinety() : hiddenDriveStyle);
  }

  if (NinetyToOneTwentyLayer) {
    NinetyToOneTwentyLayer.setStyle(showVectors ? styleNinetyToOneTwenty() : hiddenDriveStyle);
  }

  if (OneTwentyToOneFiftyLayer) {
    OneTwentyToOneFiftyLayer.setStyle(showVectors ? styleOneTwentyToOneFifty() : hiddenDriveStyle);
  }
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

map.on("zoomend", function () {
  updateLayers();
  updateDriveLayers();
  if (idahoBoundaryLayer) idahoBoundaryLayer.bringToFront();
});

const IDENTIFY_MIN_ZOOM = 7;

// Map click handler
map.on("click", function (e) {
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

// ================================
// ADDRESS SEARCH (STEP 1)
// ================================

document.getElementById("search-btn").addEventListener("click", function () {

  const address = document.getElementById("address-input").value;
  const infoPanel = document.getElementById("info-panel");

  if (!address) {
    alert("Enter an Idaho address");
    return;
  }

  // Geocoding with Mapbox API, limited to Idaho + nearby areas
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&bbox=-117.243027,41.988057,-111.043564,49.001146&country=US&types=address,place,postcode,locality,neighborhood`;
  fetch(url)
    .then(response => response.json())
    .then(data => {

      if (!data.features || data.features.length === 0) {
        alert("Address not found in Idaho");
        return;
      }

      const result = data.features[0];
      const lon = result.center[0];
      const lat = result.center[1];

      // remove previous marker
      if (searchMarker) {
        map.removeLayer(searchMarker);
      }

      // add marker
      searchMarker = L.marker([lat, lon]).addTo(map);
      console.log("STEP 2 REACHED");

      // ================================
      // FIND NEAREST FACILITY (STEP 2)
      // ================================

      const searchPoint = turf.point([lon, lat]);

      let nearestFeature = null;
      let nearestDistance = Infinity;

      HospitalsLayer.eachLayer(function (layer) {
        const coords = layer.feature.geometry.coordinates;
        const hospitalPoint = turf.point(coords);
        const dist = turf.distance(searchPoint, hospitalPoint, { units: "miles" });

        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestFeature = layer.feature;
        }
      });

      if (nearestFeature) {
        const nearestCoords = nearestFeature.geometry.coordinates;
        const nearestLat = nearestCoords[1];
        const nearestLon = nearestCoords[0];

        if (nearestLine) {
          map.removeLayer(nearestLine);
        }

        if (hospitalMarker) {
          map.removeLayer(hospitalMarker);
        }

        if (nearestLineHalo) {
          map.removeLayer(nearestLineHalo);
        }

        if (nearestLine) {
          map.removeLayer(nearestLine);
        }

        nearestLineHalo = L.polyline(
          [
            [lat, lon],
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
            [lat, lon],
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

        if (distanceLabel) {
          map.removeLayer(distanceLabel);
        }
        if (hospitalLabel) {
          map.removeLayer(hospitalLabel);
        }

        hospitalLabel = L.marker([nearestLat, nearestLon], {
          icon: L.divIcon({
            className: "hospital-label",
            html: `<div>${nearestFeature.properties.USER_NAME}</div>`,
            iconSize: [300, 20],
            iconAnchor: [-10, 20]
          })
        }).addTo(map);

        // midpoint between search + hospital
        const midLat = (lat + nearestLat) / 2;
        const midLon = (lon + nearestLon) / 2;

        // calculate perpendicular offset
        const dx = nearestLon - lon;
        const dy = nearestLat - lat;
        const length = Math.sqrt(dx * dx + dy * dy);

        // normalize perpendicular vector
        const offset = 0.015; // tweak this number
        const offsetLat = -dx / length * offset;
        const offsetLon = dy / length * offset;

        // apply offset
        const labelLat = midLat + offsetLat;
        const labelLon = midLon + offsetLon;

        distanceLabel = L.marker([labelLat, labelLon], {
          icon: L.divIcon({
            className: "distance-label",
            html: `<div>${nearestDistance.toFixed(1)} mi</div>`,
            iconSize: [60, 20]
          })
        }).addTo(map);

        infoPanel.innerHTML = `
    <div class="panel-block">
      <h3>Nearest Hospital</h3>
      <strong>${nearestFeature.properties.USER_NAME}</strong><br>
      ${nearestFeature.properties.USER_CITY}, ${nearestFeature.properties.USER_STATE}<br>
      ${nearestFeature.properties.USER_ADDRESS}<br><br>
      Distance: ${nearestDistance.toFixed(1)} miles
    </div>
  `;

        // zoom to it
        map.fitBounds(
          [
            [lat, lon],
            [nearestLat, nearestLon]
          ],
          {
            paddingTopLeft: [360, 40],
            paddingBottomRight: [40, 40]
          }
        );

      }

    })
    .catch(err => {
      console.error(err);
      alert("Geocoding error");
    });

});