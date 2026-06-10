/**
 * Passive skill catalog (T17/T18). Towers reference passives by id; this maps
 * each to a player-facing name + a terse description for the tower info panel
 * and tooltips. `passiveInfo` falls back to a humanized name if an id is missing
 * so the UI never shows a raw slug.
 */
export interface PassiveSkillInfo {
  name: string;
  description: string;
}

export const PASSIVE_SKILLS: Record<string, PassiveSkillInfo> = {
  // damage / brawler
  "wolf-fang": { name: "Wolf Fang Fist", description: "Rapid strikes that ramp up attack speed the longer it fights." },
  "spirit-sword": { name: "Spirit Sword", description: "Conjured energy blade — attacks ignore a portion of armor." },
  "street-code": { name: "Street Code", description: "Gains attack when allies nearby are hurt." },
  "three-sword-style": { name: "Three-Sword Style", description: "Three blades strike as one — bonus crit damage." },
  "first-strike": { name: "First Strike", description: "The first hit on a fresh target always crits." },
  "royal-pride": { name: "Royal Pride", description: "Deals more damage to the strongest enemy in range." },
  "galick-surge": { name: "Galick Surge", description: "Periodic charged blast that pierces armor." },
  "perfect-form": { name: "Perfect Form", description: "Scales attack with its own missing health — fiercer when wounded." },
  "boundless-ki": { name: "Boundless Ki", description: "Attack scales with skill power; spells hit harder." },
  "instinct": { name: "Instinct", description: "Chance to dodge an attacker's retaliation." },
  "second-wind": { name: "Second Wind", description: "Heals a burst the first time it drops below half HP." },
  "infinity": { name: "Infinity", description: "A fraction of incoming damage is nullified." },
  "six-eyes": { name: "Six Eyes", description: "Greatly reduced skill mana cost; casts more often." },
  "domain": { name: "Domain", description: "Nearby enemies take increased damage from all sources." },
  "no-limiter": { name: "No Limiter", description: "Removes its own attack cap at the cost of defense." },
  "deadpan": { name: "Deadpan", description: "Immune to being slowed or stunned by enemy auras." },
  "casual-stride": { name: "Casual Stride", description: "Always acts unhurried — steady, unshakeable attack rhythm." },
  // splash
  "loose-pin": { name: "Loose Pin", description: "Explosives have a chance to detonate twice." },
  "siege-payload": { name: "Siege Payload", description: "Bonus splash damage versus armored foes." },
  "cola-boost": { name: "Cola Boost", description: "Occasional super-charged shot with a huge blast." },
  "wide-bloom": { name: "Wide Bloom", description: "Enlarged area of effect on every hit." },
  "fuse-master": { name: "Fuse Master", description: "Blasts also briefly slow everything they catch." },
  "eruption": { name: "Eruption", description: "Splash leaves a lingering burning patch." },
  "molten-core": { name: "Molten Core", description: "Hits apply stacking burn to all caught enemies." },
  "aftershock": { name: "Aftershock", description: "A second, smaller blast follows each shot." },
  "explosion-only": { name: "Explosion Connoisseur", description: "All damage is converted to area blasts." },
  "crimson-pride": { name: "Crimson Pride", description: "Blast radius and damage grow as the wave goes on." },
  "overflow": { name: "Overflow", description: "Overkill damage splashes onto nearby enemies." },
  // chain
  "bounce": { name: "Bounce", description: "Attacks ricochet to an extra enemy." },
  "conduit": { name: "Conduit", description: "Each bounce loses less damage." },
  "thunderclap": { name: "Thunderclap", description: "The final bounce briefly stuns." },
  "cold-snap": { name: "Cold Snap", description: "Chained targets are chilled and slowed." },
  "ricochet": { name: "Ricochet", description: "Can bounce back to a target already hit." },
  "godspeed": { name: "Godspeed", description: "Lightning-fast attacks with extra chain range." },
  "whirlwind": { name: "Whirlwind", description: "Bounces form a spinning arc, hitting clusters harder." },
  "assassin-instinct": { name: "Assassin's Instinct", description: "Bonus damage to the lowest-health bounce target." },
  "sharingan": { name: "Mirror Eye", description: "Copies and predicts foes — bounces never miss." },
  "chidori-stream": { name: "Lightning Stream", description: "A continuous arc that keeps chaining while channeling." },
  "vengeance": { name: "Vengeance", description: "Gains attack each time an ally tower is disabled." },
  // dot
  "barbs": { name: "Barbs", description: "Attacks plant thorns that bleed over time." },
  "smolder": { name: "Smolder", description: "Damage-over-time ticks faster." },
  "foxfire": { name: "Foxfire", description: "Burns spread to a nearby enemy on death." },
  "virulence": { name: "Virulence", description: "Poison stacks more potent on the same target." },
  "lingering-toxin": { name: "Lingering Toxin", description: "Damage-over-time lasts noticeably longer." },
  "ignition": { name: "Ignition", description: "Refreshing a burn deals an instant flare of damage." },
  "pinpoint-flame": { name: "Pinpoint Flame", description: "Critical hits double the applied burn." },
  "ambition": { name: "Ambition", description: "Power grows for every enemy currently afflicted by it." },
  "corrosion": { name: "Corrosion", description: "Its damage-over-time also shreds armor." },
  "epidemic": { name: "Epidemic", description: "Killing a poisoned enemy spreads the poison." },
  "necrosis": { name: "Necrosis", description: "Afflicted enemies take increased damage from everyone." },
  // debuff
  "sticky-mud": { name: "Sticky Mud", description: "Slowed enemies are also rooted briefly." },
  "shadow-bind": { name: "Shadow Bind", description: "Chance to fully bind (stun) on hit." },
  "two-hundred-iq": { name: "200 IQ", description: "Targets the most dangerous enemy and amplifies its debuff." },
  "ice-make": { name: "Ice-Make", description: "Builds icy terrain that slows everything that crosses it." },
  "freezing-touch": { name: "Freezing Touch", description: "Stacks chill until the target freezes solid." },
  "deep-chill": { name: "Deep Chill", description: "Slows are stronger and resist tenacity." },
  "hoarfrost": { name: "Hoarfrost", description: "Frozen enemies take bonus damage." },
  "absolute-zero": { name: "Absolute Zero", description: "Periodically flash-freezes everything in range." },
  "sand-armor": { name: "Sand Armor", description: "Heavily armored — shrugs off enemy attacks while it debuffs." },
  "iron-grip": { name: "Iron Grip", description: "Debuffs cannot be cleansed by enemy healers." },
  "tailed-rage": { name: "Tailed Rage", description: "The longer it lives, the harsher its debuffs." },
  // support
  "cheer": { name: "Cheer", description: "Boosts the attack of nearby allied towers." },
  "allegro": { name: "Allegro", description: "Boosts the attack speed of nearby allies." },
  "blessing": { name: "Blessing", description: "Slowly heals nearby allied towers." },
  "shun-shield": { name: "Shun Shield", description: "Grants a brief shield to a low-health ally." },
  "rally": { name: "Rally", description: "Aura strengthens as more allies stand nearby." },
  "vanguard": { name: "Vanguard", description: "Allies near it take reduced damage." },
  "last-charge": { name: "Last Charge", description: "On death, leaves a powerful farewell buff to allies." },
  "hundred-healings": { name: "Hundred Healings", description: "Its healing scales with skill power and never overheals to waste." },
  "monster-strength": { name: "Monster Strength", description: "Massive raw power that also lifts allied attack." },
  "sannin-resolve": { name: "Sage's Resolve", description: "Veteran poise — auras persist briefly even after it falls." },
  // tanker
  "ironhide": { name: "Ironhide", description: "Hardens its body — part of its armor is folded into its skill damage." },
  "guts": { name: "Guts", description: "Refuses to fall; survives a lethal blow at 1 HP once per battle." },
  "iron-scales": { name: "Iron Scales", description: "Metal scales turn a share of its bulk into retaliating force." },
  "counter-stance": { name: "Counter Stance", description: "Answers each blow it tanks with a punishing strike." },
  "diamond-body": { name: "Diamond Body", description: "Crystalline skin reflects a portion of melee damage back." },
  "unbreakable": { name: "Unbreakable", description: "The more armor it stacks, the harder its skill strikes." },
  "plated-hide": { name: "Plated Hide", description: "Layered plating soaks hits and stores them as power." },
  "bulwark": { name: "Bulwark", description: "Stands as a wall — nearby allies take reduced damage." },
  "last-bastion": { name: "Last Bastion", description: "Grows mightier as its own health drops." },
  "indomitable": { name: "Indomitable", description: "Cannot be stunned while above half health." },
  "symbol-of-peace": { name: "Symbol of Defense", description: "Its mere presence steels every ally's resolve." },
  // ranged marksmen — bow / crossbow / gun / thrown (batch C)
  "quick-draw": { name: "Quick Draw", description: "Looses arrows in a rapid rhythm — faster the longer it fires." },
  "keen-eye": { name: "Keen Eye", description: "Never wastes a shot — bonus crit against the same target." },
  "trick-shot": { name: "Trick Shot", description: "Angles every loose so arrows skip onward after a hit." },
  "far-sight": { name: "Far Sight", description: "Extreme reach — strikes the lane long before others can." },
  "arcing-loose": { name: "Arcing Loose", description: "Lofts shafts over cover to rain down on a wide area." },
  "last-shot": { name: "Last Shot", description: "Each volley is offered like a final arrow — extra armor pierce." },
  "armor-piercer": { name: "Armor Piercer", description: "Heavy bolts punch clean through plate, ignoring much armor." },
  "steady-aim": { name: "Steady Aim", description: "A slow, deliberate draw — every bolt lands for heavy damage." },
  "envenom": { name: "Envenom", description: "Coats each bolt in slow rot — hits seed a lingering poison." },
  "barbed-bolt": { name: "Barbed Bolt", description: "Hooked heads tear on impact, deepening the venom's bite." },
  "gun-kata": { name: "Gun Kata", description: "A flowing shooting form — chains rapid trick shots together." },
  "fan-the-hammer": { name: "Fan the Hammer", description: "Empties the cylinder in a blur of point-blank rounds." },
  "incendiary-rounds": { name: "Incendiary Rounds", description: "Shells burst into fire, scorching the ground they land on." },
  "wide-blast": { name: "Wide Blast", description: "Over-charged charges detonate across a larger radius." },
  "high-ground": { name: "High Ground", description: "Fires from a vantage — bonus damage to distant foes." },
  "homing-rounds": { name: "Homing Rounds", description: "Will-guided bullets curve around cover to find their mark." },
  "perfect-cadence": { name: "Perfect Cadence", description: "An unbroken firing rhythm that ramps damage as it sustains." },
  "weighted-net": { name: "Weighted Net", description: "Bolas and wire tangle struck foes, slowing their advance." },
  "pinning-throw": { name: "Pinning Throw", description: "A precise hail of blades that staggers grouped enemies." },
  // arcane scribes / casters — tome / scepter / wand / orb (batch C)
  "festering-script": { name: "Festering Script", description: "Inked hexes rot the target over time, scaling with skill power." },
  "spreading-curse": { name: "Spreading Curse", description: "The decay leaps to nearby foes as the page is finished." },
  "weakening-word": { name: "Weakening Word", description: "Strikes out an enemy's strength — slows and softens them." },
  "ink-shackle": { name: "Ink Shackle", description: "Binding script seizes a target, with a chance to stun." },
  "royal-decree": { name: "Royal Decree", description: "Commands the field — boosts the attack of every nearby ally." },
  "aegis-blessing": { name: "Aegis Blessing", description: "Wards allies so the first blow against them is turned aside." },
  "dawns-favor": { name: "Dawn's Favor", description: "Radiant light quickens allied strikes across the aura." },
  "arc-conduct": { name: "Arc Conduct", description: "Lets the lightning choose its path, leaping between foes." },
  "storm-link": { name: "Storm Link", description: "Each chained target takes more as the storm builds." },
  "static-burst": { name: "Static Burst", description: "Sparks scatter on impact, zapping a small cluster." },
  "spark-scatter": { name: "Spark Scatter", description: "Wild discharge spreads the shock to extra nearby enemies." },
  "arcane-focus": { name: "Arcane Focus", description: "Channels raw magic into unerring, armor-piercing darts." },
  "mana-bolt": { name: "Mana Bolt", description: "Converts surplus mana into bonus bolt damage on hit." },
  "true-aim": { name: "True Aim", description: "Darts never miss — bonus crit against full-health targets." },
  "benediction": { name: "Benediction", description: "A standing blessing that raises all nearby allies' power." },
  "goddess-favor": { name: "Goddess Favor", description: "Sacred grace hastens every ally caught in the halo." },
  "purify": { name: "Purify", description: "Cleanses afflictions from allies within the orb's light." },
};

