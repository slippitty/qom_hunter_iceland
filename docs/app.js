// QOM Hunter Iceland - units toggle between miles and kilometers.
// Internal storage always metric; conversion happens only when reading
// from sliders and writing to display.

const KM_PER_MI = 1.609344;

const state = {
  segments: [],
  sport: "Ride",
  record: "qom",
  direction: "all",
  units: "mi",
  segLayers: [],
  // Filter values stored internally in metric always
  distMinKm: 0.1 * KM_PER_MI,
  distMaxKm: 5.0 * KM_PER_MI,
  maxKph: 20 * KM_PER_MI,
  minPaceMinPerKm: 6.5 / KM_PER_MI,
};

const map = L.map("map").setView([64.65, -18.5], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

fetch("segments.json")
  .then(r => r.json())
  .then(data => {
    state.segments = data.segments;
    const built = new Date(data.built_at * 1000).toLocaleDateString();
    document.getElementById("results-count").textContent =
      `Loaded ${data.segments.length} segments (built ${built}).`;
    rerender();
  })
  .catch(err => {
    document.getElementById("results-count").textContent = "Failed to load dataset.";
    console.error(err);
  });

const $ = id => document.getElementById(id);

// ---------- Slider ranges ----------
// Each unit system defines the slider bounds and default values.
// Values shown to the user are always in the current unit system.
const RANGES = {
  mi: {
    dist: { min: 0.05, max: 10, step: 0.05 },
    speed: { min: 10, max: 35, step: 1 },
    pace: { min: 4.0, max: 12.0, step: 0.1 },
  },
  km: {
    dist: { min: 0.1, max: 16, step: 0.1 },
    speed: { min: 15, max: 55, step: 1 },
    pace: { min: 2.5, max: 7.5, step: 0.1 },
  },
};

// ---------- Unit conversion helpers ----------
function distFromSlider(rawValue) {
  // Slider value in current units -> internal km
  return state.units === "mi" ? rawValue * KM_PER_MI : rawValue;
}
function distToSlider(km) {
  // internal km -> value to show on slider in current units
  return state.units === "mi" ? km / KM_PER_MI : km;
}
function speedFromSlider(rawValue) {
  return state.units === "mi" ? rawValue * KM_PER_MI : rawValue;
}
function speedToSlider(kph) {
  return state.units === "mi" ? kph / KM_PER_MI : kph;
}
function paceFromSlider(rawValue) {
  // Slider is min per current unit -> internal min per km
  return state.units === "mi" ? rawValue / KM_PER_MI : rawValue;
}
function paceToSlider(minPerKm) {
  return state.units === "mi" ? minPerKm * KM_PER_MI : minPerKm;
}

// Formatters for the results/popup
function formatDist(distM) {
  const km = distM / 1000;
  const val = state.units === "mi" ? km / KM_PER_MI : km;
  return val.toFixed(2);
}
function formatSpeed(kph) {
  const val = state.units === "mi" ? kph / KM_PER_MI : kph;
  return val.toFixed(1);
}
function formatPace(minPerKm) {
  const perUnit = state.units === "mi" ? minPerKm * KM_PER_MI : minPerKm;
  const mins = Math.floor(perUnit);
  const secs = Math.round((perUnit - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
function unitLabel() { return state.units; }
function speedLabel() { return state.units === "mi" ? "mph" : "kph"; }
function paceLabel() { return state.units === "mi" ? "min/mi" : "min/km"; }

// ---------- Sync sliders and labels from state ----------
function syncSliders() {
  const r = RANGES[state.units];
  const dm = $("dist-min"), dM = $("dist-max");
  const sp = $("max-speed"), pa = $("min-pace");

  dm.min = r.dist.min; dm.max = r.dist.max; dm.step = r.dist.step;
  dM.min = r.dist.min; dM.max = r.dist.max; dM.step = r.dist.step;
  sp.min = r.speed.min; sp.max = r.speed.max; sp.step = r.speed.step;
  pa.min = r.pace.min; pa.max = r.pace.max; pa.step = r.pace.step;

  dm.value = clamp(distToSlider(state.distMinKm), r.dist.min, r.dist.max);
  dM.value = clamp(distToSlider(state.distMaxKm), r.dist.min, r.dist.max);
  sp.value = clamp(speedToSlider(state.maxKph), r.speed.min, r.speed.max);
  pa.value = clamp(paceToSlider(state.minPaceMinPerKm), r.pace.min, r.pace.max);

  updateLabels();
}

function updateLabels() {
  document.querySelectorAll(".dist-unit").forEach(e => e.textContent = unitLabel());
  document.querySelectorAll(".speed-unit").forEach(e => e.textContent = speedLabel());
  document.querySelectorAll(".pace-unit").forEach(e => e.textContent = paceLabel());
  $("dist-min-val").textContent = (+$("dist-min").value).toFixed(state.units === "mi" ? 2 : 1);
  $("dist-max-val").textContent = (+$("dist-max").value).toFixed(state.units === "mi" ? 2 : 1);
  $("max-speed-val").textContent = (+$("max-speed").value).toFixed(0);
  $("min-pace-val").textContent = (+$("min-pace").value).toFixed(1);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------- Slider input handlers ----------
$("dist-min").addEventListener("input", () => {
  state.distMinKm = distFromSlider(parseFloat($("dist-min").value));
  updateLabels();
  rerender();
});
$("dist-max").addEventListener("input", () => {
  state.distMaxKm = distFromSlider(parseFloat($("dist-max").value));
  updateLabels();
  rerender();
});
$("max-speed").addEventListener("input", () => {
  state.maxKph = speedFromSlider(parseFloat($("max-speed").value));
  updateLabels();
  rerender();
});
$("min-pace").addEventListener("input", () => {
  state.minPaceMinPerKm = paceFromSlider(parseFloat($("min-pace").value));
  updateLabels();
  rerender();
});

// ---------- Toggle handlers ----------
$("hide-glitches").addEventListener("change", rerender);
$("include-personal").addEventListener("change", rerender);

document.querySelectorAll(".sport-btn").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".sport-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.sport = b.dataset.sport;
    $("speed-field").style.display = state.sport === "Ride" ? "" : "none";
    $("pace-field").style.display = state.sport === "Run" ? "" : "none";
    rerender();
  });
});

document.querySelectorAll(".record-btn").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".record-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.record = b.dataset.record;
    rerender();
  });
});

