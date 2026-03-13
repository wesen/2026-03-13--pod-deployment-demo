function observe(desired) {
  const actual = getState("actual") || {
    trucks: [
      { id: "T1", zone: "downtown", tacos: 120, salsa: 80 },
      { id: "T2", zone: "beach", tacos: 90, salsa: 60 }
    ],
    orders: 0,
    satisfied: 0,
    angry: 0
  };

  const baseOrders = Math.floor(15 * desired.demandMultiplier * (desired.lunchRush ? 2.5 : 1));
  const newOrders = baseOrders + randomInt(0, 9);
  let served = 0;

  for (const truck of actual.trucks) {
    const demand = truck.zone === desired.hotZone ? Math.ceil(newOrders * 0.4) : Math.ceil(newOrders * 0.2);
    const canServe = Math.min(demand, truck.tacos);
    truck.tacos = Math.max(0, truck.tacos - canServe);
    const salsaUse = desired.salsaPolicy === "chaos" ? canServe * 3 : desired.salsaPolicy === "generous" ? canServe * 2 : canServe;
    truck.salsa = Math.max(0, truck.salsa - salsaUse);
    served += canServe;

    if (getState("restock-" + truck.id)) {
      truck.tacos += 80;
      truck.salsa += 60;
      setState("restock-" + truck.id, false);
    }
  }

  if (getState("addTruck")) {
    actual.trucks.push({ id: "T" + (actual.trucks.length + 1), zone: desired.hotZone, tacos: 100, salsa: 70 });
    setState("addTruck", false);
  }
  if (getState("removeTruck") && actual.trucks.length > 1) {
    actual.trucks.pop();
    setState("removeTruck", false);
  }

  actual.orders = newOrders;
  actual.satisfied = served;
  actual.angry = Math.max(0, newOrders - served);
  setState("actual", actual);

  return {
    trucks: actual.trucks,
    orders: actual.orders,
    satisfied: actual.satisfied,
    angry: actual.angry
  };
}
