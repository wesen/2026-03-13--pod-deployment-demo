import { useState, useRef, useCallback, useEffect } from "react";

/* ═══════════════════════════════════════════
   UI DSL TYPES:
   { type: "slider",  key: "path.to.field", label, min, max, step }
   { type: "toggle",  key: "path.to.field", label }
   { type: "select",  key: "path.to.field", label, options: [...] }
   { type: "buttons", key: "path.to.field", label, options: [...] }
   { type: "group",   label, children: [...controls] }
   ═══════════════════════════════════════════ */

const PRESETS = {
  "space-station": {
    name: "Space station life support",
    icon: "🛸",
    ui: [
      { type: "group", label: "atmosphere", children: [
        { type: "slider", key: "o2Percent", label: "O\u2082 target %", min: 15, max: 30, step: 0.5 },
        { type: "slider", key: "co2Ppm", label: "CO\u2082 max ppm", min: 200, max: 2000, step: 50 },
        { type: "slider", key: "pressureKpa", label: "Pressure kPa", min: 80, max: 110, step: 1 },
      ]},
      { type: "group", label: "habitat", children: [
        { type: "slider", key: "tempC", label: "Temperature \u00b0C", min: 16, max: 28, step: 0.5 },
        { type: "slider", key: "crewAwake", label: "Crew awake", min: 0, max: 6, step: 1 },
        { type: "toggle", key: "hydroponicsOn", label: "Hydroponics active" },
      ]},
    ],
    spec: `{
  "o2Percent": 21,
  "co2Ppm": 800,
  "pressureKpa": 101,
  "tempC": 22,
  "crewAwake": 4,
  "hydroponicsOn": true
}`,
    observe: `const a = state.actual || {
  o2: 18.5, co2: 1400, pressure: 97, temp: 19,
  crewAwake: 2, hydroponics: false,
  solarOutput: 0.7, scrubberHealth: 0.85
};
// crew breathes O2, exhales CO2
const breathing = a.crewAwake * 0.3;
a.o2 = Math.max(12, a.o2 - breathing * 0.1 + (a.hydroponics ? 0.4 : 0));
a.co2 = Math.min(3000, a.co2 + breathing * 40 - (state.scrubbing ? 200 : 0));
// thermal drift
a.temp += (Math.random() - 0.45) * 0.8;
// pressure leak
a.pressure -= Math.random() * 0.3;
if (state.repressurizing) { a.pressure += 2; state.repressurizing = false; }
if (state.ventilating) { a.co2 -= 300; state.ventilating = false; }
if (state.heatingUp) { a.temp += 1.5; state.heatingUp = false; }
if (state.coolingDown) { a.temp -= 1.5; state.coolingDown = false; }
if (state.toggleHydro !== undefined) { a.hydroponics = state.toggleHydro; delete state.toggleHydro; }
a.crewAwake = JSON.parse(spec).crewAwake;
a.solarOutput = 0.5 + Math.random() * 0.5;
state.actual = a;
return { o2: +a.o2.toFixed(1), co2: Math.round(a.co2), pressure: +a.pressure.toFixed(1), temp: +a.temp.toFixed(1), crewAwake: a.crewAwake, hydroponics: a.hydroponics, solar: +a.solarOutput.toFixed(2) };`,
    compare: `const d = {};
if (Math.abs(actual.o2 - desired.o2Percent) > 1.5)
  d.o2 = { want: desired.o2Percent, have: actual.o2 };
if (actual.co2 > desired.co2Ppm)
  d.co2 = { have: actual.co2, max: desired.co2Ppm };
if (Math.abs(actual.pressure - desired.pressureKpa) > 3)
  d.pressure = { want: desired.pressureKpa, have: actual.pressure };
if (Math.abs(actual.temp - desired.tempC) > 2)
  d.temp = { want: desired.tempC, have: actual.temp };
if (actual.hydroponics !== desired.hydroponicsOn)
  d.hydroponics = { want: desired.hydroponicsOn, have: actual.hydroponics };
return d;`,
    plan: `const actions = [];
if (d.co2) actions.push({ type: "scrub-co2", level: d.co2.have });
if (d.pressure && d.pressure.have < d.pressure.want) actions.push({ type: "repressurize" });
if (d.temp && d.temp.have < d.temp.want) actions.push({ type: "heat" });
if (d.temp && d.temp.have > d.temp.want) actions.push({ type: "cool" });
if (d.hydroponics) actions.push({ type: "toggle-hydroponics", to: d.hydroponics.want });
if (d.o2 && d.o2.have < d.o2.want) actions.push({ type: "boost-o2" });
return actions;`,
    execute: `for (const a of actions) {
  if (a.type === "scrub-co2") { log("Activating CO\\u2082 scrubbers (" + a.level + "ppm)"); state.scrubbing = true; }
  if (a.type === "repressurize") { log("Repressurizing hull"); state.repressurizing = true; }
  if (a.type === "heat") { log("Engaging thermal heaters"); state.heatingUp = true; }
  if (a.type === "cool") { log("Radiator panels deployed"); state.coolingDown = true; }
  if (a.type === "toggle-hydroponics") { log((a.to ? "Starting" : "Stopping") + " hydroponics bay"); state.toggleHydro = a.to; }
  if (a.type === "boost-o2") { log("Electrolyzing reserve water for O\\u2082"); state.actual.o2 += 0.8; }
}
if (!actions.length) log("\\u2713 Station nominal");
state.scrubbing = actions.some(a => a.type === "scrub-co2");`
  },

  "taco-fleet": {
    name: "Taco truck fleet dispatch",
    icon: "🌮",
    ui: [
      { type: "group", label: "fleet", children: [
        { type: "slider", key: "trucks", label: "Active trucks", min: 1, max: 8, step: 1 },
        { type: "buttons", key: "salsaPolicy", label: "Salsa stance", options: ["conservative", "generous", "chaos"] },
      ]},
      { type: "group", label: "demand", children: [
        { type: "slider", key: "demandMultiplier", label: "Hunger level", min: 0.5, max: 3, step: 0.1 },
        { type: "toggle", key: "lunchRush", label: "Lunch rush mode" },
        { type: "select", key: "hotZone", label: "Priority zone", options: ["downtown", "campus", "beach", "warehouse-district"] },
      ]},
    ],
    spec: `{
  "trucks": 3,
  "salsaPolicy": "generous",
  "demandMultiplier": 1.5,
  "lunchRush": false,
  "hotZone": "campus"
}`,
    observe: `const a = state.actual || {
  trucks: [
    { id: "T1", zone: "downtown", tacos: 120, salsa: 80 },
    { id: "T2", zone: "beach", tacos: 90, salsa: 60 }
  ],
  orders: 0, satisfied: 0, angry: 0
};
const d = JSON.parse(spec);
// simulate orders
const baseOrders = Math.floor(15 * d.demandMultiplier * (d.lunchRush ? 2.5 : 1));
const newOrders = baseOrders + Math.floor(Math.random() * 10);
// trucks serve tacos
let served = 0;
for (const t of a.trucks) {
  const demand = t.zone === d.hotZone ? Math.ceil(newOrders * 0.4) : Math.ceil(newOrders * 0.2);
  const canServe = Math.min(demand, t.tacos);
  t.tacos = Math.max(0, t.tacos - canServe);
  const salsaUse = d.salsaPolicy === "chaos" ? canServe * 3 : d.salsaPolicy === "generous" ? canServe * 2 : canServe;
  t.salsa = Math.max(0, t.salsa - salsaUse);
  served += canServe;
  if (state["restock-" + t.id]) { t.tacos += 80; t.salsa += 60; delete state["restock-" + t.id]; }
}
if (state.addTruck) {
  a.trucks.push({ id: "T" + (a.trucks.length + 1), zone: d.hotZone, tacos: 100, salsa: 70 });
  delete state.addTruck;
}
if (state.removeTruck && a.trucks.length > 1) { a.trucks.pop(); delete state.removeTruck; }
a.orders = newOrders;
a.satisfied = served;
a.angry = Math.max(0, newOrders - served);
state.actual = a;
return { trucks: a.trucks.map(t => ({...t})), orders: a.orders, satisfied: a.satisfied, angry: a.angry };`,
    compare: `const d = {};
const des = desired;
if (actual.trucks.length !== des.trucks)
  d.truckCount = { want: des.trucks, have: actual.trucks.length };
const lowTacos = actual.trucks.filter(t => t.tacos < 20);
if (lowTacos.length) d.lowTacos = lowTacos.map(t => t.id);
const lowSalsa = actual.trucks.filter(t => t.salsa < 15);
if (lowSalsa.length) d.lowSalsa = lowSalsa.map(t => t.id);
const misplaced = actual.trucks.filter(t => t.zone !== des.hotZone);
if (actual.angry > actual.orders * 0.3 && misplaced.length)
  d.rebalance = { hotZone: des.hotZone, trucks: misplaced.map(t => t.id) };
return d;`,
    plan: `const actions = [];
if (d.truckCount) {
  if (d.truckCount.have < d.truckCount.want) actions.push({ type: "dispatch-truck" });
  else actions.push({ type: "recall-truck" });
}
if (d.lowTacos) d.lowTacos.forEach(id => actions.push({ type: "restock", truck: id, item: "tacos" }));
if (d.lowSalsa) d.lowSalsa.forEach(id => actions.push({ type: "restock", truck: id, item: "salsa" }));
if (d.rebalance) actions.push({ type: "reroute", trucks: d.rebalance.trucks, to: d.rebalance.hotZone });
return actions;`,
    execute: `for (const a of actions) {
  if (a.type === "dispatch-truck") { log("\\u{1F69A} Dispatching new truck"); state.addTruck = true; }
  if (a.type === "recall-truck") { log("\\u{1F44B} Recalling a truck"); state.removeTruck = true; }
  if (a.type === "restock") { log("\\u{1F4E6} Restocking " + a.truck + " with " + a.item); state["restock-" + a.truck] = true; }
  if (a.type === "reroute") { log("\\u{1F4CD} Rerouting " + a.trucks.join(", ") + " \\u2192 " + a.to); state.actual.trucks.forEach(t => { if (a.trucks.includes(t.id)) t.zone = a.to; }); }
}
if (!actions.length) log("\\u{1F389} Fleet is vibing");`
  },

  "zombie-defense": {
    name: "Zombie perimeter defense",
    icon: "🧟",
    ui: [
      { type: "group", label: "defenses", children: [
        { type: "slider", key: "wallLayers", label: "Wall layers", min: 1, max: 5, step: 1 },
        { type: "slider", key: "turrets", label: "Turret count", min: 0, max: 10, step: 1 },
        { type: "toggle", key: "electrifiedFence", label: "Electrified fence" },
      ]},
      { type: "group", label: "resources", children: [
        { type: "slider", key: "minAmmo", label: "Min ammo reserve", min: 50, max: 500, step: 25 },
        { type: "buttons", key: "alertLevel", label: "Alert level", options: ["green", "yellow", "red"] },
      ]},
    ],
    spec: `{
  "wallLayers": 3,
  "turrets": 6,
  "electrifiedFence": true,
  "minAmmo": 200,
  "alertLevel": "yellow"
}`,
    observe: `const a = state.actual || {
  walls: 1, wallHp: [100],
  turrets: 2, turretAmmo: [50, 50],
  fenceOn: false, fenceCharge: 0,
  zombiesNearby: 15, zombiesBreaching: 0,
  kills: 0, breaches: 0
};
const des = JSON.parse(spec);
// zombie waves
const waveMult = des.alertLevel === "red" ? 3 : des.alertLevel === "yellow" ? 1.8 : 1;
const newZ = Math.floor((8 + Math.random() * 12) * waveMult);
a.zombiesNearby = newZ;
// turrets fire
let killed = 0;
for (let i = 0; i < a.turrets; i++) {
  if ((a.turretAmmo[i] || 0) > 0) { const k = Math.min(3, a.zombiesNearby - killed); killed += k; a.turretAmmo[i] -= k * 2; }
}
// fence zaps
if (a.fenceOn && a.fenceCharge > 10) { const zap = Math.min(5, a.zombiesNearby - killed); killed += zap; a.fenceCharge -= zap * 5; }
const surviving = Math.max(0, a.zombiesNearby - killed);
// walls take damage
a.zombiesBreaching = surviving;
if (surviving > 0 && a.walls > 0) {
  a.wallHp[a.walls - 1] -= surviving * 8;
  if (a.wallHp[a.walls - 1] <= 0) { a.walls--; a.wallHp.pop(); a.breaches++; }
}
a.kills += killed;
// apply pending actions
if (state.buildWall) { a.walls++; a.wallHp.push(100); delete state.buildWall; }
if (state.addTurret) { a.turrets++; a.turretAmmo.push(80); delete state.addTurret; }
if (state.removeTurret && a.turrets > 0) { a.turrets--; a.turretAmmo.pop(); delete state.removeTurret; }
if (state.reloadAll) { a.turretAmmo = a.turretAmmo.map(() => 80); delete state.reloadAll; }
if (state.toggleFence !== undefined) { a.fenceOn = state.toggleFence; delete state.toggleFence; }
a.fenceCharge = Math.min(100, a.fenceCharge + (a.fenceOn ? 0 : 8));
state.actual = a;
return { walls: a.walls, wallHp: a.wallHp.map(h => Math.round(h)), turrets: a.turrets, ammo: a.turretAmmo.map(x => Math.max(0,x)), fenceOn: a.fenceOn, charge: Math.round(a.fenceCharge), nearby: a.zombiesNearby, breaching: a.zombiesBreaching, totalKills: a.kills, breaches: a.breaches };`,
    compare: `const d = {};
if (actual.walls < desired.wallLayers) d.needWalls = { want: desired.wallLayers, have: actual.walls };
if (actual.turrets < desired.turrets) d.needTurrets = { want: desired.turrets, have: actual.turrets };
if (actual.turrets > desired.turrets) d.excessTurrets = { want: desired.turrets, have: actual.turrets };
const totalAmmo = actual.ammo.reduce((s,x) => s+x, 0);
if (totalAmmo < desired.minAmmo) d.lowAmmo = { have: totalAmmo, min: desired.minAmmo };
if (actual.fenceOn !== desired.electrifiedFence) d.fence = { want: desired.electrifiedFence, have: actual.fenceOn };
if (actual.breaching > 5) d.overwhelmed = { count: actual.breaching };
return d;`,
    plan: `const actions = [];
if (d.needWalls) actions.push({ type: "build-wall" });
if (d.needTurrets) actions.push({ type: "deploy-turret" });
if (d.excessTurrets) actions.push({ type: "remove-turret" });
if (d.lowAmmo) actions.push({ type: "resupply" });
if (d.fence) actions.push({ type: "toggle-fence", on: d.fence.want });
if (d.overwhelmed) actions.push({ type: "emergency", count: d.overwhelmed.count });
return actions;`,
    execute: `for (const a of actions) {
  if (a.type === "build-wall") { log("\\u{1F9F1} Constructing wall layer"); state.buildWall = true; }
  if (a.type === "deploy-turret") { log("\\u{1F52B} Deploying turret"); state.addTurret = true; }
  if (a.type === "remove-turret") { log("Decommissioning turret"); state.removeTurret = true; }
  if (a.type === "resupply") { log("\\u{1F4E6} Emergency ammo resupply!"); state.reloadAll = true; }
  if (a.type === "toggle-fence") { log(a.on ? "\\u26A1 Fence electrified!" : "Fence powered down"); state.toggleFence = a.on; }
  if (a.type === "emergency") { log("\\u{1F6A8} BREACH! " + a.count + " zombies inside perimeter!"); }
}
if (!actions.length) log("\\u{1F6E1} Perimeter secure");`
  },

  "dj-set": {
    name: "Nightclub DJ controller",
    icon: "🎧",
    ui: [
      { type: "group", label: "music", children: [
        { type: "slider", key: "targetBpm", label: "Target BPM", min: 80, max: 180, step: 5 },
        { type: "buttons", key: "genre", label: "Genre", options: ["house", "techno", "dnb", "ambient"] },
        { type: "slider", key: "targetEnergy", label: "Energy level", min: 1, max: 10, step: 1 },
      ]},
      { type: "group", label: "vibes", children: [
        { type: "slider", key: "fogDensity", label: "Fog density %", min: 0, max: 100, step: 10 },
        { type: "buttons", key: "lightMode", label: "Lights", options: ["strobe", "wash", "laser", "blackout"] },
        { type: "toggle", key: "confettiCannon", label: "Confetti cannon armed" },
      ]},
    ],
    spec: `{
  "targetBpm": 128,
  "genre": "house",
  "targetEnergy": 7,
  "fogDensity": 60,
  "lightMode": "laser",
  "confettiCannon": false
}`,
    observe: `const a = state.actual || {
  bpm: 110, genre: "ambient", energy: 3,
  fog: 20, lights: "wash", crowdMood: 5,
  danceFloorPct: 30, confettiLoaded: true, drinkSales: 0
};
const d = JSON.parse(spec);
// crowd reacts to energy gap
const energyGap = d.targetEnergy - a.energy;
a.crowdMood = Math.max(1, Math.min(10, a.crowdMood + (energyGap > 0 ? -0.5 : 0.3) + (Math.random() - 0.4)));
a.danceFloorPct = Math.max(5, Math.min(100, a.danceFloorPct + (a.energy - 5) * 3 + Math.floor(Math.random() * 10 - 5)));
a.drinkSales = Math.floor(a.danceFloorPct * 0.6 + Math.random() * 20);
// apply transitions
if (state.bpmShift) { a.bpm += Math.sign(d.targetBpm - a.bpm) * Math.min(8, Math.abs(d.targetBpm - a.bpm)); if (Math.abs(a.bpm - d.targetBpm) < 5) a.bpm = d.targetBpm; delete state.bpmShift; }
if (state.genreSwitch) { a.genre = d.genre; delete state.genreSwitch; }
if (state.energyPush) { a.energy = Math.min(10, Math.max(1, a.energy + Math.sign(d.targetEnergy - a.energy) * 2)); delete state.energyPush; }
if (state.fogAdjust) { a.fog = Math.min(100, Math.max(0, a.fog + Math.sign(d.fogDensity - a.fog) * 20)); delete state.fogAdjust; }
if (state.lightSwitch) { a.lights = d.lightMode; delete state.lightSwitch; }
if (state.fireConfetti) { a.confettiLoaded = false; a.crowdMood = Math.min(10, a.crowdMood + 3); a.danceFloorPct = Math.min(100, a.danceFloorPct + 25); delete state.fireConfetti; }
state.actual = a;
return { bpm: a.bpm, genre: a.genre, energy: Math.round(a.energy), fog: Math.round(a.fog), lights: a.lights, crowd: +a.crowdMood.toFixed(1), floor: Math.round(a.danceFloorPct) + "%", drinks: a.drinkSales, confettiReady: a.confettiLoaded };`,
    compare: `const d = {};
if (Math.abs(actual.bpm - desired.targetBpm) > 4) d.bpm = { want: desired.targetBpm, at: actual.bpm };
if (actual.genre !== desired.genre) d.genre = { want: desired.genre, playing: actual.genre };
if (Math.abs(actual.energy - desired.targetEnergy) > 1) d.energy = { want: desired.targetEnergy, at: actual.energy };
if (Math.abs(actual.fog - desired.fogDensity) > 15) d.fog = { want: desired.fogDensity, at: actual.fog };
if (actual.lights !== desired.lightMode) d.lights = { want: desired.lightMode, current: actual.lights };
if (desired.confettiCannon && actual.confettiReady && actual.crowd < 5) d.confetti = true;
return d;`,
    plan: `const actions = [];
if (d.bpm) actions.push({ type: "shift-bpm", from: d.bpm.at, to: d.bpm.want });
if (d.genre) actions.push({ type: "switch-genre", to: d.genre.want });
if (d.energy) actions.push({ type: "energy-push", to: d.energy.want });
if (d.fog) actions.push({ type: "fog-adjust" });
if (d.lights) actions.push({ type: "lights", to: d.lights.want });
if (d.confetti) actions.push({ type: "confetti" });
return actions;`,
    execute: `for (const a of actions) {
  if (a.type === "shift-bpm") { log("\\u{1F3B5} BPM " + a.from + " \\u2192 " + a.to); state.bpmShift = true; }
  if (a.type === "switch-genre") { log("\\u{1F3B6} Switching to " + a.to); state.genreSwitch = true; }
  if (a.type === "energy-push") { log("\\u{1F525} Pushing energy to " + a.to); state.energyPush = true; }
  if (a.type === "fog-adjust") { log("\\u{1F32B} Adjusting fog machines"); state.fogAdjust = true; }
  if (a.type === "lights") { log("\\u{1F4A1} Lights \\u2192 " + a.to); state.lightSwitch = true; }
  if (a.type === "confetti") { log("\\u{1F389} CONFETTI CANNON FIRED!"); state.fireConfetti = true; }
}
if (!actions.length) log("\\u{1F3B6} Crowd is feeling it");`
  },

  "aquarium": {
    name: "Aquarium ecosystem",
    icon: "🐠",
    ui: [
      { type: "group", label: "water", children: [
        { type: "slider", key: "targetPh", label: "Target pH", min: 6, max: 8.5, step: 0.1 },
        { type: "slider", key: "targetTempC", label: "Temp \u00b0C", min: 18, max: 30, step: 0.5 },
        { type: "toggle", key: "filterOn", label: "Filter pump" },
      ]},
      { type: "group", label: "inhabitants", children: [
        { type: "slider", key: "desiredFish", label: "Fish count", min: 2, max: 20, step: 1 },
        { type: "buttons", key: "feedSchedule", label: "Feeding", options: ["light", "normal", "heavy"] },
        { type: "toggle", key: "lightsOn", label: "Tank lights" },
      ]},
    ],
    spec: `{
  "targetPh": 7.2,
  "targetTempC": 25,
  "filterOn": true,
  "desiredFish": 8,
  "feedSchedule": "normal",
  "lightsOn": true
}`,
    observe: `const a = state.actual || {
  ph: 7.8, temp: 22, fish: 4, algae: 30,
  ammonia: 0.5, filterRunning: false,
  lights: false, lastFed: 0, happiness: 6
};
const d = JSON.parse(spec);
// fish produce ammonia
a.ammonia += a.fish * 0.05 + (d.feedSchedule === "heavy" ? 0.2 : d.feedSchedule === "normal" ? 0.1 : 0.03);
if (a.filterRunning) a.ammonia = Math.max(0, a.ammonia - 0.3);
a.ammonia = Math.max(0, +a.ammonia.toFixed(2));
// ammonia affects pH
a.ph += (a.ammonia - 0.3) * 0.05 + (Math.random() - 0.5) * 0.1;
a.ph = +Math.max(5.5, Math.min(9, a.ph)).toFixed(1);
// algae grows with light + ammonia
if (a.lights) a.algae += 3 + a.ammonia * 5; else a.algae -= 2;
a.algae = Math.max(0, Math.min(100, Math.round(a.algae)));
// temp drift
a.temp += (Math.random() - 0.48) * 0.5;
if (state.heatUp) { a.temp += 1; delete state.heatUp; }
if (state.coolDown) { a.temp -= 1; delete state.coolDown; }
// fish happiness
a.happiness = 10 - Math.abs(a.ph - 7.2) * 2 - Math.abs(a.temp - 25) * 0.5 - a.ammonia * 3;
a.happiness = +Math.max(0, Math.min(10, a.happiness)).toFixed(1);
// fish events
if (state.addFish) { a.fish++; delete state.addFish; }
if (state.toggleFilter !== undefined) { a.filterRunning = state.toggleFilter; delete state.toggleFilter; }
if (state.toggleLights !== undefined) { a.lights = state.toggleLights; delete state.toggleLights; }
if (a.happiness < 2 && Math.random() < 0.15 && a.fish > 1) { a.fish--; state.fishLost = true; }
state.actual = a;
return { ph: a.ph, temp: +a.temp.toFixed(1), fish: a.fish, algae: a.algae + "%", ammonia: a.ammonia, filter: a.filterRunning, lights: a.lights, happiness: a.happiness };`,
    compare: `const d = {};
if (Math.abs(actual.ph - desired.targetPh) > 0.3) d.ph = { want: desired.targetPh, at: actual.ph };
if (Math.abs(actual.temp - desired.targetTempC) > 1.5) d.temp = { want: desired.targetTempC, at: actual.temp };
if (actual.filter !== desired.filterOn) d.filter = { want: desired.filterOn };
if (actual.fish < desired.desiredFish) d.fish = { want: desired.desiredFish, have: actual.fish };
if (actual.lights !== desired.lightsOn) d.lights = { want: desired.lightsOn };
if (actual.ammonia > 1.5) d.ammonia = { level: actual.ammonia };
return d;`,
    plan: `const actions = [];
if (d.filter) actions.push({ type: "toggle-filter", on: d.filter.want });
if (d.lights) actions.push({ type: "toggle-lights", on: d.lights.want });
if (d.temp && d.temp.at < d.temp.want) actions.push({ type: "heat" });
if (d.temp && d.temp.at > d.temp.want) actions.push({ type: "cool" });
if (d.fish) actions.push({ type: "add-fish" });
if (d.ammonia) actions.push({ type: "water-change" });
return actions;`,
    execute: `for (const a of actions) {
  if (a.type === "toggle-filter") { log(a.on ? "\\u{1F300} Filter on" : "Filter off"); state.toggleFilter = a.on; }
  if (a.type === "toggle-lights") { log(a.on ? "\\u{1F4A1} Lights on" : "Lights off"); state.toggleLights = a.on; }
  if (a.type === "heat") { log("\\u{1F321} Warming water"); state.heatUp = true; }
  if (a.type === "cool") { log("\\u2744 Cooling water"); state.coolDown = true; }
  if (a.type === "add-fish") { log("\\u{1F41F} Adding a fish!"); state.addFish = true; }
  if (a.type === "water-change") { log("\\u{1F4A7} Partial water change"); state.actual.ammonia *= 0.5; }
}
if (state.fishLost) { log("\\u{1F480} A fish didn't make it..."); delete state.fishLost; }
if (!actions.length && !state.fishLost) log("\\u{1F420} Tank is thriving");`
  },

  "empty": {
    name: "Blank canvas",
    icon: "📝",
    ui: [],
    spec: `{\n  \n}`,
    observe: `// Return the observed world state\n// 'spec' and 'state' available\nreturn {};`,
    compare: `// 'desired' = parsed spec, 'actual' = from observe\nreturn {};`,
    plan: `// 'd' = diff from compare\nreturn [];`,
    execute: `// 'actions' = from plan\nlog("No actions");`
  }
};