document.querySelectorAll(".direction-btn").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".direction-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.direction = b.dataset.direction;
    rerender();
  });
});

document.querySelectorAll(".units-btn").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".units-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.units = b.dataset.units;
    syncSliders();  // reconfigure sliders for new units, values stay in metric
    rerender();
  });
});

// ---------- Initial sync ----------
syncSliders();

// ---------- Map rendering ----------
function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0, coords = [];
  while (index < str.length) {
    for (let k = 0; k < 2; k++) {
      let shift = 0, result = 0, b;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (k === 0) lat += delta; else lng += delta;
    }
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

function rerender() {
  state.segLayers.forEach(l => map.removeLayer(l));
  state.segLayers = [];

  if (!state.segments.length) {
    $("results").innerHTML = "";
    return;
  }

  const hideGlitches = $("hide-glitches").checked;
  const includePersonal = $("include-personal").checked;

  const RIDE_GLITCH_KPH = 60.0;
  const RUN_GLITCH_MIN_PER_KM = 2.5;
  const MIN_PLAUSIBLE_DIST_M = 150;
  const FLAT_GRADE_THRESHOLD = 1.0;

  const recordKey = state.record + "_s";
  const speedKey = state.record + "_kph";
  const paceKey = state.record + "_min_per_km";

  const matches = state.segments.filter(s => {
    if (s.type !== state.sport) return false;
    if (s.from_activity && !includePersonal) return false;
    if (!s[recordKey]) return false;
    if (!s.start) return false;
    if (hideGlitches) {
      if (s.dist_m < MIN_PLAUSIBLE_DIST_M) return false;
      if (state.sport === "Ride" && s[speedKey] > RIDE_GLITCH_KPH) return false;
      if (state.sport === "Run" && s[paceKey] < RUN_GLITCH_MIN_PER_KM) return false;
    }
    const grade = s.grade || 0;
    if (state.direction === "up" && grade < FLAT_GRADE_THRESHOLD) return false;
    if (state.direction === "down" && grade > -FLAT_GRADE_THRESHOLD) return false;
    const distKm = s.dist_m / 1000;
    if (distKm < state.distMinKm || distKm > state.distMaxKm) return false;
    if (state.sport === "Ride") {
      if (s[speedKey] > state.maxKph) return false;
    } else {
      if (s[paceKey] < state.minPaceMinPerKm) return false;
    }
    return true;
  });

  matches.sort((a, b) => {
    if (state.sport === "Ride") return a[speedKey] - b[speedKey];
    return b[paceKey] - a[paceKey];
  });

  $("results-count").textContent = `${matches.length} segments match.`;

  for (const s of matches) {
    if (!s.poly) continue;
    let coords;
    try { coords = decodePolyline(s.poly); } catch { continue; }
    const line = L.polyline(coords, { color: "#fc4c02", weight: 3, opacity: 0.8 });
    line.bindPopup(renderPopup(s));
    line.addTo(map);
    state.segLayers.push(line);
  }

  const list = $("results");
  list.innerHTML = "";
  for (const s of matches.slice(0, 50)) {
    const div = document.createElement("div");
    div.className = "result";
    const recStr = state.record === "qom" ? s.qom_str : s.kom_str;
    const distStr = formatDist(s.dist_m);
    let rate;
    if (state.sport === "Ride") {
      rate = `${formatSpeed(s[speedKey])} ${speedLabel()}`;
    } else {
      rate = `${formatPace(s[paceKey])}/${unitLabel()}`;
    }
    div.innerHTML = `
      <div class="name">${s.name || "(unnamed)"}</div>
      <div class="meta">${distStr} ${unitLabel()} &middot; ${(s.grade || 0).toFixed(1)}% &middot; ${state.record.toUpperCase()} ${recStr} &middot; ${rate} &middot; ${s.athlete_count || 0} athletes</div>
    `;
    div.addEventListener("click", () => {
      if (s.start) map.setView(s.start, 14);
    });
    list.appendChild(div);
  }
}

function renderPopup(s) {
  const recStr = state.record === "qom" ? s.qom_str : s.kom_str;
  const distStr = formatDist(s.dist_m);
  let rate;
  if (state.sport === "Ride") {
    rate = `${formatSpeed(s[state.record + "_kph"])} ${speedLabel()}`;
  } else {
    rate = `${formatPace(s[state.record + "_min_per_km"])} ${paceLabel()}`;
  }
  return `
    <b>${s.name || "(unnamed)"}</b><br>
    ${s.type} &middot; ${distStr} ${unitLabel()} &middot; ${(s.grade || 0).toFixed(1)}% grade<br>
    ${state.record.toUpperCase()}: ${recStr} (${rate})<br>
    ${s.effort_count || 0} efforts by ${s.athlete_count || 0} athletes<br>
    <a href="https://www.strava.com/segments/${s.id}" target="_blank">Open on Strava</a>
  `;
}
