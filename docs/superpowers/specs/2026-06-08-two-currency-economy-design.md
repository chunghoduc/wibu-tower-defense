# Two-Currency Economy: Gold + Diamond

Date: 2026-06-08

## Goal

Replace the single premium currency (`crystals`) with two meta currencies:

- **Gold** — abundant. Earned every stage clear + dropped from enemies (high
  value). Sinks: out-of-battle tower star-up, item enhance, shop (low/mid-rarity
  items), shop refresh, (future) hero upgrade.
- **Diamond** — premium & scarce. Rare low-value drops (1–5 from a normal enemy,
  up to 20 from a boss at low chance) + a small stage-clear reward scaled by
  stage (earlier stages give less). Sinks: summons, high-rarity (Legendary/Unique)
  shop items, the shop summon-scroll slot.

## Naming

`crystals` is renamed to **`diamonds`** throughout (it was already the premium
currency: summon + shop). A new **`gold`** field is added. NOTE the collision:
`BattleState.gold` is the transient per-round battle currency (tower placement) —
untouched and unrelated to the persistent meta `currency.gold`.

## Save model (`save.ts`, v6 → v7)

`CurrencySave`: `{ gold, diamonds, pityCount, lastDailyLoginDate, pityInsuranceActive }`.
Migration v7 renames `crystals → diamonds` (carrying the old balance) and adds
`gold: 0`. Starter grant: a chunk of gold + some diamonds.

## Earning

- **Stage clear** (`drops.ts`): award **gold** every clear (scales with stage +
  difficulty, plus a first-clear bonus) AND a small **diamond** reward scaled by
  stage index (earlier = lower).
- **Per kill** (`killRewards.ts`): grant **gold** (high value, ~ enemy bounty) on
  every kill. **Diamonds** drop rarely — a normal enemy: low chance → 1–5; a boss:
  low chance → up to 20.
- **Boss chest** (`boxes.ts`): grants **gold** (was crystals).
- **Daily login**: a small **diamond** trickle.

## Spending

- **Summon** (`gacha.ts`): costs **diamonds** (rebalanced down to match the scarcer
  currency).
- **Tower star-up** (`collection.ts`): costs **gold** (+ banked copies).
- **Item enhance** (`enhance.ts`): adds a **gold** cost on top of the bless/soul jewels.
- **Shop** (`shop.ts` + `items.ts`): an item's price currency is rarity-based —
  Common/Magic/Rare → **gold**; Legendary/Unique → **diamonds**. The summon-scroll
  slot → **diamonds**. Shop refresh → **gold**. Sell refunds the item's buy currency.

## UI

MainMenu / Shop / Gacha show **both** balances (Gold 🪙 + Diamond 💎). Price labels
use the correct currency/icon. (Currency icons: emoji for now; SDXL art optional.)

## Out of scope / deferred

- **Hero upgrade with gold**: no such feature exists today (hero progresses via XP
  - the passive tree). A gold-sink hero-upgrade screen is a net-new progression
    system and is deferred to its own task; gold already has three live sinks
    (star-up, enhance, shop) so the currency is useful immediately.
- "Diamonds reduce the summon price": implemented as diamonds being the summon
  currency (standard gacha), not a discount on a gold price.

## Testing

Update existing crystal tests to diamonds/gold; add tests for the new gold rewards,
the scaled diamond rewards, the rarity-based shop currency split, and the
gold-gated enhance.
