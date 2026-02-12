# On-Chain Verifiable Random Game Platform — Architecture

This project implements a **provably fair on-chain gaming platform** using **Chainlink VRF v2+** to generate unpredictable and verifiable random outcomes. It currently includes **two game types**:

- **Dice (roll-under) betting game** (`DiceGame.sol`)
- **Time-based Lottery/Raffle** (`Lottery.sol`)

A shared **Treasury** contract (`Treasury.sol`) manages pooled ETH and performs payouts in a controlled way.

---

## 1. High-level Components

### 1) Treasury (Pooled Bank + Payout Router)
**Contract:** `Treasury`  
**Responsibilities:**
- Receives and holds ETH (from games and admin funding).
- Maintains a **whitelist of authorized game contracts** via `isAuthorizedGame`.
- Executes payouts to players via `payout()` only when called by an authorized game.
- Allows owner to withdraw profits/float via `adminWithdraw()`.

**Key properties:**
- **Single source of funds** for multiple games.
- **Authorization gate** reduces risk of arbitrary external draining.

---

### 2) Dice Game (VRF-based roll-under)
**Contract:** `DiceGame` (inherits `VRFConsumerBaseV2Plus`)  
**Gameplay:**
- Player chooses `_prediction` (6–96) meaning “win if result < prediction”.
- Player sends ETH bet to `playDice(_prediction)`.
- Bet is forwarded to `Treasury` and a VRF request is created.
- On VRF callback, contract computes a number **1–100** and determines win/loss.
- If win: contract asks Treasury to pay out the calculated winnings.

**Payout model:**
- Implements a **house edge** via `HOUSE_EDGE = 9800` (interpreted as 98.00% return basis for multiplier calc).
- Multiplier is computed by:
  - `winChance = prediction - 1`
  - `multiplier = HOUSE_EDGE / winChance` (scaled by 100 in UI terms)
- Payout = `betAmount * multiplier / 100`

**State / evidence:**
- Each game is tracked in `mapping(requestId => GameRequest)` including:
  - player, betAmount, prediction, fulfilled, didWin, result, payoutAmount
- Emits:
  - `DiceRolled(requestId, player, amount, prediction)`
  - `DiceLanded(requestId, result, winner, payout)`

---

### 3) Lottery (VRF-based time-interval raffle)
**Contract:** `Lottery` (inherits `VRFConsumerBaseV2Plus`)  
**Gameplay:**
- Players buy tickets via `enterRaffle()` by sending `>= TICKET_PRICE`.
- Tickets are represented by pushing player addresses into `s_players`.
- Lottery can be drawn after `INTERVAL` seconds using:
  - `checkUpkeep()` → returns if eligible
  - `performUpkeep()` → requests VRF randomness & sets state to `CALCULATING`
- On VRF callback, picks `winnerIndex = random % totalPlayers`.
- Splits pot into:
  - `houseFee = 10%`
  - `prize = 90%`
- Sends `houseFee` to `Treasury` and `prize` to winner.
- Resets players array and state for next round.

**State / evidence:**
- `LotteryState { OPEN, CALCULATING }` prevents new entries during draw.
- Emits:
  - `EnteredRaffle(player)`
  - `WinnerPicked(winner, prize, winnerIndex, totalPlayers)`  
  This event forms a **transparent evidence chain** for off-chain verification.

---

## 2. Randomness Flow (Chainlink VRF)

Both games follow the standard VRF request/fulfill pattern:

1. **Request** randomness using `s_vrfCoordinator.requestRandomWords(...)`
2. **Wait** for VRF to call back the consumer contract.
3. **Consume** randomness in `fulfillRandomWords(...)` and finalize outcome.

### VRF configuration (as implemented)
- Coordinator: `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B` (Sepolia)
- `keyHash`: `0x787d...77ae` (Sepolia lane)
- Confirmations: `REQUEST_CONFIRMATIONS = 3`
- Words: `NUM_WORDS = 1`
- Callback gas:
  - Dice: `CALLBACK_GAS_LIMIT = 500000` (larger because it calls Treasury payout)
  - Lottery: `CALLBACK_GAS_LIMIT = 100000`

### Verifiability for users
- Users can verify a round by:
  - Observing the **requestId** and the **randomWords result** indirectly through emitted events.
  - Recomputing:
    - Dice `result = (randomWords[0] % 100) + 1`
    - Lottery `winnerIndex = randomWords[0] % totalPlayers`

---

## 3. Funds Flow & Treasury Model

### Dice
1. Player → `DiceGame.playDice()` with ETH
2. `DiceGame` forwards ETH → `Treasury` (via low-level `call`)
3. VRF callback:
   - If win: `DiceGame` calls `Treasury.payout(player, payoutAmount)`

### Lottery
1. Player → `Lottery.enterRaffle()` with ETH
2. ETH stays in `Lottery` contract balance during the round
3. VRF callback:
   - Sends `houseFee` → `Treasury`
   - Sends `prize` → winner

### Why a shared treasury?
- Centralizes liquidity for multiple games.
- Simplifies “house accounting” and limits who can pay out.
- Enables future extension: ERC-20 treasury, multi-game bankroll policies, profit extraction rules.

---

## 4. Anti-cheating & Fairness Measures (Current + Extension Points)

### Implemented now
- **Provable randomness:** Chainlink VRF request/fulfill pattern.
- **State locks:** Lottery uses `OPEN/CALCULATING` to prevent mid-draw manipulation.
- **Outcome transparency:** Events include enough information for off-chain verification.

### Recommended upgrades (to fully meet spec)
1. **Commit–reveal for player inputs** (especially for multi-step games):
   - `commit(bytes32 hash)` then later `reveal(value, salt)`
2. **Retry / failure handling** for VRF:
   - If callback fails (out-of-gas / revert), store pending requests and allow re-request.
3. **MEV protections**:
   - Enforce minimum delay between bet and resolution for games where timing can be exploited.
   - Consider private transaction endpoints or “commit bet” + “reveal bet” to remove mempool visibility.
4. **Bet limits & bankroll safety**:
   - Add max bet based on Treasury balance and worst-case payout.
5. **ERC-20 betting support**:
   - Add token escrow and payout logic (likely within Treasury).

---

## 5. Extensibility Plan

A scalable direction is to standardize an interface:

- `IGame` with:
  - `play(...) returns (requestId)`
  - `getRound(requestId)` (view evidence)
- Treasury upgrades:
  - Multi-asset (ETH + ERC-20)
  - Per-game risk limits
  - Fee routing (profit split, DAO, etc.)

---

## 6. Deployment & Configuration Notes

Before production use, ensure:
- Treasury owner calls `setGameStatus(gameAddress, true)` for each game.
- VRF subscription `subId` is correct and the game contracts are added as consumers.
- Callback gas limits are tuned to avoid failed fulfillment.
- Treasury has enough liquidity to cover worst-case dice payouts.

