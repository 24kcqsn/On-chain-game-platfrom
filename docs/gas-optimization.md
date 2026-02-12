# Gas Optimization

This document lists gas optimizations for the current contracts and suggests improvements that keep behavior unchanged (or improve robustness with minimal overhead).

Contracts:
- `Treasury.sol`
- `DiceGame.sol`
- `Lottery.sol`

---

## 1. What’s already good

### Use of `constant` / `immutable`
- Dice uses `constant` for configuration parameters and `immutable` for `i_treasury` (saves SLOADs).
- Lottery uses `constant` for key VRF parameters and ticket economics.

### Struct + mapping for Dice rounds
`mapping(uint256 => GameRequest)` avoids dynamic array storage and supports O(1) lookup by `requestId`.

### Lottery removed unnecessary mapping
The code comment notes a removed mapping “节省 Gas” — good decision if it was redundant.

---

## 2. High-impact optimizations (recommended)

## 2.1 Replace revert strings with custom errors
Revert strings cost deployment and runtime gas.

**Example**
```solidity
error Unauthorized();
error InsufficientFunds();
error InvalidPrediction();
error BetTooSmall();
```
Then:
```solidity
if (!isAuthorizedGame[msg.sender]) revert Unauthorized();
```

Applies to all three contracts.

---

## 2.2 Cache storage reads in local variables
Repeated SLOADs are expensive.

### Lottery `fulfillRandomWords`
You already cache `totalPlayers`. Also cache:
- `address payable[] memory players = s_players;` (careful: memory copy costs; best is caching length and indexed reads)
- `uint256 bal = address(this).balance;`

### Dice `fulfillRandomWords`
Cache:
- `GameRequest storage request = gameRequests[requestId];` (already done)
- `uint256 bet = request.betAmount;`
- `uint256 pred = request.prediction;`

---

## 2.3 Use `unchecked` where safe
In Solidity ≥0.8, arithmetic checks cost gas.

### Safe candidates
- loop increments in `getPlayerTickets`
```solidity
for (uint256 i = 0; i < s_players.length; ) {
    ...
    unchecked { ++i; }
}
```

---

## 2.4 Avoid external calls inside VRF callback (also improves liveness)
This is both a **security** and **gas** optimization.

### Dice
Instead of calling Treasury in `fulfillRandomWords`, store `payoutAmount` and let the player claim:
- `claim(requestId)` does the external call.
- Callback becomes cheap and less likely to exceed gas.

### Lottery
Instead of paying winner directly inside callback, store `pendingWinnings[winner]`.

This reduces callback gas, reduces failure risk, and improves overall system reliability.

---

## 3. Medium-impact optimizations

## 3.1 Tighten state variable mutability
### Lottery
`i_treasury` and `s_subscriptionId` can be:
- `immutable` (if fixed per deployment), or
- `private` with getter if needed.

Immutable reduces runtime SLOAD.

### Treasury
`isAuthorizedGame` is a mapping; OK.

---

## 3.2 Pack storage variables (where possible)
Storage packing reduces SSTORE/SLOAD slots.

### Lottery
Current state:
- `s_lastTimeStamp` (uint256)
- `s_lotteryState` (enum → uint8)
- `s_recentWinner` (address)

Could be packed by reordering and sizing:
- `uint64 s_lastTimeStamp;` (enough for timestamps)
- `LotteryState s_lotteryState;` (uint8)
- `address s_recentWinner;` (20 bytes)

This can fit into fewer slots (though `address` dominates; packing can still help depending on layout).

### Dice `GameRequest` struct
Potential packing:
- `address player` (20 bytes)
- `uint96 betAmount` (if you cap bets)
- `uint8 prediction`
- `bool fulfilled`
- `bool didWin`
- `uint8 result`
- `uint128 payoutAmount` (cap)
This can reduce storage cost significantly, but requires explicit economic caps.

---

## 3.3 Use `external` instead of `public` where not called internally
- `calculateMultiplier` is `public pure`. If not called internally (it is called internally), keep as `public` or create `_calculateMultiplier` internal + external view wrapper.
- `checkUpkeep` is `public view` and used internally; ok.

---

## 3.4 Reduce event data where possible
Events are cheaper than storage, but indexing and extra fields cost gas.

- Dice events are reasonable.
- Lottery’s `WinnerPicked` includes extra evidence fields (winnerIndex, totalPlayers). This is **worth it** for transparency, but if you ever need cheaper logs you can remove indexed fields or reduce extra data.

---

## 4. Low-impact micro-optimizations

## 4.1 Prefer `call` over `transfer` where appropriate
- Treasury `adminWithdraw` uses `transfer` which hard-limits gas and can revert in some cases.
- Using `call` is more flexible; gas difference is not huge but improves compatibility.

## 4.2 Short-circuit requires / early reverts
Already used.

---

## 5. Suggested “Gas-Friendly + Robust” Refactor Blueprint

### A) Claim-based payout pattern
- Dice:
  - callback computes outcome and sets `payoutAmount`
  - player calls `claim(requestId)`; Treasury pays
- Lottery:
  - callback sets `pendingWinnings[winner]`
  - winner calls `claimWinnings()`

### B) Keep Treasury as the payout authority
- Treasury remains the only contract sending most ETH out.
- Lottery can still send houseFee to Treasury, but do it in a sweep function if callback should be minimal.

### C) Add bankroll-aware max bet (Dice)
Reduces insolvency risk and avoids failed callbacks (also saves wasted VRF fees and gas).

---

## 6. Quick Wins Checklist

- [ ] Convert require strings to custom errors.
- [ ] Add `unchecked { ++i; }` in `getPlayerTickets` loops.
- [ ] Make Lottery `i_treasury` immutable if fixed.
- [ ] Add claim-based payouts to remove external calls in callbacks.
- [ ] Pack Dice `GameRequest` if you introduce bet caps.

