# On-Chain Verifiable Game Platform 🎲

> **SC6107 Development Project - Topic 4**
> A decentralized, provably fair gaming platform built on Ethereum (Sepolia Testnet) utilizing Chainlink VRF for randomness.

## 📖 Project Overview

This project implements a decentralized gaming application (DApp) featuring a centralized **Treasury** system to manage liquidity across multiple games. It ensures fairness by using **Chainlink VRF (Verifiable Random Function)** to generate random outcomes on-chain.

### Key Features
* **Centralized Treasury:** A dedicated contract that manages funds and payouts, separating liquidity from game logic.
* **Dice Game:** A probability-based "roll under" game where players can adjust win chances.
* **Lottery:** A time-based raffle system that automatically picks a winner.
* **Provable Fairness:** Utilizes Chainlink VRF v2.5 to ensure tamper-proof results.
* **Modern Frontend:** Built with Next.js, TypeScript, and Tailwind CSS.

---

## 🛠 Tech Stack

* **Smart Contracts:** Solidity (v0.8.20)
* **Frontend:** Next.js (React), TypeScript, Tailwind CSS
* **Blockchain Interaction:** Wagmi / Viem
* **Oracle Services:** Chainlink VRF v2.5
* **Network:** Sepolia Testnet

---

## 📂 Project Structure

```bash
.
├── contracts/               # Solidity Smart Contracts
│   ├── DiceGame.sol         # Logic for the Dice rolling game
│   ├── Lottery.sol          # Logic for the Lottery/Raffle system
│   └── Treasury.sol         # Central fund management contract
├── pages/                   # Next.js Pages & Routing
├── components/              # UI Components (DiceGame.tsx, Lottery.tsx)
├── utils/                   # Utilities
│   ├── abis/                # Contract ABIs
│   └── contracts.ts         # Contract addresses configuration
└── public/                  # Static assets

```

---

## 🚀 Getting Started

### Prerequisites

* Node.js (v18+)
* MetaMask (Sepolia Network)
* Sepolia ETH & LINK Tokens

### 1. Installation

```bash
# Install dependencies
npm install

```

### 2. Smart Contract Deployment

1. **Compile Contracts:**
```bash
npx hardhat compile

```


2. **Deploy to Sepolia:**
* Deploy `Treasury.sol` first.
* Deploy `DiceGame.sol` and `Lottery.sol`.



### 3. Configuration (Crucial)

After deployment, you must configure the on-chain connections:

1. **Authorize Games (On-Chain):**
* Call `setGameStatus(diceGameAddress, true)` on the **Treasury** contract.
* Call `setGameStatus(lotteryAddress, true)` on the **Treasury** contract.


2. **Fund Treasury:**
* Send ETH to the **Treasury** contract address (to cover payouts).


3. **Setup Chainlink VRF:**
* Create a subscription at [vrf.chain.link](https://vrf.chain.link).
* Add `DiceGame` and `Lottery` addresses as **Consumers**.
* Fund the subscription with LINK tokens.


4. **Update Frontend Config:**
* Open `utils/contracts.ts`.
* Paste your new contract addresses into the constants (`DICE_GAME_ADDRESS`, etc.).



### 4. Run Frontend

```bash
npm run dev

```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) to view the DApp.

---

## 🎮 How to Play

### Dice Game

1. Connect your Wallet.
2. Adjust the slider to choose your **Prediction** (6-96).
3. Enter bet amount and click **Roll**.
4. Wait for the VRF callback to reveal the result.

### Lottery

1. Click **Enter Raffle** and pay the ticket price.
2. Wait for the timer (120s) to end.
3. Chainlink Automation triggers the draw; the winner receives 90% of the pot.

---

## ⚙️ Architecture

* **Treasury:** Acts as the "Bank". It holds the house edge from Dice and fees from Lottery. Only authorized games can request payouts.
* **Chainlink VRF:**
1. User initiates game → Contract requests randomness.
2. Chainlink generates proof off-chain.
3. Callback function (`fulfillRandomWords`) finalizes the winner on-chain.