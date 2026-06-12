/**
 * Tower ACTIVE skill catalog (split from passiveSkills.ts to keep file sizes
 * in check). Auto-cast when a tower's mana fills; re-exported by the
 * aggregator so consumers keep importing from passiveSkills.ts.
 */
import type { PassiveSkillInfo } from "./passiveSkills.ts";

/** Tower active skills (auto-cast when the tower's mana fills). */
export const TOWER_ACTIVES: Record<string, PassiveSkillInfo> = {
  "spirit-ball": {
    name: "Spirit Ball",
    description: "Hurls a sphere of ki that bursts for area damage.",
  },
  "dimensional-slash": {
    name: "Dimensional Slash",
    description: "A spirit-blade rift that cleaves a line of foes.",
  },
  "iaido-slash": {
    name: "Three-Blade Iaido",
    description: "A blinding draw-cut dealing heavy single-target damage.",
  },
  "final-flash": {
    name: "Final Flash",
    description: "A devastating beam that ignores all defenses (True damage).",
  },
  "kamefist-wave": {
    name: "Wave Fist",
    description: "A charged energy wave washing over everything ahead.",
  },
  "hollow-purple": {
    name: "Hollow Clash",
    description: "Collides two opposing forces into one annihilating blast.",
  },
  "serious-punch": {
    name: "Serious Punch",
    description: "One punch — colossal True damage to a single target.",
  },
  "frag-toss": {
    name: "Frag Toss",
    description: "Lobs an explosive for a wide, hard-hitting blast.",
  },
  "coup-de-burst": {
    name: "Coup de Burst",
    description: "A point-blank cannon shot with a huge area.",
  },
  "petal-storm": {
    name: "Petal Storm",
    description: "A swirling storm of blades striking all nearby.",
  },
  "great-eruption": {
    name: "Great Eruption",
    description: "Calls down a volcanic blast that burns the ground.",
  },
  explosion: { name: "Explosion", description: "A single, enormous magical detonation." },
  "double-skip": {
    name: "Double Skip",
    description: "A skipping shot that bounces between many foes.",
  },
  "chain-lightning": {
    name: "Chain Lightning",
    description: "Forked lightning leaping across the lane.",
  },
  "glacial-chain": {
    name: "Glacial Chain",
    description: "Bouncing ice that freezes each target it touches.",
  },
  thunderbolt: { name: "Thunderbolt", description: "A heavy bolt that stuns where it strikes." },
  kirin: { name: "Kirin", description: "Summons a pillar of lightning for massive damage." },
  bramble: {
    name: "Bramble Burst",
    description: "Thorns erupt, poisoning everything around the target.",
  },
  wildfire: { name: "Wildfire", description: "Spreads fire that keeps burning across the wave." },
  "plague-cloud": {
    name: "Plague Cloud",
    description: "A toxic cloud that poisons all who linger.",
  },
  "inferno-snap": {
    name: "Inferno Snap",
    description: "Instantly detonates all burns for a fiery payoff.",
  },
  "black-rot": {
    name: "Black Rot",
    description: "Spreading decay that amplifies damage to the rotten.",
  },
  "tar-pit": { name: "Tar Pit", description: "Mires the lane, rooting and slowing all caught." },
  "shadow-stitch": {
    name: "Shadow Stitch",
    description: "Pins enemies' shadows, stunning a whole group.",
  },
  "ice-geyser": { name: "Ice Geyser", description: "A burst of ice that freezes a cluster solid." },
  blizzard: {
    name: "Blizzard",
    description: "A sustained snowstorm that deeply chills the field.",
  },
  "sand-burial": {
    name: "Sand Burial",
    description: "Crushing sand that binds and grinds down foes.",
  },
  "pep-talk": {
    name: "Pep Talk",
    description: "A rallying cry boosting all allied towers' attack.",
  },
  crescendo: { name: "Crescendo", description: "A swelling tempo that hastens nearby allies." },
  "reject-fate": { name: "Reject Fate", description: "Shields and revitalizes wounded allies." },
  "war-cry": { name: "War Cry", description: "An empowering roar — allies hit harder and faster." },
  "creation-rebirth": {
    name: "Creation Rebirth",
    description: "Restores allies and cleanses their afflictions.",
  },
  // tanker — actives whose burst scales off the caster's defenses
  "ironhide-slam": {
    name: "Ironhide Slam",
    description: "Hardens and slams the ground for area damage scaled by its armor.",
  },
  "scaleguard-crash": {
    name: "Scaleguard Crash",
    description: "A club-like forearm smashes the lane, fueled by its bulk.",
  },
  "adamant-burst": {
    name: "Adamant Burst",
    description: "Crystalline fists shatter outward for armor-scaled damage.",
  },
  "armored-charge": {
    name: "Armored Charge",
    description: "Barrels through the front line, its plating turned to a weapon.",
  },
  "fortress-smash": {
    name: "Fortress Smash",
    description: "An earth-shaking blow whose force is drawn from its defenses.",
  },
  // ranged & arcane actives (batch C)
  "rapid-volley": {
    name: "Rapid Volley",
    description: "Looses a flurry of arrows at the strongest foe in range.",
  },
  "skipping-volley": {
    name: "Skipping Volley",
    description: "A trick arrow that ricochets across a string of enemies.",
  },
  "meteor-volley": {
    name: "Meteor Volley",
    description: "Fires into the sky to rain a falling storm of arrows over an area.",
  },
  "siege-bolt": {
    name: "Siege Bolt",
    description: "A massive crossbow bolt that skewers through armor for heavy damage.",
  },
  "plague-quiver": {
    name: "Plague Quiver",
    description: "Empties a quiver of venom bolts, poisoning everything they strike.",
  },
  "spin-shot": {
    name: "Spin Shot",
    description: "A whirling burst of trick shots peppering all nearby foes.",
  },
  "grenade-barrage": {
    name: "Grenade Barrage",
    description: "Lobs a salvo of explosive shells that bloom into fire.",
  },
  "phantom-fusillade": {
    name: "Phantom Fusillade",
    description: "Curving rounds that rebound from foe to foe across the lane.",
  },
  "bola-storm": {
    name: "Bola Storm",
    description: "A hail of weighted wire that tangles and slows a whole group.",
  },
  "ruinous-passage": {
    name: "Ruinous Passage",
    description: "Scribes a killing verse, rotting all caught in the page's curse.",
  },
  "errata-curse": {
    name: "Errata Curse",
    description: "Strikes a passage from reality — weakens and may stun a cluster.",
  },
  "coronation-ward": {
    name: "Coronation Ward",
    description: "Crowns the line in golden light, shielding and empowering allies.",
  },
  "tempest-scepter": {
    name: "Tempest Scepter",
    description: "Unleashes a forking tempest that leaps between many foes.",
  },
  "zap-nova": {
    name: "Zap Nova",
    description: "A crackling nova of sparks bursting over a small area.",
  },
  "missile-salvo": {
    name: "Missile Salvo",
    description: "Looses a volley of unerring arcane darts at a single target.",
  },
  "sacred-renewal": {
    name: "Sacred Renewal",
    description: "Pours blessing over the whole line, healing and hastening allies.",
  },
};
