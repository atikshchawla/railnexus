const CONFIG = { world: "http://localhost:9001", bridge: "http://localhost:9002", memberB: "http://localhost:8787" };
const state = { network: null, world: null, memberB: null, tick: 0, paused: false, previousSections: new Map(), eventLog: [] };

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
const sectionColor = (section, reflected = null) => {
  if (section.fault || reflected === "Block active") return "#f36b67";
  if (reflected === "Reserved") return "#69a8ff";
  if (section.occupiedBy) return "#f1b84b";
  return "#52d18b";
};
const sectionState = (section) => section.fault ? "Maintenance" : section.occupiedBy ? "Occupied" : "Clear";

function renderMap(element, network, snapshot, reflectedSections = []) {
  if (!network || !snapshot) { element.innerHTML = '<p class="empty-state map-empty">Waiting for live network data…</p>'; return; }
  const stations = network.stations;
  const minLon = Math.min(...stations.map((station) => station.longitude));
  const maxLon = Math.max(...stations.map((station) => station.longitude));
  const minLat = Math.min(...stations.map((station) => station.latitude));
  const maxLat = Math.max(...stations.map((station) => station.latitude));
  const x = (lon) => 9 + ((lon - minLon) / (maxLon - minLon || 1)) * 82;
  const y = (lat) => 86 - ((lat - minLat) / (maxLat - minLat || 1)) * 72;
  const reflected = new Map(reflectedSections.map((section) => [section.id, section.state]));
  const sectionById = new Map(snapshot.sections.map((section) => [section.id, section]));
  const lines = network.sections.map((section) => {
    const current = sectionById.get(section.id) || section;
    const style = sectionColor(current, reflected.get(section.id));
    const pulse = state.previousSections.get(section.id) && state.previousSections.get(section.id) !== sectionState(current) ? "pulse" : "";
    return `<line class="section-line ${pulse}" x1="${x(section.from.longitude)}%" y1="${y(section.from.latitude)}%" x2="${x(section.to.longitude)}%" y2="${y(section.to.latitude)}%" stroke="${style}" style="color:${style}" data-section="${section.id}"/><title>${escapeHtml(section.id)} · ${escapeHtml(sectionState(current))}</title>`;
  }).join("");
  const nodes = stations.map((station) => `<g><circle class="station-node" cx="${x(station.longitude)}%" cy="${y(station.latitude)}%" r="1.1"/><text class="station-label" x="${x(station.longitude)}%" y="${y(station.latitude) - 2}%" text-anchor="middle">${escapeHtml(station.code)}</text></g>`).join("");
  const trains = snapshot.trains.map((train) => {
    const current = network.sections.find((section) => train.km >= section.from.km && train.km <= section.to.km) || network.sections[0];
    if (!current) return "";
    const progress = Math.max(0, Math.min(1, (train.km - current.from.km) / (current.to.km - current.from.km || 1)));
    const lon = current.from.longitude + (current.to.longitude - current.from.longitude) * progress;
    const lat = current.from.latitude + (current.to.latitude - current.from.latitude) * progress;
    const color = train.status === "delayed" ? "#f1b84b" : train.status === "stopped" ? "#f36b67" : "#e8eef1";
    return `<g class="train-marker"><circle class="train-dot" cx="${x(lon)}%" cy="${y(lat)}%" r="1.7" fill="${color}" style="color:${color}"/><text class="train-label" x="${x(lon) + 1.5}%" y="${y(lat)}%">${escapeHtml(train.id)}</text><title>${escapeHtml(train.name)} · ${train.km.toFixed(1)} km</title></g>`;
  }).join("");
  element.innerHTML = `<svg class="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="AJJ to JTJ live train map"><path class="route" d="M ${stations.map((station) => `${x(station.longitude)} ${y(station.latitude)}`).join(" L ")}" vector-effect="non-scaling-stroke"/>${lines}${nodes}${trains}</svg>`;
}

