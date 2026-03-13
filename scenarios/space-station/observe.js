function observe(desired) {
  const actual = getState("actual") || {
    o2: 18.5,
    co2: 1400,
    pressure: 97,
    temp: 19,
    crewAwake: 2,
    hydroponics: false,
    solarOutput: 0.7
  };

  const breathing = desired.crewAwake * 0.3;
  actual.o2 = Math.max(12, actual.o2 - breathing * 0.1 + (actual.hydroponics ? 0.4 : 0));
  actual.co2 = Math.min(3000, actual.co2 + breathing * 40 - (getState("scrubbing") ? 200 : 0));
  actual.temp += randomFloat(-0.45, 0.35);
  actual.pressure -= randomFloat(0, 0.3);

  if (getState("repressurizing")) {
    actual.pressure += 2;
    setState("repressurizing", false);
  }
  if (getState("ventilating")) {
    actual.co2 -= 300;
    setState("ventilating", false);
  }
  if (getState("heatingUp")) {
    actual.temp += 1.5;
    setState("heatingUp", false);
  }
  if (getState("coolingDown")) {
    actual.temp -= 1.5;
    setState("coolingDown", false);
  }

  const toggleHydro = getState("toggleHydro");
  if (toggleHydro !== null && toggleHydro !== undefined) {
    actual.hydroponics = toggleHydro;
    setState("toggleHydro", null);
  }

  actual.crewAwake = desired.crewAwake;
  actual.solarOutput = 0.5 + randomFloat(0, 0.5);
  setState("actual", actual);

  return {
    o2: round(actual.o2, 1),
    co2: Math.round(actual.co2),
    pressure: round(actual.pressure, 1),
    temp: round(actual.temp, 1),
    crewAwake: actual.crewAwake,
    hydroponics: actual.hydroponics,
    solar: round(actual.solarOutput, 2)
  };
}
