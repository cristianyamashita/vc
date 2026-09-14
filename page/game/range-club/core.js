export const WEAPONS = [
  {
    id: "revolver",
    name: "classic",
    price: 0,
    mag: 6,
    reload: 1.35,
    cooldown: 0.42,
    speed: 110,
    spread: 0.0011,
    sway: 1,
    recoil: 1,
    pellets: 1,
    precision: 78,
    stability: 65,
    power: 72,
  },
  {
    id: "pistol",
    name: "swift",
    price: 650,
    mag: 12,
    reload: 1.15,
    cooldown: 0.2,
    speed: 115,
    spread: 0.0014,
    sway: 0.8,
    recoil: 0.65,
    pellets: 1,
    precision: 72,
    stability: 73,
    power: 58,
  },
  {
    id: "shotgun",
    name: "timber",
    price: 1100,
    mag: 5,
    reload: 1.9,
    cooldown: 0.8,
    speed: 95,
    spread: 0.018,
    sway: 1.25,
    recoil: 1.65,
    pellets: 7,
    precision: 40,
    stability: 50,
    power: 96,
  },
  {
    id: "bow",
    name: "willow",
    price: 1450,
    mag: 1,
    reload: 0.95,
    cooldown: 0.8,
    speed: 48,
    spread: 0.0005,
    sway: 1.4,
    recoil: 0.22,
    pellets: 1,
    precision: 83,
    stability: 45,
    power: 66,
  },
  {
    id: "rifle",
    name: "summit",
    price: 2100,
    mag: 8,
    reload: 1.5,
    cooldown: 0.5,
    speed: 190,
    spread: 0.00035,
    sway: 0.42,
    recoil: 0.55,
    pellets: 1,
    precision: 98,
    stability: 92,
    power: 82,
  },
];
export function stageConfig(stage) {
  const n = Math.max(1, Math.min(12, Math.floor(stage) || 1));
  return {
    stage: n,
    distance: 12 + (n - 1) * 6,
    goal: 120 + (n - 1) * 12,
    wind: Math.min(8, 1 + (n - 1) * 0.6),
    moving: n >= 5,
    sway: true,
    target: n % 3 === 0 ? "bottle" : n % 3 === 2 ? "can" : "paper",
  };
}
export function award(score, stage) {
  return 180 + Math.max(0, Math.floor(score)) + 20 * stage;
}
export function paperScore(x, y) {
  const radius = Math.hypot(x / 0.75, y / 0.9);
  return Math.max(10, 50 - Math.floor(radius * 5) * 10);
}
export function acceleration(wind, weapon) {
  return { x: wind * (weapon.id === "bow" ? 0.42 : 0.18), y: -9.81, z: 0 };
}
export function sanitizeSave(value = {}) {
  return {
    credits: Math.max(0, Math.min(1e8, Number(value.credits) || 0)),
    stage: Math.max(1, Math.min(12, Math.floor(value.stage) || 1)),
    owned: [
      ...new Set([
        "revolver",
        ...(Array.isArray(value.owned) ? value.owned : []).filter((id) =>
          WEAPONS.some((w) => w.id === id),
        ),
      ]),
    ],
    completed: value.completed === true,
    best: Math.max(0, Number(value.best) || 0),
  };
}
