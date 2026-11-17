// The battle zones the jet flies through as the multiplier climbs.
// Used by the scene (sky, weather) and the stage HUD (zone strip, labels).
export const ZONES = [
  { name: 'Carrier Strike', at: 1 },
  { name: 'Dogfight', at: 2 },
  { name: 'Enemy Fleet', at: 5 },
  { name: 'Storm Front', at: 10 },
  { name: 'Night Raid', at: 50 },
];

const LAST = 1000; // the top multiplier, end of the last zone

// Where a multiplier sits along the zones: 0 at 1×, 1 at 2×, … 4 at 50×,
// fractional in between (log scale), up to 5 at the top multiplier.
export function zonePos(m) {
  const x = Math.max(1, m);
  for (let i = 0; i < ZONES.length; i++) {
    const a = ZONES[i].at;
    const b = i + 1 < ZONES.length ? ZONES[i + 1].at : LAST;
    if (x < b || i === ZONES.length - 1) return Math.min(i + 1, i + Math.log(x / a) / Math.log(b / a));
  }
  return ZONES.length;
}

export const zoneAt = (m) => Math.min(ZONES.length - 1, Math.floor(zonePos(m)));
