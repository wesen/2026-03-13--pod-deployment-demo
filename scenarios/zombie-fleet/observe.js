function observe(desired) {
  const current = getState("actual");
  const actual = current ? {
    walls: current.walls !== undefined ? current.walls : 1,
    wallHp: Array.isArray(current.wallHp) ? current.wallHp.map((hp) => hp) : [100],
    turrets: current.turrets !== undefined ? current.turrets : 0,
    turretAmmo: Array.isArray(current.turretAmmo)
      ? current.turretAmmo.map((ammo) => ammo)
      : [],
    fenceOn: !!current.fenceOn,
    fenceCharge: current.fenceCharge !== undefined ? current.fenceCharge : 0,
    zombiesNearby: current.zombiesNearby !== undefined ? current.zombiesNearby : 0,
    zombiesBreaching: current.zombiesBreaching !== undefined ? current.zombiesBreaching : 0,
    kills: current.kills !== undefined ? current.kills : 0,
    breaches: current.breaches !== undefined ? current.breaches : 0
  } : {
    walls: 1,
    wallHp: [100],
    turrets: 2,
    turretAmmo: [50, 50],
    fenceOn: false,
    fenceCharge: 0,
    zombiesNearby: 15,
    zombiesBreaching: 0,
    kills: 0,
    breaches: 0
  };

  const waveMultiplier = desired.alertLevel === "red" ? 3 : desired.alertLevel === "yellow" ? 1.8 : 1;
  const newZombies = Math.floor((8 + randomFloat(0, 12)) * waveMultiplier);
  actual.zombiesNearby = newZombies;

  let killed = 0;
  for (let i = 0; i < actual.turrets; i++) {
    if ((actual.turretAmmo[i] || 0) > 0) {
      const turretKills = Math.min(3, Math.max(0, actual.zombiesNearby - killed));
      killed += turretKills;
      actual.turretAmmo[i] = Math.max(0, (actual.turretAmmo[i] || 0) - turretKills * 2);
    }
  }

  if (actual.fenceOn && actual.fenceCharge > 10) {
    const zapKills = Math.min(5, Math.max(0, actual.zombiesNearby - killed));
    killed += zapKills;
    actual.fenceCharge = Math.max(0, actual.fenceCharge - zapKills * 5);
  }

  const surviving = Math.max(0, actual.zombiesNearby - killed);
  actual.zombiesBreaching = surviving;
  if (surviving > 0 && actual.walls > 0 && actual.wallHp.length >= actual.walls) {
    const topWall = actual.walls - 1;
    actual.wallHp[topWall] = (actual.wallHp[topWall] ?? 100) - surviving * 8;
    if (actual.wallHp[topWall] <= 0) {
      actual.walls--;
      actual.wallHp.pop();
      actual.breaches++;
    }
  }

  actual.kills += killed;

  if (getState("buildWall")) {
    actual.walls++;
    actual.wallHp.push(100);
    setState("buildWall", false);
  }
  if (getState("addTurret")) {
    actual.turrets++;
    actual.turretAmmo.push(80);
    setState("addTurret", false);
  }
  if (getState("removeTurret") && actual.turrets > 0) {
    actual.turrets--;
    actual.turretAmmo.pop();
    setState("removeTurret", false);
  }
  if (getState("reloadAll")) {
    actual.turretAmmo = actual.turretAmmo.map(() => 80);
    setState("reloadAll", false);
  }
  const toggleFence = getState("toggleFence");
  if (toggleFence !== null && toggleFence !== undefined) {
    actual.fenceOn = !!toggleFence;
    setState("toggleFence", null);
  }

  actual.fenceCharge = Math.min(100, actual.fenceCharge + (actual.fenceOn ? 0 : 8));
  setState("actual", actual);

  return {
    walls: actual.walls,
    wallHp: actual.wallHp.map((hp) => Math.round(hp)),
    turrets: actual.turrets,
    ammo: actual.turretAmmo.map((ammo) => Math.max(0, ammo)),
    fenceOn: actual.fenceOn,
    charge: Math.round(actual.fenceCharge),
    nearby: actual.zombiesNearby,
    breaching: actual.zombiesBreaching,
    totalKills: actual.kills,
    breaches: actual.breaches
  };
}
