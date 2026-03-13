function execute(desired, actual, diff, actions) {
  for (const action of actions) {
    if (action.type === "scrub-co2") {
      log("Activating CO2 scrubbers (" + action.level + "ppm)");
      setState("scrubbing", true);
    }
    if (action.type === "repressurize") {
      log("Repressurizing hull");
      setState("repressurizing", true);
    }
    if (action.type === "heat") {
      log("Engaging thermal heaters");
      setState("heatingUp", true);
    }
    if (action.type === "cool") {
      log("Radiator panels deployed");
      setState("coolingDown", true);
    }
    if (action.type === "toggle-hydroponics") {
      log((action.to ? "Starting" : "Stopping") + " hydroponics bay");
      setState("toggleHydro", action.to);
    }
    if (action.type === "boost-o2") {
      log("Electrolyzing reserve water for O2");
      const current = getState("actual") || {};
      current.o2 = (current.o2 || actual.o2) + 0.8;
      setState("actual", current);
    }
  }

  if (!actions.length) {
    log("Station nominal");
  }

  setState("scrubbing", actions.some((action) => action.type === "scrub-co2"));
}
