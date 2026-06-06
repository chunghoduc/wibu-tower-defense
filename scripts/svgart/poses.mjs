// Animation pose sets: joint angles per frame. angle 0=down,90=right,-90=left,180=up.
// arms/legs: [proximalAngle, distalAngle].
export const MELEE = [
  { name: "idle1", bob: 0,  armL: [-18, -8], armR: [18, 8],   legL: [-8, 0],  legR: [8, 0] },
  { name: "idle2", bob: -2, armL: [-14, -6], armR: [14, 6],   legL: [-8, 0],  legR: [8, 0] },
  { name: "walk1", bob: -1, armL: [-30, -10], armR: [35, 12], legL: [-28, 4], legR: [22, -2] },
  { name: "walk2", bob: -1, armL: [30, 10],  armR: [-25, -8], legL: [24, -2], legR: [-26, 4] },
  { name: "atkUp", bob: -3, lean: -4, armL: [-30, -10], armR: [120, 150], legL: [-14, 2], legR: [20, -2] },
  { name: "atkHit", bob: 1, lean: 6,  armL: [-10, -4],  armR: [55, 75],   legL: [-26, 4], legR: [14, 0] },
  { name: "hurt",  bob: 0,  lean: -12, headX: -3, armL: [-50, -20], armR: [50, 20], legL: [-18, 4], legR: [26, -2] },
];
export const CAST = [
  { name: "idle1", bob: 0,  armL: [-20, -8], armR: [20, 8],   legL: [-8, 0],  legR: [8, 0] },
  { name: "idle2", bob: -2, armL: [-16, -6], armR: [16, 6],   legL: [-8, 0],  legR: [8, 0] },
  { name: "walk1", bob: -1, armL: [-26, -8], armR: [28, 10],  legL: [-24, 4], legR: [20, -2] },
  { name: "walk2", bob: -1, armL: [26, 8],   armR: [-22, -6], legL: [22, -2], legR: [-24, 4] },
  { name: "cast1", bob: -2, armL: [40, 60],  armR: [-40, -60], legL: [-12, 2], legR: [18, -2] },
  { name: "cast2", bob: -3, lean: -3, armL: [55, 80], armR: [-55, -80], legL: [-12, 2], legR: [18, -2] },
  { name: "hurt",  bob: 0,  lean: -12, headX: -3, armL: [-50, -20], armR: [50, 20], legL: [-18, 4], legR: [26, -2] },
];

/** Which pose set a character uses, by role. */
export function poseSetFor(role) {
  return (role === "dot" || role === "debuff" || role === "support" || role === "chain" || role === "splash") ? CAST : MELEE;
}
