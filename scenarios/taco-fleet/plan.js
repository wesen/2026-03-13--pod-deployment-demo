function plan(desired, actual, diff) {
  const actions = [];

  if (diff.truckCount) {
    if (diff.truckCount.have < diff.truckCount.want) actions.push({ type: "dispatch-truck" });
    else actions.push({ type: "recall-truck" });
  }
  if (diff.lowTacos) diff.lowTacos.forEach((id) => actions.push({ type: "restock", truck: id, item: "tacos" }));
  if (diff.lowSalsa) diff.lowSalsa.forEach((id) => actions.push({ type: "restock", truck: id, item: "salsa" }));
  if (diff.rebalance) actions.push({ type: "reroute", trucks: diff.rebalance.trucks, to: diff.rebalance.hotZone });

  return actions;
}
