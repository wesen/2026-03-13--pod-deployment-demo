function execute(desired, actual, diff, actions) {
  for (const action of actions) {
    if (action.type === "dispatch-truck") {
      log("Dispatching new truck");
      setState("addTruck", true);
    }
    if (action.type === "recall-truck") {
      log("Recalling a truck");
      setState("removeTruck", true);
    }
    if (action.type === "restock") {
      log("Restocking " + action.truck + " with " + action.item);
      setState("restock-" + action.truck, true);
    }
    if (action.type === "reroute") {
      log("Rerouting " + action.trucks.join(", ") + " to " + action.to);
      const current = getState("actual");
      const next = current ? {
        ...current,
        trucks: (current.trucks || []).map((truck) => ({ ...truck }))
      } : { trucks: [] };
      next.trucks.forEach((truck) => {
        if (action.trucks.includes(truck.id)) {
          truck.zone = action.to;
        }
      });
      setState("actual", next);
    }
  }

  if (!actions.length) {
    log("Fleet is stable");
  }
}
