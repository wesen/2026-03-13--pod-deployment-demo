function compare(desired, actual) {
  const diff = {};

  if (actual.trucks.length !== desired.trucks) {
    diff.truckCount = { want: desired.trucks, have: actual.trucks.length };
  }

  const lowTacos = actual.trucks.filter((truck) => truck.tacos < 20);
  if (lowTacos.length) {
    diff.lowTacos = lowTacos.map((truck) => truck.id);
  }

  const lowSalsa = actual.trucks.filter((truck) => truck.salsa < 15);
  if (lowSalsa.length) {
    diff.lowSalsa = lowSalsa.map((truck) => truck.id);
  }

  const misplaced = actual.trucks.filter((truck) => truck.zone !== desired.hotZone);
  if (actual.angry > actual.orders * 0.3 && misplaced.length) {
    diff.rebalance = { hotZone: desired.hotZone, trucks: misplaced.map((truck) => truck.id) };
  }

  return diff;
}