// ─── Helpers ──────────────────────────────────────────

function getByPath(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function setByPath(obj, path, val) {
  const copy = JSON.parse(JSON.stringify(obj));
  const keys = path.split(".");
  let cur = copy;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in cur)) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = val;
  return copy;
}

// ─── UI DSL Renderer ──────────────────────────────────

function DslControl({ ctrl, specObj, onSpecChange }) {
  if (ctrl.type === "group") {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", marginBottom: 8 }}>{ctrl.label}</div>
        {ctrl.children.map((c, i) => <DslControl key={i} ctrl={c} specObj={specObj} onSpecChange={onSpecChange} />)}
      </div>
    );
  }

  const val = getByPath(specObj, ctrl.key);

  if (ctrl.type === "slider") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", minWidth: 90, flexShrink: 0 }}>{ctrl.label}</span>
        <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step || 1} value={val ?? ctrl.min}
          onChange={e => {
            const v = Number(e.target.value);
            onSpecChange(setByPath(specObj, ctrl.key, v));
          }}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500, minWidth: 36, textAlign: "right", color: "var(--color-text-primary)" }}>
          {typeof val === "number" ? (Number.isInteger(ctrl.step || 1) ? val : val?.toFixed?.(1)) : val}
        </span>
      </div>
    );
  }

  if (ctrl.type === "toggle") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
        onClick={() => onSpecChange(setByPath(specObj, ctrl.key, !val))}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", minWidth: 90, flexShrink: 0 }}>{ctrl.label}</span>
        <div style={{
          width: 36, height: 20, borderRadius: 10,
          background: val ? "#1D9E75" : "var(--color-border-secondary)",
          position: "relative", transition: "background 0.2s", flexShrink: 0
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: 8,
            background: "#fff",
            position: "absolute", top: 2,
            left: val ? 18 : 2,
            transition: "left 0.2s"
          }} />
        </div>
      </div>
    );
  }

  if (ctrl.type === "select") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", minWidth: 90, flexShrink: 0 }}>{ctrl.label}</span>
        <select value={val || ""} onChange={e => onSpecChange(setByPath(specObj, ctrl.key, e.target.value))}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 8px",
            borderRadius: "var(--border-radius-md)", flex: 1,
            border: "0.5px solid var(--color-border-secondary)",
            background: "var(--color-background-primary)", color: "var(--color-text-primary)"
          }}>
          {ctrl.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (ctrl.type === "buttons") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", minWidth: 90, flexShrink: 0 }}>{ctrl.label}</span>
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {ctrl.options.map(o => (
            <button key={o} onClick={() => onSpecChange(setByPath(specObj, ctrl.key, o))}
              style={{
                flex: 1, fontSize: 10, fontFamily: "var(--font-mono)", padding: "4px 6px",
                border: "0.5px solid " + (val === o ? "#534AB7" : "var(--color-border-tertiary)"),
                borderRadius: "var(--border-radius-md)", cursor: "pointer",
                background: val === o ? "#EEEDFE" : "transparent",
                color: val === o ? "#3C3489" : "var(--color-text-secondary)",
                fontWeight: val === o ? 500 : 400, transition: "all 0.15s"
              }}>{o}</button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Components ──────────────────────────────────────

function CodeEditor({ value, onChange, height = 180 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      spellCheck={false}
      style={{
        width: "100%", height, resize: "vertical",
        fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6,
        background: "var(--color-background-tertiary)",
        color: "var(--color-text-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        padding: "10px 12px", boxSizing: "border-box",
        outline: "none", tabSize: 2
      }}
      onKeyDown={e => {
        if (e.key === "Tab") {
          e.preventDefault();
          const s = e.target.selectionStart, end = e.target.selectionEnd;
          const v = value.substring(0, s) + "  " + value.substring(end);
          onChange(v);
          setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = s + 2; }, 0);
        }
      }}
    />
  );
}

const Badge = ({ children, color = "purple" }) => {
  const m = { purple: ["#EEEDFE","#3C3489"], teal: ["#E1F5EE","#085041"], coral: ["#FAECE7","#712B13"], amber: ["#FAEEDA","#633806"], red: ["#FCEBEB","#791F1F"], green: ["#EAF3DE","#27500A"], gray: ["#F1EFE8","#444441"], blue: ["#E6F1FB","#0C447C"], pink: ["#FBEAF0","#72243E"] };
  const c = m[color] || m.purple;
  return <span style={{ display: "inline-block", fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: "var(--border-radius-md)", background: c[0], color: c[1], fontWeight: 500 }}>{children}</span>;
};

const Tab = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    background: "transparent",
    color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
    border: "none", padding: "6px 12px", cursor: "pointer",
    fontSize: 11.5, fontFamily: "var(--font-mono)",
    borderBottom: active ? `2px solid ${color || "#534AB7"}` : "2px solid transparent",
    transition: "all 0.15s"
  }}>{label}</button>
);

