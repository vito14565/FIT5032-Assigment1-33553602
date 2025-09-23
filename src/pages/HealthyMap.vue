<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";

/** ====== ENV ====== **/
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** ====== Refs / state ====== **/
const mapEl = ref(null);
const destInput = ref(null);

/* Travel mode / POI / TTS toggle */
const mode = ref("WALKING");
const poi = ref("supermarket");
const speak = ref(true); // Voice TTS toggle

/* Address + routing states */
const fromAddr = ref("Locating your position…");
const canRoute = ref(false);
const hasRoute = ref(false);
const navigating = ref(false);

/* HUD values */
const nextHint = ref("Pick a destination to start");
const remainKm = ref("—");
const etaMin = ref("—");

/* Manual "From" editor */
const fromInputEl = ref(null);
const editingFrom = ref(false);

/* A11y: live regions */
const statusText = ref("Map ready.");          // polite updates (e.g., route ready, search done)
const alertText = ref("");                     // assertive alerts (e.g., critical failures)

/* A11y: map busy while routing */
const routing = ref(false);                    // true during directionsService.route

let map, directionsService, directionsRenderer, autocomplete;
let placesSvc, infoWin;
let youMarker, destMarker, poiMarkers = [];
let userLL = null;        // {lat, lng}
let destLL = null;        // {lat, lng}
let destPlaceId = null;   // destination place_id (optional)
let watchId = null;       // geolocation watch id
let fromAutocomplete = null; // Places Autocomplete for "From"

/* Route rendering */
let routePoly = null;     // blue main stroke
let routeCasing = null;   // black outer casing

/* Navigation / prompts */
let lastSpokenKey = "";   // de-duplicate TTS
let currentRoute = null;  // DirectionsRoute
let stepEnds = [];        // end_location of each step (LatLng[])
let stepTexts = [];       // plain-text instructions of each step

/* Camera */
let prevLL = null;        // previous location to estimate heading

