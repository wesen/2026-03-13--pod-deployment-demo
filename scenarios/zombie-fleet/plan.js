function plan(desired, actual, diff) {
  const actions = [];

  if (diff.needWalls) actions.push({ type: "build-wall" });
  if (diff.needTurrets) actions.push({ type: "deploy-turret" });
  if (diff.excessTurrets) actions.push({ type: "remove-turret" });
  if (diff.lowAmmo) actions.push({ type: "resupply" });
  if (diff.fence) actions.push({ type: "toggle-fence", on: diff.fence.want });
  if (diff.overwhelmed) actions.push({ type: "emergency", count: diff.overwhelmed.count });

  return actions;
}