// ─── Main ─────────────────────────────────────────────

export default function ReconcilerSim() {
  const [preset, setPreset] = useState("space-station");
  const [activeTab, setActiveTab] = useState("observe");
  const [specView, setSpecView] = useState("ui"); // "ui" or "json"
  const [spec, setSpec] = useState(PRESETS["space-station"].spec);
  const [observe, setObserve] = useState(PRESETS["space-station"].observe);
  const [compare, setCompare] = useState(PRESETS["space-station"].compare);
  const [plan, setPlan] = useState(PRESETS["space-station"].plan);
  const [execute, setExecute] = useState(PRESETS["space-station"].execute);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [logs, setLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [error, setError] = useState(null);
  const [speed, setSpeed] = useState(800);
  const [activePhase, setActivePhase] = useState(null);
  const stateRef = useRef({});
  const intervalRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const currentPreset = PRESETS[preset];

  const loadPreset = (key) => {
    stop();
    const p = PRESETS[key];
    setPreset(key);
    setSpec(p.spec); setObserve(p.observe); setCompare(p.compare); setPlan(p.plan); setExecute(p.execute);
    setLogs([]); setSnapshots([]); setTick(0); setError(null); setActivePhase(null);
    stateRef.current = {};
    if (p.ui.length > 0) setSpecView("ui"); else setSpecView("json");
  };

  const specObj = (() => { try { return JSON.parse(spec); } catch { return {}; } })();

  const handleSpecObjChange = (newObj) => {
    setSpec(JSON.stringify(newObj, null, 2));
  };

  const runOneTick = useCallback(() => {
    setError(null);
    const logBuf = [];
    const logFn = (msg) => logBuf.push(msg);
    try {
      const specStr = spec;
      const desired = JSON.parse(specStr);
      const st = stateRef.current;

      setActivePhase("observe");
      const actual = new Function("state", "spec", "log", observe)(st, specStr, logFn);

      setActivePhase("compare");
      const diff = new Function("desired", "actual", "state", "log", "d", compare + "\n;return typeof d!=='undefined'?d:{};")(desired, actual, st, logFn, undefined);

      setActivePhase("plan");
      const actions = new Function("d", "diff", "desired", "actual", "state", "log", plan + "\n;return typeof actions!=='undefined'?actions:[];")(diff, diff, desired, actual, st, logFn);

      setActivePhase("execute");
      new Function("actions", "state", "spec", "log", execute)(actions, st, specStr, logFn);

      const snap = { tick: tick + 1, desired, actual: JSON.parse(JSON.stringify(actual)), diff: JSON.parse(JSON.stringify(diff || {})), actions: JSON.parse(JSON.stringify(actions || [])), logs: logBuf };
      setTick(t => t + 1);
      setLogs(prev => [...prev, ...logBuf.map((m, i) => ({ tick: tick + 1, msg: m, id: Date.now() + i }))]);
      setSnapshots(prev => [...prev.slice(-49), snap]);
      setTimeout(() => setActivePhase(null), 250);
    } catch (e) {
      setError(e.message);
      setActivePhase(null);
      stop();
    }
  }, [spec, observe, compare, plan, execute, tick]);

  const start = () => {
    if (intervalRef.current) return;
    setRunning(true);
    runOneTick();
    intervalRef.current = setInterval(runOneTick, speed);
  };

  const stop = () => {
    setRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const reset = () => {
    stop();
    stateRef.current = {};
    setTick(0); setLogs([]); setSnapshots([]); setError(null); setActivePhase(null);
  };

  useEffect(() => {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(runOneTick, speed);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [speed, running, runOneTick]);

  const editors = { observe, compare, plan, execute };
  const setters = { observe: setObserve, compare: setCompare, plan: setPlan, execute: setExecute };
  const phases = ["observe", "compare", "plan", "execute"];
  const phaseColors = { observe: "#534AB7", compare: "#1D9E75", plan: "#D85A30", execute: "#185FA5" };
  const lastSnap = snapshots[snapshots.length - 1];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
      gap: 0, minHeight: 640,
      borderRadius: "var(--border-radius-lg)",
      border: "0.5px solid var(--color-border-tertiary)",
      overflow: "hidden", fontSize: 13
    }}>
      {/* ═══ LEFT PANEL ═══ */}
      <div style={{ borderRight: "0.5px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column" }}>
        {/* Preset selector */}
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(PRESETS).map(([k, v]) => (
            <button key={k} onClick={() => loadPreset(k)} style={{
              fontSize: 11, fontFamily: "var(--font-mono)", padding: "4px 10px",
              borderRadius: "var(--border-radius-md)", cursor: "pointer",
              border: preset === k ? "0.5px solid #534AB7" : "0.5px solid var(--color-border-tertiary)",
              background: preset === k ? "#EEEDFE" : "transparent",
              color: preset === k ? "#3C3489" : "var(--color-text-secondary)",
              transition: "all 0.15s", whiteSpace: "nowrap"
            }}>{v.icon} {v.name}</button>
          ))}
        </div>

        {/* Controls bar */}
        <div style={{ padding: "8px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {!running
              ? <Btn color="#1D9E75" onClick={start}>Run</Btn>
              : <Btn color="#D85A30" onClick={stop}>Pause</Btn>}
            <Btn color="#534AB7" onClick={() => { if (!running) runOneTick(); }} disabled={running}>Step</Btn>
            <Btn color="#888780" onClick={reset}>Reset</Btn>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>{speed}ms</span>
          <input type="range" min={100} max={2500} step={100} value={speed} onChange={e => setSpeed(+e.target.value)} style={{ width: 80 }} />
        </div>

        {/* Spec: UI or JSON */}
        <div style={{ padding: "10px 14px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Badge color="gray">spec</Badge>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>desired state</span>
            <div style={{ flex: 1 }} />
            {currentPreset.ui.length > 0 && (
              <div style={{ display: "flex", gap: 2 }}>
                <MiniTab active={specView === "ui"} onClick={() => setSpecView("ui")}>controls</MiniTab>
                <MiniTab active={specView === "json"} onClick={() => setSpecView("json")}>json</MiniTab>
              </div>
            )}
          </div>

          {specView === "ui" && currentPreset.ui.length > 0 ? (
            <div style={{ paddingBottom: 10 }}>
              {currentPreset.ui.map((ctrl, i) => (
                <DslControl key={i} ctrl={ctrl} specObj={specObj} onSpecChange={handleSpecObjChange} />
              ))}
            </div>
          ) : (
            <div style={{ paddingBottom: 10 }}>
              <CodeEditor value={spec} onChange={setSpec} height={110} />
            </div>
          )}
        </div>

        {/* Code tabs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 14px 14px", minHeight: 0 }}>
          <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: 6 }}>
            {phases.map(t => <Tab key={t} label={t} active={activeTab === t} color={phaseColors[t]} onClick={() => setActiveTab(t)} />)}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <CodeEditor value={editors[activeTab]} onChange={setters[activeTab]} height="100%" />
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Phase + tick */}
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>
            {currentPreset.icon} tick {tick}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 3 }}>
            {phases.map(p => (
              <span key={p} style={{
                fontSize: 10, fontFamily: "var(--font-mono)", padding: "3px 8px",
                borderRadius: "var(--border-radius-md)",
                background: activePhase === p ? phaseColors[p] : "var(--color-background-secondary)",
                color: activePhase === p ? "#fff" : "var(--color-text-tertiary)",
                transition: "all 0.2s"
              }}>{p}</span>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: "8px 14px 0", padding: "8px 12px", background: "var(--color-background-danger)", borderRadius: "var(--border-radius-md)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-danger)" }}>{error}</div>
        )}

        {/* State cards */}
        {lastSnap && (
          <div style={{ padding: "10px 14px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StateCard label="actual" data={lastSnap.actual} color="teal" />
            <StateCard label="diff" data={lastSnap.diff} color="coral" />
          </div>
        )}

        {/* Actions */}
        {lastSnap && lastSnap.actions.length > 0 && (
          <div style={{ padding: "8px 14px 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <Badge color="amber">actions</Badge>
              {lastSnap.actions.map((a, i) => (
                <span key={i} style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "3px 8px", background: "var(--color-background-warning)", color: "var(--color-text-warning)", borderRadius: "var(--border-radius-md)" }}>{a.type || JSON.stringify(a)}</span>
              ))}
            </div>
          </div>
        )}

        {/* Log */}
        <div style={{ flex: 1, margin: "10px 14px 14px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ marginBottom: 4 }}><Badge color="purple">log</Badge></div>
          <div style={{
            flex: 1, overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: 11.5,
            lineHeight: 1.8, background: "var(--color-background-tertiary)",
            borderRadius: "var(--border-radius-md)", padding: "8px 12px",
            border: "0.5px solid var(--color-border-tertiary)", minHeight: 100
          }}>
            {logs.length === 0 && <span style={{ color: "var(--color-text-tertiary)" }}>Press Run or Step to begin...</span>}
            {logs.map(l => (
              <div key={l.id} style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--color-text-tertiary)", minWidth: 28, textAlign: "right", flexShrink: 0 }}>{l.tick}</span>
                <span style={{
                  color: l.msg.includes("\u2713") ? "#1D9E75"
                       : (l.msg.includes("\u26A0") || l.msg.includes("\u{1F6A8}") || l.msg.includes("\u{1F480}")) ? "#D85A30"
                       : l.msg.includes("\u{1F389}") ? "#534AB7"
                       : "var(--color-text-primary)"
                }}>{l.msg}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StateCard({ label, data, color }) {
  const empty = !data || Object.keys(data).length === 0;
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "8px 10px", minHeight: 44 }}>
      <div style={{ marginBottom: 4 }}><Badge color={color}>{label}</Badge></div>
      {empty
        ? <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>{"{}"}</span>
        : <pre style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--color-text-primary)", lineHeight: 1.5 }}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

function Btn({ color, onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
      padding: "4px 12px", borderRadius: "var(--border-radius-md)",
      border: "none", cursor: disabled ? "default" : "pointer",
      background: color, color: "#fff", opacity: disabled ? 0.35 : 1,
      transition: "opacity 0.15s"
    }}>{children}</button>
  );
}

function MiniTab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px",
      border: "0.5px solid " + (active ? "var(--color-border-secondary)" : "var(--color-border-tertiary)"),
      borderRadius: "var(--border-radius-md)", cursor: "pointer",
      background: active ? "var(--color-background-secondary)" : "transparent",
      color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)"
    }}>{children}</button>
  );
}
