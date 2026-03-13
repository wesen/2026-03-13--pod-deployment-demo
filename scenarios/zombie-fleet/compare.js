function compare(desired, actual) {
  const diff = {};

  if (actual.walls < desired.wallLayers) {
    diff.needWalls = { want: desired.wallLayers, have: actual.walls };
  }
  if (actual.turrets < desired.turrets) {
    diff.needTurrets = { want: desired.turrets, have: actual.turrets };
  }
  if (actual.turrets > desired.turrets) {
    diff.excessTurrets = { want: desired.turrets, have: actual.turrets };
  }

  const totalAmmo = (actual.ammo || []).reduce((sum, ammo) => sum + ammo, 0);
  if (totalAmmo < desired.minAmmo) {
    diff.lowAmmo = { have: totalAmmo, min: desired.minAmmo };
  }

  if (actual.fenceOn !== desired.electrifiedFence) {
    diff.fence = { want: desired.electrifiedFence, have: actual.fenceOn };
  }
  if (actual.breaching > 5) {
    diff.overwhelmed = { count: actual.breaching };
  }

  return diff;
}
