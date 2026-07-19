// QOM Hunter Iceland. Units toggle between miles (default) and kilometers.

const KM_PER_MI = 1.609344;

const state = {
  segments: [],
  sport: "Ride",
  record: "qom",
  direction: "all",
  units: "mi",
  segLayers: [],
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
    document.getElementById("results-count").textContent =
      "Failed to load dataset.";
    console.error(err);
  });

const $ = id => document.getElementById(id);

// Slider ranges depend on units. Reconfigure them when units switch.
// Distance sliders go 0.05 to 10 mi = 0.08 to 16.09 km; we round.
// Speed slider goes 10-35 mph = 16-56 kph.
// Pace slider goes 4-12 min/mi = 2.49-7.46 min/km.
const SLIDER_RANGES = {
  mi: {
    dist: { min: 0.05, max: 10, step: 0.05, default_min: 0.1, default_max: 5.0 },
    speed: { min: 10, max: 35, step: 1, default: 20 },
    pace: { min: 4.0, max: 12.0, step: 0.1, default: 6.5 },
  },
  km: {
    dist: { min: 0.1, max: 16, step: 0.1, default_min: 0.2, default_max: 8.0 },
    speed: { min: 15, max: 55, step: 1, default: 30 },
    pace: { min: 2.5, max: 7.5, step: 0.1, default: 4.0 },
  },
};

function applyUnits() {
  const r = SLIDER_RANGES[state.units];
  const dm = $("dist-min"), dM = $("dist-max");
  dm.min = r.dist.min; dm.max = r.dist.max; dm.step = r.dist.step;
  dM.min = r.dist.min; dM.max = r.dist.max; dM.step = r.dist.step;
  dm.value = r.dist.default_min; dM.value = r.dist.default_max;

  const sp = $("max-speed");
  sp.min = r.speed.min; sp.max = r.speed.max; sp.step = r.speed.step;
  sp.value = r.speed.default;

  const pa = $("min-pace");
  pa.min = r.pace.min; pa.max = r.pace.max; pa.step = r.pace.step;
  pa.value = r.pace.default;

  // labels
  document.querySelectorAll(".dist-unit").forEach(e => e.textContent = state.units);
  document.querySelectorAll(".speed-unit").forEach(e => e.textContent = state.units === "mi" ? "mph" : "kph");
  document.querySelectorAll(".pace-unit").forEach(e => e.textContent = state.units === "mi" ? "min/mi" : "min/km");

  $("dist-min-val").textContent = (+dm.value).toFixed(state.units === "mi" ? 2 : 1);
  $("dist-max-val").textContent = (+dM.value).toFixed(state.units === "mi" ? 2 : 1);
  $("max-speed-val").textContent = sp.value;
  $("min-pace-val").textContent = (+pa.value).toFixed(1);
}

function bindRange(inputId, valId, fmt = v => v) {
  const input = $(inputId), val = $(valId);
  input.addEventListener("input", () => {
    val.textContent = fmt(input.value);
    rerender();
  });
}
bindRange("dist-min", "dist-min-val", v => (+v).toFixed(state.units === "mi" ? 2 : 1));
bindRange("dist-max", "dist-max-val", v => (+v).toFixed(state.units === "mi" ? 2 : 1));
bindRange("max-speed", "max-speed-val");
bindRange("min-pace", "min-pace-val", v => (+v).toFixed(1));
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
    applyUnits();
    rerender();
  });
});

// Set up initial unit labels
applyUnits();

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

function formatPace(minPerKm) {
  // Returns formatted string using current units
  const perUnit = state.units === "mi" ? minPerKm * KM_PER_MI : minPerKm;
  const mins = Math.floor(perUnit);
  const secs = Math.round((perUnit - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
function formatSpeed(kph) {
  // Returns formatted number using current units (as string)
  return (state.units === "mi" ? kph / KM_PER_MI : kph).toFixed(1);
}
function formatDist(distM) {
  // Returns formatted number using current units (as string)
  const km = distM / 1000;
  return (state.units === "mi" ? km / KM_PER_MI : km).toFixed(2);
}

function rerender() {
  state.segLayers.forEach(l => map.removeLayer(l));
  state.segLayers = [];

  if (!state.segments.length) {
    $("results").innerHTML = "";
    return;
  }

  // Convert slider values to km / kph / min-per-km internally, regardless of units
  const rawDistMin = parseFloat($("dist-min").value);
  const rawDistMax = parseFloat($("dist-max").value);
  const rawMaxSpeed = parseFloat($("max-speed").value);
  const rawMinPace = parseFloat($("min-pace").value);

  const distMinKm = state.units === "mi" ? rawDistMin * KM_PER_MI : rawDistMin;
  const distMaxKm = state.units === "mi" ? rawDistMax * KM_PER_MI : rawDistMax;
  const maxKph = state.units === "mi" ? rawMaxSpeed * KM_PER_MI : rawMaxSpeed;
  const minPaceMinPerKm = state.units === "mi" ? rawMinPace / KM_PER_MI : rawMinPace;

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
    if (distKm < distMinKm || distKm > distMaxKm) return false;
    if (state.sport === "Ride") {
      if (s[speedKey] > maxKph) return false;
    } else {
      if (s[paceKey] < minPaceMinPerKm) return false;
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
    const distUnit = state.units;
    let rate;
    if (state.sport === "Ride") {
      rate = `${formatSpeed(s[speedKey])} ${state.units === "mi" ? "mph" : "kph"}`;
    } else {
      rate = `${formatPace(s[paceKey])}/${state.units}`;
    }
    div.innerHTML = `
      <div class="name">${s.name || "(unnamed)"}</div>
      <div class="meta">${distStr} ${distUnit} &middot; ${(s.grade || 0).toFixed(1)}% &middot; ${state.record.toUpperCase()} ${recStr} &middot; ${rate} &middot; ${s.athlete_count || 0} athletes</div>
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
  const distUnit = state.units;
  let rate;
  if (state.sport === "Ride") {
    rate = `${formatSpeed(s[state.record + "_kph"])} ${state.units === "mi" ? "mph" : "kph"}`;
  } else {
    rate = `${formatPace(s[state.record + "_min_per_km"])} min/${state.units}`;
  }
  return `
    <b>${s.name || "(unnamed)"}</b><br>
    ${s.type} &middot; ${distStr} ${distUnit} &middot; ${(s.grade || 0).toFixed(1)}% grade<br>
    ${state.record.toUpperCase()}: ${recStr} (${rate})<br>
    ${s.effort_count || 0} efforts by ${s.athlete_count || 0} athletes<br>
    <a href="https://www.strava.com/segments/${s.id}" target="_blank">Open on Strava</a>
  `;
}
