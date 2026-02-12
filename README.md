# On-Chain Verifiable Game Platform 🎲

> **SC6107 Development Project - Topic 4**
> A decentralized, provably fair gaming platform built on Ethereum (Sepolia Testnet) utilizing Chainlink VRF for randomness.

## 📖 Project Overview

This project implements a full-stack decentralized application (DApp) that allows users to play on-chain games with provable fairness. It features a robust **Treasury** system to unify liquidity and utilizes **Chainlink VRF** to ensure all game outcomes are tamper-proof.

### Key Features
* **Centralized Treasury:** A dedicated smart contract (`Treasury.sol`) that manages the shared bankroll for all games, ensuring efficient liquidity management.
* **Dice Game:** A classic "roll under" betting game where players can customize their win probability.
* **Lottery:** A time-interval based raffle system that automatically selects a winner using Chainlink Automation logic.
* **Provable Fairness:** Integrated with **Chainlink VRF v2.5** to generate verifiable random numbers on-chain.
* **Modern Frontend:** A responsive UI built with **Next.js**, **TypeScript**, and **Tailwind CSS**.

---

## 🛠 Tech Stack

* **Blockchain:** Ethereum (Sepolia Testnet)
* **Smart Contracts:** Solidity (v0.8.20)
* **Frontend Framework:** Next.js (React)
* **Languages:** TypeScript, Solidity
* **Styling:** Tailwind CSS
* **Oracle:** Chainlink VRF v2.5

---

## 📂 Project Structure

The project is organized into two main directories: `contracts` for the blockchain logic and `frontend` for the user interface.

```bash
.
├── contracts/               # 📂 Smart Contracts (Backend)
│   ├── DiceGame.sol         # Logic for the Dice game
│   ├── Lottery.sol          # Logic for the Lottery system
│   └── Treasury.sol         # Central funds management
│
│── docs/                    # 📂 Project Documentation
│   ├── architecture.md      # System architecture and design choices
│   ├── gas-optimization.md  # Gas saving strategies implemented
│   └── security-analysis.md # Security audit and risk assessment
│
├── frontend/                # 📂 Next.js Application (Frontend)
│   ├── components/          # React UI Components (DiceGame.tsx, Lottery.tsx)
│   ├── pages/               # Pages & Routing (index.tsx, _app.tsx)
│   ├── public/              # Static Assets (Images, Icons)
│   ├── styles/              # Global Styles (globals.css)
│   ├── utils/               # Configuration & Helpers
│   │   ├── abis/            # Contract ABI JSON files
│   │   └── contracts.ts     # Contract Address Constants
│   ├── next.config.mjs      # Next.js Configuration
│   ├── tailwind.config.ts   # Tailwind CSS Configuration
│   ├── tsconfig.json        # TypeScript Configuration
│   └── package.json         # Frontend Dependencies
│
├── scripts/               
│
└── README.md                # Project Documentation

```

---

## 🚀 Getting Started

Follow these instructions to deploy the contracts and run the frontend locally.

### Prerequisites

* **Node.js** (v18 or later)
* **MetaMask** wallet extension (connected to Sepolia Testnet)
* **Sepolia ETH** (for deployment gas and betting)
* **Sepolia LINK** (for Chainlink VRF fees)

### 1. Smart Contract Deployment

Navigate to the project root to compile and deploy contracts using Hardhat (or use Remix IDE):

1. **Compile:**
```bash
npx hardhat compile

```


2. **Deploy:**
* Deploy `Treasury.sol` first.
* Deploy `DiceGame.sol` and `Lottery.sol`.



### 2. On-Chain Configuration (Required)

For the platform to function, you must configure the contracts on-chain:

1. **Authorize Games:**
* Call `setGameStatus(DICE_GAME_ADDRESS, true)` on the **Treasury** contract.
* Call `setGameStatus(LOTTERY_ADDRESS, true)` on the **Treasury** contract.


2. **Fund Treasury:**
* Send **ETH** to the **Treasury** contract address to serve as the house bankroll.


3. **Setup Chainlink VRF:**
* Create a Subscription at [vrf.chain.link](https://vrf.chain.link).
* Add `DiceGame` and `Lottery` contracts as **Consumers**.
* Fund the subscription with **LINK** tokens.



### 3. Frontend Setup

1. **Navigate to the frontend directory:**
```bash
cd frontend

```


2. **Install Dependencies:**
```bash
npm install

```


3. **Update Contract Configuration:**
* Open `frontend/utils/contracts.ts`.
* Replace the placeholder addresses with your deployed contract addresses:


```typescript
export const DICE_GAME_ADDRESS = "0x...";
export const LOTTERY_ADDRESS = "0x...";
export const TREASURY_ADDRESS = "0x...";

```


4. **Run the Application:**
```bash
npm run dev

```


Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) in your browser.

---

## 🎮 How to Play

### Dice Game

1. Connect your wallet via the top-right button.
2. Adjust the slider to choose a "Roll Under" prediction (6-96).
3. Enter an ETH amount and click **Roll**.
4. Wait for the Chainlink VRF callback to reveal the result.

### Lottery

1. Check the countdown timer.
2. Click **Enter Raffle** to purchase a ticket.
3. When the timer ends, Chainlink Automation triggers the draw, and the winner is automatically paid.

---

## ⚙️ Architecture

The system uses a **Hub-and-Spoke** architecture:

* **Hub (Treasury):** Holds all funds. It receives the house edge/fees and pays out winnings.
* **Spokes (Games):** Handle game logic and user interaction. They request randomness from Chainlink and instruct the Treasury to release funds upon a win.

---

## 📝 License

This project is licensed under the MIT License.

```

```
