function execute(desired, actual, diff, actions) {
  for (const action of actions) {
    if (action.type === "build-wall") {
      log("Constructing wall layer");
      setState("buildWall", true);
    }
    if (action.type === "deploy-turret") {
      log("Deploying turret");
      setState("addTurret", true);
    }
    if (action.type === "remove-turret") {
      log("Decommissioning turret");
      setState("removeTurret", true);
    }
    if (action.type === "resupply") {
      log("Emergency ammo resupply");
      setState("reloadAll", true);
    }
    if (action.type === "toggle-fence") {
      log(action.on ? "Fence electrified" : "Fence powered down");
      setState("toggleFence", action.on);
    }
    if (action.type === "emergency") {
      log("BREACH! " + action.count + " zombies inside perimeter");
    }
  }

  if (!actions.length) {
    log("Perimeter secure");
  }
}
