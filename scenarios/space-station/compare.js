function compare(desired, actual) {
  const diff = {};

  if (Math.abs(actual.o2 - desired.o2Percent) > 1.5) {
    diff.o2 = { want: desired.o2Percent, have: actual.o2 };
  }
  if (actual.co2 > desired.co2Ppm) {
    diff.co2 = { have: actual.co2, max: desired.co2Ppm };
  }
  if (Math.abs(actual.pressure - desired.pressureKpa) > 3) {
    diff.pressure = { want: desired.pressureKpa, have: actual.pressure };
  }
  if (Math.abs(actual.temp - desired.tempC) > 2) {
    diff.temp = { want: desired.tempC, have: actual.temp };
  }
  if (actual.hydroponics !== desired.hydroponicsOn) {
    diff.hydroponics = { want: desired.hydroponicsOn, have: actual.hydroponics };
  }

  return diff;
}
