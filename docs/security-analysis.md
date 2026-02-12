# Security Analysis

This document reviews the security posture of the three-contract system:

- `Treasury.sol`
- `DiceGame.sol`
- `Lottery.sol`

It focuses on correctness, economic security, oracle/VRF risks, MEV, and typical Solidity attack surfaces.

---

## 1. Threat Model

### Adversaries
- **Players** trying to gain unfair advantage (timing, reentrancy, griefing).
- **MEV searchers** exploiting mempool visibility (sandwiching, censorship, inclusion games).
- **Malicious contracts** interacting as players (reentrancy, fallback reverts).
- **Owner/admin mistakes** (misconfiguration, whitelisting wrong game, withdrawing too much).
- **VRF / automation failures** (callback gas, subscription issues, delayed randomness).

### Assets at risk
- ETH in `Treasury`
- ETH in `Lottery` during a round
- Correctness of random outcomes and payouts
- Liveness (ability to complete rounds / fulfill requests)

---

## 2. Contract-by-Contract Review

## 2.1 Treasury.sol

### What it does well
- **Authorization gate:** `payout()` requires `isAuthorizedGame[msg.sender]`.
- **Owner-only admin:** only owner can whitelist and withdraw.

### Key risks & recommendations

#### A) Reentrancy on payouts
`payout()` uses low-level `call{value: _amount}("")` which forwards gas to the recipient.  
A malicious player contract could re-enter *the calling game* or other contracts.

**Impact:**
- Treasury itself is relatively safe because it updates no balances after the call (no internal accounting).
- However, the game contracts may be vulnerable if they assume payout cannot re-enter.

**Recommendation:**
- Add `ReentrancyGuard` to Treasury and/or game contracts.
- Prefer a **pull-payment** pattern for large systems (record winnings, let players claim).

#### B) Owner withdrawal safety
`adminWithdraw()` uses `.transfer()`. This can revert if the owner is a smart contract with expensive fallback.

**Recommendation:**
- Use `(bool ok,) = owner.call{value:_amount}("")` and handle failure, or keep `transfer` if owner is always an EOA.

#### C) No ERC-20 support
Spec mentions ERC-20 betting; Treasury currently only supports ETH.

**Recommendation:**
- Add `depositToken`, `payoutToken` with SafeERC20.

---

## 2.2 DiceGame.sol

### What it does well
- Uses Chainlink VRF v2+ callback for randomness (unpredictable & verifiable).
- Stores per-request state to prevent double fulfillment (`fulfilled` flag).

### Key risks & recommendations

#### A) Bankroll / insolvency risk
Dice payouts can exceed Treasury liquidity, especially for small winChance (e.g., prediction 6).  
Current code does **not** enforce a max bet based on available bankroll.

**Impact:**
- If Treasury has insufficient funds, `Treasury.payout()` will revert.
- VRF callback would revert → fulfillment fails → game stuck as unfulfilled.

**Recommendation:**
- Before accepting a bet, compute **worst-case payout** and check Treasury balance.
- Enforce `MAX_BET` or dynamic max:
  - `maxBet = treasuryBalance * riskFactor / maxMultiplier`
- Consider separating “player funds” and “house bankroll” accounting.

#### B) VRF callback revert = stuck request
Inside `fulfillRandomWords`, it calls `Treasury.payout(...)`. If payout fails (insufficient funds, recipient revert, unauthorized game), the callback reverts.

**Impact:**
- Randomness fulfillment may never succeed (depending on Chainlink retry behavior and configuration), leaving rounds stuck.

**Recommendation:**
- Make callback **non-reverting**:
  - Store winnings as claimable and emit event.
  - Let player call `claim(requestId)` later.
- Alternatively, wrap payout in `try/catch` and mark a “pending payout”.

#### C) External call in playDice (forwarding bet)
`playDice()` forwards ETH to Treasury using `i_treasury.call{value: msg.value}("")`. This is an external call before state is fully finalized (though you do store state after VRF request).

**Impact:**
- If Treasury were malicious (or upgraded), it could re-enter (unlikely if you control it).
- More importantly, the call is unnecessary risk; you can keep ETH in DiceGame and later sweep/settle.

**Recommendation:**
- Either:
  - Keep bet in DiceGame and let Treasury pull funds, or
  - Call Treasury after the request state is stored (CEI pattern).

#### D) MEV & prediction visibility
Bets are visible in the mempool (`_prediction` and bet amount). While VRF randomness prevents miners from biasing results, MEV can still:
- censor certain bets,
- selectively include/deny transactions based on player patterns.