function fillNetworkControls() {
  const sections = state.network?.sections || [];
  const trains = state.world?.trains || [];
  const options = sections.map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.id)}</option>`).join("");
  $("sectionInput").innerHTML = options;
  $("faultSectionInput").innerHTML = options;
  $("trainInput").innerHTML = '<option value="">No train</option>' + trains.map((train) => `<option value="${escapeHtml(train.id)}">${escapeHtml(train.id)} · ${escapeHtml(train.name)}</option>`).join("");
}

function renderWorld() {
  const world = state.world;
  if (!world) return;
  $("tickValue").textContent = String(state.tick);
  $("worldTick").textContent = String(state.tick);
  $("trainCount").textContent = `${world.trains.length} trains`;
  $("sectionCount").textContent = `${world.sections.length} sections`;
  $("trainTable").innerHTML = world.trains.map((train) => `<tr><td>${escapeHtml(train.id)}</td><td>${escapeHtml(train.heldSectionIds[0] || train.nextSectionId)}</td><td class="status-${train.status}">${escapeHtml(train.status)}</td><td>${train.delayMinutes ? `${train.delayMinutes.toFixed(0)}m` : "0m"}</td><td>${train.speedKmh.toFixed(0)} km/h</td></tr>`).join("");
  $("sectionTable").innerHTML = world.sections.map((section) => `<tr><td>${escapeHtml(section.id)}</td><td>${escapeHtml(section.occupiedBy || "—")}</td><td class="state-${sectionState(section).toLowerCase()}">${escapeHtml(sectionState(section))}</td><td>${escapeHtml(section.fault || "—")}</td></tr>`).join("");
  $("rawFeed").textContent = JSON.stringify(world, null, 2);
  renderMap($("worldMap"), state.network, world);
}

function renderRequests() {
  const api = state.memberB;
  if (!api) return;
  const requests = ["TMS", "TDMS", "SMMS"].flatMap((department) => (api.departments?.[department]?.requests || []).map((request) => ({ ...request, department })));
  const decisions = new Map((api.decisions || []).map((decision) => [decision.requestId, decision]));
  requests.sort((a, b) => new Date(b.raisedAt) - new Date(a.raisedAt));
  $("requestCount").textContent = `${requests.length} events`;
  $("requestFeed").innerHTML = requests.slice(0, 18).map((request) => {
    const decision = decisions.get(request.id);
    const status = decision ? decision.decision.toUpperCase() : "RAISED";
    return `<article class="request-item"><div class="request-meta"><span>${escapeHtml(request.department)} · ${escapeHtml(request.type)}</span><span>${status}</span></div><div class="request-title">${escapeHtml(request.description)}</div><div class="request-meta"><span>${escapeHtml(request.sectionId)}${request.trainId ? ` · ${escapeHtml(request.trainId)}` : ""}</span><span class="request-status">${decision ? "ABP resolved" : "Awaiting ABP"}</span></div></article>`;
  }).join("") || '<p class="empty-state">Waiting for the first live request.</p>';
  renderMap($("coaMap"), state.network, state.world, api.sections || []);
}

async function getJson(url) { const response = await fetch(url, { cache: "no-store" }); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function refresh() {
  try {
    const [network, world, memberB] = await Promise.all([getJson(`${CONFIG.world}/network`), getJson(`${CONFIG.bridge}/world`), getJson(`${CONFIG.memberB}/api/state`)]);
    state.network = network; state.world = world; state.memberB = memberB; state.tick += 1;
    $("connectionBadge").textContent = "LIVE"; $("connectionBadge").className = "connection online";
    $("corridorLabel").textContent = network.corridor;
    $("lastUpdate").textContent = `Updated ${new Date(world.timestamp).toLocaleTimeString()}`;
    fillNetworkControls(); renderWorld(); renderRequests();
    state.previousSections = new Map(world.sections.map((section) => [section.id, sectionState(section)]));
  } catch (error) {
    $("connectionBadge").textContent = "OFFLINE"; $("connectionBadge").className = "connection offline";
    $("lastUpdate").textContent = `Feed unavailable: ${error.message}`;
  }
}

async function postJson(url, body) { const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`${response.status}`); return response.json(); }
$("injectForm").addEventListener("submit", async (event) => { event.preventDefault(); const message = $("injectMessage"); try { await postJson(`${CONFIG.memberB}/api/inject`, { department: $("departmentInput").value, type: $("typeInput").value, sectionId: $("sectionInput").value, trainId: $("trainInput").value || undefined }); message.textContent = "Request submitted to ABP."; await refresh(); } catch (error) { message.textContent = `Request failed: ${error.message}`; } });
$("faultButton").addEventListener("click", async () => { try { await postJson(`${CONFIG.world}/faults`, { sectionId: "MCN-KPD", description: "OHE isolator failure" }); await refresh(); } catch (error) { $("lastUpdate").textContent = `Fault failed: ${error.message}`; } });
$("worldFaultButton").addEventListener("click", async () => { try { await postJson(`${CONFIG.world}/faults`, { sectionId: $("faultSectionInput").value, description: $("faultDescriptionInput").value }); await refresh(); } catch (error) { $("lastUpdate").textContent = `Fault failed: ${error.message}`; } });
$("clearFaultButton").addEventListener("click", async () => { try { await fetch(`${CONFIG.world}/faults/${encodeURIComponent($("faultSectionInput").value)}`, { method: "DELETE" }); await refresh(); } catch (error) { $("lastUpdate").textContent = `Clear failed: ${error.message}`; } });
$("pauseButton").addEventListener("click", () => { state.paused = !state.paused; $("pauseButton").textContent = state.paused ? "Resume feed" : "Pause feed"; });
$("worldPauseButton").addEventListener("click", () => { state.paused = !state.paused; $("worldPauseButton").textContent = state.paused ? "Resume" : "Pause"; });
document.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".mode-button").forEach((item) => item.classList.remove("active")); button.classList.add("active"); document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view")); $(`${button.dataset.mode}View`).classList.add("active-view"); }));
setInterval(() => { if (!state.paused) refresh(); }, 1000); refresh();