/** ====== helpers ====== **/
function loadGoogle(cb) {
  if (window.google?.maps) return cb();
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places&v=weekly`;
  s.async = true;
  s.onload = cb;
  s.onerror = () => {
    console.error("Failed to load Google Maps JS (check API key / billing).");
    alertText.value = "Failed to load map script.";
  };
  document.head.appendChild(s);
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || div.innerText || "";
}

/* Speak once (toggleable) */
function speakOnce(key, text) {
  if (!speak.value) return;
  if (lastSpokenKey === key) return;
  lastSpokenKey = key;
  try {
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis?.speak(u);
  } catch {}
}

function reverseGeocode(ll, onDone) {
  new google.maps.Geocoder().geocode({ location: ll }, (res, status) => {
    if (status === "OK" && res?.[0]) onDone(res[0].formatted_address);
    else onDone(`${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`);
  });
}

function clearPOIs() {
  poiMarkers.forEach(m => m.setMap(null));
  poiMarkers = [];
  statusText.value = "Cleared previous results.";
}

function clearRouteGraphics() {
  if (routePoly) routePoly.setMap(null);
  if (routeCasing) routeCasing.setMap(null);
  routePoly = routeCasing = null;

  hasRoute.value = false;
  currentRoute = null;
  stepEnds = [];
  stepTexts = [];
  nextHint.value = "Pick a destination to start";
  remainKm.value = "—";
  etaMin.value = "—";
}

/** ====== camera helpers ====== **/
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function getNavZoomByMode() {
  return (mode.value === "WALKING" || mode.value === "BICYCLING") ? 18 : 16;
}
function adjustZoomBySpeed(base, speedMps) {
  if (typeof speedMps !== "number" || isNaN(speedMps)) return base;
  const delta = clamp(1 - (speedMps / 15) * 3, -2, 1);
  return clamp(Math.round(base + delta), 15, 19);
}
function bearingDeg(a, b) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const λ1 = toRad(a.lng), λ2 = toRad(b.lng);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function bearingFromRouteStart() {
  try {
    const p = currentRoute?.overview_path;
    if (p && p.length >= 2) {
      return bearingDeg({ lat: p[0].lat(), lng: p[0].lng() }, { lat: p[1].lat(), lng: p[1].lng() });
    }
  } catch {}
  return undefined;
}
function flyCamera(center, { zoom, tilt = 65, heading } = {}) {
  if (map?.moveCamera) {
    map.moveCamera({ center, zoom, tilt, heading });
  } else {
    if (typeof zoom === "number") map.setZoom(zoom);
    map.panTo(center);
    if (map.setTilt)  try{ map.setTilt(tilt); }catch{}
    if (map.setHeading && typeof heading === "number") try{ map.setHeading(heading); }catch{}
  }
}

/** ====== Geolocation permission（新增） ====== **/
async function initGeoPermissionWatch() {
  try {
    // 非 HTTPS（或非 localhost）時，瀏覽器通常拒絕定位
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      alertText.value = "Geolocation requires HTTPS or localhost.";
      fromAddr.value = "Location permission denied";
      openFromEditor();
      return;
    }
    if (!("permissions" in navigator)) return;
    const perm = await navigator.permissions.query({ name: "geolocation" });
    handleGeoPermissionState(perm.state);
    perm.onchange = () => handleGeoPermissionState(perm.state);
  } catch {}
}
function handleGeoPermissionState(state) {
  if (state === "granted") {
    statusText.value = "Location permission granted.";
    // 使用者剛允許時，主動抓一次
    reLocate();
  } else if (state === "prompt") {
    statusText.value = "Location permission needed. Click “Use current”.";
  } else if (state === "denied") {
    fromAddr.value = "Location permission denied";
    alertText.value = "Location permission denied. Please enter a start location.";
    openFromEditor();
  }
}

/** ====== Place details (InfoWindow) ====== **/
function todayHours(opening_hours) {
  if (!opening_hours?.weekday_text) return null;
  const idx = (new Date().getDay() + 6) % 7; // Sun=0 -> 6; Mon=1 -> 0
  return opening_hours.weekday_text[idx] || null;
}
function pill(open) {
  return `<span style="display:inline-block;background:${open ? "#16a34a" : "#ef4444"};color:#fff;padding:2px 8px;border-radius:999px;font-weight:700;font-size:12px">${open ? "Open" : "Closed"}</span>`;
}

function showPlaceDetails(placeId, anchorMarker) {
  placesSvc.getDetails(
    {
      placeId,
      fields: ["name", "formatted_address", "opening_hours", "rating", "user_ratings_total", "photos", "url", "website", "geometry"]
    },
    (place, status) => {
      if (status !== "OK" || !place) return;
      const photo = place.photos?.[0]?.getUrl({ maxWidth: 360 });
      const openNow = (place.opening_hours?.isOpen?.() ?? place.opening_hours?.open_now ?? null);
      const today = todayHours(place.opening_hours);
      const rating = place.rating ? `⭐ ${place.rating.toFixed(1)} (${place.user_ratings_total})` : "";

      const html = `
        <div style="font:14px/1.4 system-ui;max-width:320px">
          ${photo ? `<img src="${photo}" alt="" aria-hidden="true" style="width:100%;border-radius:8px;margin-bottom:6px">` : ""}
          <div style="display:flex;align-items:center;gap:6px">
            <strong>${place.name || "Place"}</strong>
            ${openNow != null ? pill(openNow) : ""}
          </div>
          <div>${place.formatted_address || ""}</div>
          ${today ? `<div><b>Today:</b> ${today.split(": ").slice(1).join(": ")}</div>` : ""}
          ${rating ? `<div>${rating}</div>` : ""}
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            ${place.website ? `<a href="${place.website}" target="_blank" style="padding:4px 8px;background:#f3f4f6;border-radius:6px">Website</a>` : ""}
            ${place.url ? `<a href="${place.url}" target="_blank" style="padding:4px 8px;background:#f3f4f6;border-radius:6px">Google Maps</a>` : ""}
            <button id="hm-route-here" style="padding:4px 8px;background:#0f172a;color:#fff;border-radius:6px">Route here</button>
          </div>
        </div>
      `;
      infoWin.setContent(html);
      infoWin.open({ map, anchor: anchorMarker });

      google.maps.event.addListenerOnce(infoWin, "domready", () => {
        const btn = document.getElementById("hm-route-here");
        if (!btn) return;
        btn.onclick = () => {
          destLL = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
          destPlaceId = placeId;
          placeDest(destLL);
          if (destInput?.value) destInput.value.value = place.formatted_address || place.name || "";
          canRoute.value = !!(userLL && destLL);
          statusText.value = "Destination selected. Calculating route…";
          routeNow();
          infoWin.close();
        };
      });
    }
  );
}

/** ====== Start marker (green dot) ====== **/
function ensureYouMarker() {
  if (!userLL || !map) return;
  const icon = {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: "#10b981",
    fillOpacity: 1,
    strokeWeight: 3,
    strokeColor: "#ffffff",
  };
  if (!youMarker) {
    youMarker = new google.maps.Marker({
      map,
      position: userLL,
      icon,
      title: "Start",
      zIndex: 9999,
      clickable: false,
    });
  } else {
    youMarker.setIcon(icon);
    youMarker.setPosition(userLL);
    youMarker.setMap(map);
  }
}

/** ====== Map init ====== **/
function initMap() {
  map = new google.maps.Map(mapEl.value, {
    center: { lat: -37.8136, lng: 144.9631 },
    zoom: 13,
    mapTypeControl: false,
    fullscreenControl: true,
    streetViewControl: false,
  });

  placesSvc = new google.maps.places.PlacesService(map);
  infoWin = new google.maps.InfoWindow({ maxWidth: 320 });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    suppressPolylines: true,
  });
  directionsRenderer.setMap(map);

  // Autocomplete (destination)
  autocomplete = new google.maps.places.Autocomplete(destInput.value, {
    fields: ["place_id", "geometry", "formatted_address", "name"],
    componentRestrictions: { country: "au" },
  });
  autocomplete.addListener("place_changed", () => {
    const p = autocomplete.getPlace();
    if (!p?.geometry?.location) return;
    destLL = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() };
    destPlaceId = p.place_id || null;
    placeDest(destLL);
    canRoute.value = !!(userLL && destLL);
    statusText.value = "Destination selected.";
    if (destPlaceId) showPlaceDetails(destPlaceId, destMarker);
    // Wait for user to click "Find Routes"
  });

  // 先監聽定位權限狀態
  initGeoPermissionWatch();

  // Auto locate user
  navigator.geolocation?.getCurrentPosition(
    (pos) => {
      userLL = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setCenter(userLL);
      map.setZoom(14);
      reverseGeocode(userLL, (addr) => (fromAddr.value = addr));
      ensureYouMarker();                 // show green dot
      canRoute.value = !!(userLL && destLL);
      statusText.value = "Your location is set.";
    },
    // 失敗：提示並打開手動輸入
    (err) => {
      console.warn("getCurrentPosition failed:", err);
      fromAddr.value = "Location permission denied";
      alertText.value = "Location permission denied. Please enter a start location.";
      openFromEditor();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

function placeDest(ll) {
  if (!destMarker) {
    destMarker = new google.maps.Marker({
      position: ll, map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#ef4444",
        fillOpacity: 1,
        strokeWeight: 3,
        strokeColor: "#fff",
      },
      title: "Destination",
    });
    destMarker.addListener("click", () => {
      if (destPlaceId) showPlaceDetails(destPlaceId, destMarker);
    });
  } else {
    destMarker.setPosition(ll);
  }
}

/** ====== Routing + custom polyline ====== **/
function drawPolyline(path) {
  routeCasing = new google.maps.Polyline({
    path,
    strokeColor: "#0b1020",
    strokeOpacity: 0.9,
    strokeWeight: 8,
    map,
  });
  routePoly = new google.maps.Polyline({
    path,
    strokeColor: "#1d4ed8",
    strokeOpacity: 1,
    strokeWeight: 6,
    map,
  });
}

function routeNow() {
  if (!userLL || !destLL) return;
  clearRouteGraphics();
  routing.value = true;                        // a11y: mark map busy during routing
  statusText.value = "Calculating route…";

  const travelMode = google.maps.TravelMode[mode.value];
  directionsService.route(
    {
      origin: userLL,
      destination: destLL,
      travelMode,
      provideRouteAlternatives: false,
    },
    (res, status) => {
      routing.value = false;
      if (status !== "OK" || !res) {
        console.warn("Directions failed:", status);
        alertText.value = "Directions request failed.";
        return;
      }
      currentRoute = res.routes[0];

      const path = currentRoute.overview_path || [];
      drawPolyline(path);

      const leg = currentRoute.legs[0];
      stepEnds = leg.steps.map(s => s.end_location);
      stepTexts = leg.steps.map(s => stripHtml(s.instructions || ""));

      hasRoute.value = true;
      nextHint.value = stepTexts[0] || "Head to the route";
      remainKm.value = (leg.distance?.value ? (leg.distance.value / 1000).toFixed(1) : "—");
      etaMin.value = (leg.duration?.value ? Math.round(leg.duration.value / 60) : "—");

      statusText.value = `Route ready. ${remainKm.value} km, about ${etaMin.value} minutes.`;
      map.fitBounds(currentRoute.bounds, { padding: 60 });
    }
  );
}

/** ====== Search POIs in viewport ====== **/
function searchHere() {
  if (!map) return;
  clearPOIs();
  const bounds = map.getBounds();
  if (!bounds) return;

  statusText.value = `Searching “${poi.value}” in this area…`;
  placesSvc.textSearch({ query: poi.value, bounds }, (results, status) => {
    if (status !== "OK" || !results) {
      alertText.value = "No results found.";
      return;
    }
    results.slice(0, 20).forEach(r => {
      if (!r.geometry?.location) return;
      const m = new google.maps.Marker({
        position: r.geometry.location,
        map,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: "#10b981", fillOpacity: 1,
          strokeWeight: 1, strokeColor: "#0b7a5c",
        },
        title: r.name,
      });
      m.addListener("click", () => {
        if (r.place_id) {
          showPlaceDetails(r.place_id, m);
        } else {
          destLL = { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() };
          destPlaceId = null;
          placeDest(destLL);
          reverseGeocode(destLL, (addr) => {
            if (destInput?.value) destInput.value.value = addr;
          });
          canRoute.value = !!(userLL && destLL);
          statusText.value = "Destination selected. Calculating route…";
          routeNow();
        }
      });
      poiMarkers.push(m);
    });
    statusText.value = `Found ${results.length} result(s).`;
  });
}

