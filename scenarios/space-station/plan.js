function plan(desired, actual, diff) {
  const actions = [];

  if (diff.co2) actions.push({ type: "scrub-co2", level: diff.co2.have });
  if (diff.pressure && diff.pressure.have < diff.pressure.want) actions.push({ type: "repressurize" });
  if (diff.temp && diff.temp.have < diff.temp.want) actions.push({ type: "heat" });
  if (diff.temp && diff.temp.have > diff.temp.want) actions.push({ type: "cool" });
  if (diff.hydroponics) actions.push({ type: "toggle-hydroponics", to: diff.hydroponics.want });
  if (diff.o2 && diff.o2.have < diff.o2.want) actions.push({ type: "boost-o2" });

  return actions;
}