/** Tower active skills (auto-cast when the tower's mana fills). */
export const TOWER_ACTIVES: Record<string, PassiveSkillInfo> = {
  "spirit-ball": { name: "Spirit Ball", description: "Hurls a sphere of ki that bursts for area damage." },
  "dimensional-slash": { name: "Dimensional Slash", description: "A spirit-blade rift that cleaves a line of foes." },
  "iaido-slash": { name: "Three-Blade Iaido", description: "A blinding draw-cut dealing heavy single-target damage." },
  "final-flash": { name: "Final Flash", description: "A devastating beam that ignores all defenses (True damage)." },
  "kamefist-wave": { name: "Wave Fist", description: "A charged energy wave washing over everything ahead." },
  "hollow-purple": { name: "Hollow Clash", description: "Collides two opposing forces into one annihilating blast." },
  "serious-punch": { name: "Serious Punch", description: "One punch — colossal True damage to a single target." },
  "frag-toss": { name: "Frag Toss", description: "Lobs an explosive for a wide, hard-hitting blast." },
  "coup-de-burst": { name: "Coup de Burst", description: "A point-blank cannon shot with a huge area." },
  "petal-storm": { name: "Petal Storm", description: "A swirling storm of blades striking all nearby." },
  "great-eruption": { name: "Great Eruption", description: "Calls down a volcanic blast that burns the ground." },
  "explosion": { name: "Explosion", description: "A single, enormous magical detonation." },
  "double-skip": { name: "Double Skip", description: "A skipping shot that bounces between many foes." },
  "chain-lightning": { name: "Chain Lightning", description: "Forked lightning leaping across the lane." },
  "glacial-chain": { name: "Glacial Chain", description: "Bouncing ice that freezes each target it touches." },
  "thunderbolt": { name: "Thunderbolt", description: "A heavy bolt that stuns where it strikes." },
  "kirin": { name: "Kirin", description: "Summons a pillar of lightning for massive damage." },
  "bramble": { name: "Bramble Burst", description: "Thorns erupt, poisoning everything around the target." },
  "wildfire": { name: "Wildfire", description: "Spreads fire that keeps burning across the wave." },
  "plague-cloud": { name: "Plague Cloud", description: "A toxic cloud that poisons all who linger." },
  "inferno-snap": { name: "Inferno Snap", description: "Instantly detonates all burns for a fiery payoff." },
  "black-rot": { name: "Black Rot", description: "Spreading decay that amplifies damage to the rotten." },
  "tar-pit": { name: "Tar Pit", description: "Mires the lane, rooting and slowing all caught." },
  "shadow-stitch": { name: "Shadow Stitch", description: "Pins enemies' shadows, stunning a whole group." },
  "ice-geyser": { name: "Ice Geyser", description: "A burst of ice that freezes a cluster solid." },
  "blizzard": { name: "Blizzard", description: "A sustained snowstorm that deeply chills the field." },
  "sand-burial": { name: "Sand Burial", description: "Crushing sand that binds and grinds down foes." },
  "pep-talk": { name: "Pep Talk", description: "A rallying cry boosting all allied towers' attack." },
  "crescendo": { name: "Crescendo", description: "A swelling tempo that hastens nearby allies." },
  "reject-fate": { name: "Reject Fate", description: "Shields and revitalizes wounded allies." },
  "war-cry": { name: "War Cry", description: "An empowering roar — allies hit harder and faster." },
  "creation-rebirth": { name: "Creation Rebirth", description: "Restores allies and cleanses their afflictions." },
  // tanker — actives whose burst scales off the caster's defenses
  "ironhide-slam": { name: "Ironhide Slam", description: "Hardens and slams the ground for area damage scaled by its armor." },
  "scaleguard-crash": { name: "Scaleguard Crash", description: "A club-like forearm smashes the lane, fueled by its bulk." },
  "adamant-burst": { name: "Adamant Burst", description: "Crystalline fists shatter outward for armor-scaled damage." },
  "armored-charge": { name: "Armored Charge", description: "Barrels through the front line, its plating turned to a weapon." },
  "fortress-smash": { name: "Fortress Smash", description: "An earth-shaking blow whose force is drawn from its defenses." },
  // ranged & arcane actives (batch C)
  "rapid-volley": { name: "Rapid Volley", description: "Looses a flurry of arrows at the strongest foe in range." },
  "skipping-volley": { name: "Skipping Volley", description: "A trick arrow that ricochets across a string of enemies." },
  "meteor-volley": { name: "Meteor Volley", description: "Fires into the sky to rain a falling storm of arrows over an area." },
  "siege-bolt": { name: "Siege Bolt", description: "A massive crossbow bolt that skewers through armor for heavy damage." },
  "plague-quiver": { name: "Plague Quiver", description: "Empties a quiver of venom bolts, poisoning everything they strike." },
  "spin-shot": { name: "Spin Shot", description: "A whirling burst of trick shots peppering all nearby foes." },
  "grenade-barrage": { name: "Grenade Barrage", description: "Lobs a salvo of explosive shells that bloom into fire." },
  "phantom-fusillade": { name: "Phantom Fusillade", description: "Curving rounds that rebound from foe to foe across the lane." },
  "bola-storm": { name: "Bola Storm", description: "A hail of weighted wire that tangles and slows a whole group." },
  "ruinous-passage": { name: "Ruinous Passage", description: "Scribes a killing verse, rotting all caught in the page's curse." },
  "errata-curse": { name: "Errata Curse", description: "Strikes a passage from reality — weakens and may stun a cluster." },
  "coronation-ward": { name: "Coronation Ward", description: "Crowns the line in golden light, shielding and empowering allies." },
  "tempest-scepter": { name: "Tempest Scepter", description: "Unleashes a forking tempest that leaps between many foes." },
  "zap-nova": { name: "Zap Nova", description: "A crackling nova of sparks bursting over a small area." },
  "missile-salvo": { name: "Missile Salvo", description: "Looses a volley of unerring arcane darts at a single target." },
  "sacred-renewal": { name: "Sacred Renewal", description: "Pours blessing over the whole line, healing and hastening allies." },
};

/** Name + description for a tower active id (humanized fallback if uncatalogued). */
export function towerActiveInfo(id: string): PassiveSkillInfo {
  const hit = TOWER_ACTIVES[id];
  if (hit) return hit;
  const name = id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { name, description: "A powerful active skill." };
}

/** Name + description for a passive id (humanized fallback if uncatalogued). */
export function passiveInfo(id: string): PassiveSkillInfo {
  const hit = PASSIVE_SKILLS[id];
  if (hit) return hit;
  const name = id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { name, description: "A signature passive ability." };
}