/** ====== Re-locate (refresh user position) ====== **/
function reLocate() {
  statusText.value = "Locating your position…";
  navigator.geolocation?.getCurrentPosition(
    (pos) => {
      userLL = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.panTo(userLL);
      reverseGeocode(userLL, (addr) => (fromAddr.value = addr));
      ensureYouMarker();                 // keep green dot in sync
      canRoute.value = !!(userLL && destLL);
      closeFromEditor();
      if (destLL) routeNow();
      statusText.value = "Location updated.";
    },
    // 失敗也切為手動輸入
    (err) => {
      console.warn("reLocate failed:", err);
      alertText.value = "Unable to get your location. Please enter it manually.";
      openFromEditor();
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/** ====== Navigation (watchPosition + HUD updates) ====== **/
function startNavigation() {
  if (!currentRoute || !userLL) return;
  navigating.value = true;
  lastSpokenKey = "";
  speakOnce("nav-start", "Navigation started. Follow the blue line.");
  statusText.value = "Navigation started.";

  infoWin?.close?.();

  const baseZoom = getNavZoomByMode();
  const initHeading = prevLL ? bearingDeg(prevLL, userLL) : (bearingFromRouteStart());
  flyCamera(userLL, { zoom: baseZoom, tilt: 65, heading: initHeading });

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const newLL = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userLL = newLL;

      ensureYouMarker(); // update position of green dot

      const spd = pos.coords.speed;
      const base = getNavZoomByMode();
      const zoom = adjustZoomBySpeed(base, spd);
      const hdg = prevLL ? bearingDeg(prevLL, userLL) : initHeading;

      flyCamera(userLL, { zoom, tilt: 65, heading: hdg });
      prevLL = userLL;

      updateProgressAndHints(userLL);
    },
    () => { alertText.value = "Lost GPS signal."; },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
  );
}

function stopNavigation() {
  navigating.value = false;
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  lastSpokenKey = "";
  prevLL = null;
  clearRouteGraphics();
  statusText.value = "Navigation stopped.";
}

// Simple Haversine (meters)
function hav(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
  const h = s1*s1 + Math.cos(la1)*Math.cos(la2)*s2*s2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function updateProgressAndHints(me) {
  if (!currentRoute) return;
  const leg = currentRoute.legs[0];

  let nextIdx = stepEnds.length - 1;
  for (let i = 0; i < stepEnds.length; i++) {
    const d = hav(me, { lat: stepEnds[i].lat(), lng: stepEnds[i].lng() });
    if (d > 50) { nextIdx = i; break; }
  }
  const hint = stepTexts[nextIdx] || "Continue";
  nextHint.value = hint;

  try {
    const dToNext = hav(me, { lat: stepEnds[nextIdx].lat(), lng: stepEnds[nextIdx].lng() });
    if (dToNext <= 120) {
      const key = `turn-${nextIdx}`;
      speakOnce(key, hint);
    }
  } catch {}

  const totalM = leg.distance?.value || 0;
  const remainSteps = Math.max(1, stepEnds.length - nextIdx);
  const frac = remainSteps / Math.max(1, stepEnds.length);
  const remM = Math.max(0, Math.round(frac * totalM));
  remainKm.value = (remM / 1000).toFixed(1);

  const totalS = leg.duration?.value || 0;
  etaMin.value = Math.max(1, Math.round(frac * (totalS / 60)));

  const end = leg.end_location;
  if (hav(me, { lat: end.lat(), lng: end.lng() }) < 60) {
    nextHint.value = "You have arrived.";
    speakOnce("arrived", "You have arrived.");
    statusText.value = "You have arrived.";
    stopNavigation();
  }
}

/** ====== From editor (manual entry) ====== **/
function openFromEditor() {
  editingFrom.value = true;
  nextTick(() => {
    if (!fromInputEl.value) return;
    fromAutocomplete = new google.maps.places.Autocomplete(fromInputEl.value, {
      fields: ["place_id", "geometry", "formatted_address", "name"],
    });
    fromAutocomplete.addListener("place_changed", () => {
      const p = fromAutocomplete.getPlace();
      if (!p?.geometry?.location) return;
      userLL = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() };
      fromAddr.value = p.formatted_address || p.name || `${userLL.lat.toFixed(5)}, ${userLL.lng.toFixed(5)}`;
      map.panTo(userLL);
      ensureYouMarker();                 // ensure green dot exists after manual set
      canRoute.value = !!(userLL && destLL);
      statusText.value = "Start location updated.";
    });
  });
}
function closeFromEditor() {
  editingFrom.value = false;
  fromAutocomplete = null;
}
function useCurrentLocationInstead() {
  editingFrom.value = false;
  reLocate();
}

/** ====== watchers & lifecycle ====== **/
watch(mode, () => { if (destLL) routeNow(); });

onMounted(() => loadGoogle(initMap));

onBeforeUnmount(() => {
  stopNavigation();
  clearPOIs();
  clearRouteGraphics();
});
</script>

<template>
  <!-- Section landmark with an explicit name via aria-labelledby -->
  <section class="hm-card" :aria-labelledby="'map-title'">
    <!-- Page/section title -->
    <h2 id="map-title" class="hm-title">Plan Your Route</h2>

    <!-- Live regions for screen readers -->
    <!-- Polite status updates (route ready, search done, etc.) -->
    <p class="small text-muted" aria-live="polite">{{ statusText }}</p>
    <!-- Assertive alerts for failures or important notices -->
    <p v-if="alertText" class="small text-danger" role="alert" aria-live="assertive">{{ alertText }}</p>

    <!-- From -->
    <div class="hm-row">
      <label class="hm-label">From</label>

      <!-- Display mode -->
      <div v-if="!editingFrom" class="hm-from">
        <span class="hm-dot" aria-hidden="true"></span>
        <span class="hm-addr">{{ fromAddr }}</span>
        <div class="hm-from-actions">
          <button class="hm-ghost" type="button" @click="reLocate">Use current</button>
          <button class="hm-ghost" type="button" @click="openFromEditor">Enter Location</button>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="hm-from-editor">
        <input
          ref="fromInputEl"
          class="hm-input"
          placeholder="Type a start address or place…"
          aria-label="From address"
        />
        <div class="hm-from-editor-actions">
          <button class="hm-link" type="button" @click="useCurrentLocationInstead">
            Use current location instead
          </button>
          <button class="hm-ghost" type="button" @click="closeFromEditor">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Destination -->
    <div class="hm-row">
      <label class="hm-label" for="dest-input">Destination</label>
      <input
        id="dest-input"
        ref="destInput"
        class="hm-input"
        placeholder="Search places (e.g., Monash University, QV, State Library)"
        aria-label="Destination"
      />
    </div>

    <!-- Toolbar: group of map controls with a clear name; link to the map via aria-controls -->
    <div class="hm-toolbar" role="group" aria-label="Map controls" aria-controls="hm-map">
      <select v-model="mode" class="hm-select" aria-label="Travel mode">
        <option value="WALKING">Walking</option>
        <option value="BICYCLING">Cycling</option>
        <option value="DRIVING">Driving</option>
        <option value="TRANSIT">Transit</option>
      </select>

      <select v-model="poi" class="hm-select" aria-label="Place type">
        <option value="supermarket">Supermarket</option>
        <option value="grocery">Grocery</option>
        <option value="health food store">Health Food Store</option>
        <option value="farmers market">Farmers Market</option>
      </select>

      <button class="hm-ghost" type="button" @click="searchHere">🔎 Search this area</button>

      <label class="hm-switch">
        <input type="checkbox" v-model="speak" />
        <span>Voice</span>
      </label>
    </div>

    <!-- Map: focusable region with roledescription; mark busy while routing -->
    <div
      id="hm-map"
      ref="mapEl"
      class="hm-map"
      role="region"
      :aria-roledescription="'interactive map'"
      tabindex="0"
      :aria-busy="routing ? 'true' : 'false'"
      :aria-label="'Map viewport'"
    ></div>

    <!-- Actions -->
    <div class="hm-actions">
      <button class="hm-primary" :disabled="!canRoute" @click="routeNow">
        Find Routes
      </button>

      <button
        v-if="hasRoute && !navigating"
        class="hm-secondary"
        type="button"
        @click="startNavigation"
      >
        Start Navigation
      </button>

      <button
        v-if="navigating"
        class="hm-danger"
        type="button"
        @click="stopNavigation"
      >
        Stop Navigation
      </button>
    </div>

    <!-- HUD (next instruction is also useful to announce continuously while navigating) -->
    <div v-if="hasRoute" class="hud" aria-label="Route status">
      <div class="hud-item">
        <div class="hud-num">{{ remainKm }}</div>
        <div class="hud-label">km left</div>
      </div>
      <div class="hud-item">
        <div class="hud-num">{{ etaMin }}</div>
        <div class="hud-label">min ETA</div>
      </div>
      <!-- Make next step polite live so SR users hear updates as they move -->
      <div class="hud-next" aria-live="polite">{{ nextHint }}</div>
    </div>
  </section>
</template>

<style scoped>
/* Card & layout */
.hm-card{max-width:980px;margin:24px auto;padding:16px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.06)}
.hm-title{margin:0 0 8px 0;font-weight:800;font-size:24px}
.hm-row{margin:10px 0;display:flex;flex-direction:column;gap:8px}
.hm-label{color:#111827;font-weight:700}
.hm-from{display:flex;align-items:center;gap:10px;background:#e8f5e9;border:1px solid #b7e4c7;padding:10px 12px;border-radius:10px}
.hm-dot{width:10px;height:10px;border-radius:50%;background:#22c55e}
.hm-addr{font-weight:700;color:#065f46;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.hm-from-actions{display:flex;gap:8px;margin-left:auto}
.hm-ghost{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer}
.hm-input{padding:10px 12px;border:1px solid #d1d5db;border-radius:8px}
.hm-toolbar{display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap}
.hm-select{padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff}
.hm-switch{display:flex;align-items:center;gap:6px;font-size:14px;color:#111827}
.hm-map{height:420px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.hm-actions{display:flex;gap:8px;margin-top:12px}
.hm-primary{flex:1;padding:12px 14px;border-radius:10px;border:0;background:#0f172a;color:#fff;font-weight:800}
.hm-secondary{padding:12px 14px;border-radius:10px;border:1px solid #0f172a;background:#fff;color:#0f172a;font-weight:800}
.hm-danger{padding:12px 14px;border-radius:10px;border:1px solid #ef4444;background:#ef4444;color:#fff;font-weight:800}
.hm-primary:disabled{opacity:.55;cursor:not-allowed}

/* From editor */
.hm-from-editor{display:flex;flex-direction:column;gap:8px}
.hm-from-editor-actions{display:flex;align-items:center;gap:12px}
.hm-link{border:0;background:transparent;color:#2563eb;font-weight:700;cursor:pointer;padding:6px 0}

/* HUD */
.hud{display:flex;align-items:center;gap:16px;margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px}
.hud-item{text像:center;min-width:80px}
.hud-num{font-weight:900;font-size:20px}
.hud-label{font-size:12px;color:#6b7280}
.hud-next{flex:1;font-weight:700;color:#111827}

@media (max-width:768px){ .hm-map{height:60vh} }
</style>