**Recommendation:**
- Add **commit–reveal** for the bet parameters (commit hash, reveal after inclusion).
- Or support private transaction submission.

#### E) Parameter hardcoding
Treasury address and subscription ID are hardcoded (immutable/variable).

**Impact:**
- Misconfiguration or redeploy changes require redeploy.
- If Treasury changes, dice contract must be redeployed.

**Recommendation:**
- Make these configurable with `onlyOwner` setters OR deploy a registry.
- If you keep immutables, document deployment flow clearly.

---

## 2.3 Lottery.sol

### What it does well
- Uses `OPEN/CALCULATING` state lock to avoid mid-draw entries.
- Emits `WinnerPicked(winner, prize, winnerIndex, totalPlayers)` for verification.

### Key risks & recommendations

#### A) Missing require on house fee transfer
`(bool successFee, ) = i_treasury.call{value: houseFee}("");`  
The `successFee` result is not checked.

**Impact:**
- If treasury call fails, fee is not sent but lottery still completes and pays winner.
- This may be acceptable, but it silently breaks economics/accounting.

**Recommendation:**
- Either require success:
  - `require(successFee, "Fee transfer failed");`
- Or store unpaid fees for later sweep (non-blocking).

#### B) Winner payout can revert (DoS)
Winner payout uses:
`(bool success, ) = recentWinner.call{value: prize}(""); require(success, "Transfer failed");`

If the winner is a contract that reverts on receiving ETH, the callback reverts → lottery can get stuck in `CALCULATING`.

**Recommendation:**
- Use pull payments:
  - Store `s_pendingWinnings[winner] += prize` and let winner claim.
- Or allow owner/operator to force-resolve / reroll after timeout.

#### C) Unbounded array growth
`s_players` grows per ticket. For large participation, gas to iterate (e.g., `getPlayerTickets`) can be expensive.  
Your code notes that off-chain calls are free; that’s fine.

**Recommendation:**
- For very large scale: use event-based ticket indexing instead of on-chain scanning.

#### D) Automation trust / liveness
The contract includes `checkUpkeep` / `performUpkeep` pattern but doesn’t integrate an on-chain keeper registry directly here.

**Impact:**
- If no one calls `performUpkeep`, rounds won’t draw.

**Recommendation:**
- Integrate Chainlink Automation (Keeper) properly OR incentivize callers (tip) OR allow anyone to call (already allowed) with reward.

---

## 3. Cross-Cutting Risks

## 3.1 VRF Subscription / Consumer Misconfiguration
If the contract is not added as a consumer or subscription lacks funds, randomness requests fail.

**Mitigation:**
- Deployment checklist:
  - Add consumer contracts to subscription
  - Fund subscription with LINK (if needed) / ensure billing mode

## 3.2 Callback Gas Limits
If callback gas is too low, fulfillment will fail.

**Mitigation:**
- Keep callbacks minimal; avoid external calls during callback.
- Prefer claim-based payouts.

## 3.3 Economic security / house edge
- Dice uses a “house edge” constant, lottery takes 10% fee.
- Without bankroll management, a lucky streak can drain the Treasury.

**Mitigation:**
- Dynamic max bet
- Reserve ratio
- Separate bankroll per game

## 3.4 MEV / Front-running & Censorship
VRF prevents randomness manipulation, but not censorship or user targeting.

**Mitigation:**
- Commit–reveal for sensitive bets
- Allow private tx submission
- Rate limits / minimum delays

---

## 4. Recommended Hardening Checklist (Priority Order)

### P0 (must-fix for production)
- **Make VRF callbacks non-reverting** (claim-based payouts) for Dice and Lottery.
- Add **bankroll / max bet checks** in Dice.
- Check `successFee` in Lottery or handle unpaid fees explicitly.
- Add `ReentrancyGuard` and follow CEI pattern.

### P1 (strongly recommended)
- Add commit–reveal for Dice bet parameters.
- Add admin-configurable addresses/IDs or a registry.
- Add pause/emergency stop (`Pausable`) for incident response.

### P2 (nice-to-have)
- ERC-20 support
- Multi-game router / shared interfaces
- On-chain risk engine & per-game limits

---

## 5. What users can verify (Fairness Proof)

Even without reading internal state, users can verify:
- Dice:
  - `DiceRolled` + `DiceLanded` events provide requestId, inputs, and result.
- Lottery:
  - `WinnerPicked` provides winnerIndex and totalPlayers to validate indexing against the VRF-derived random number (if retrieved via logs/VRF proof tooling).

