// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

// Define the Treasury interface to show DiceGame what the Treasury looks like.
interface ITreasury {
    function payout(address payable _to, uint256 _amount) external;
}

contract DiceGame is VRFConsumerBaseV2Plus {
    
    // ================= config =================
    
    // Treasury address
    address payable public immutable i_treasury = payable(0x7eA4590384A80DdDB949b5fBBAF9a448C1ddd886); 

    // Chainlink Subscription 
    uint256 public s_subscriptionId = 14104446156907871786711022307629288755009078792531920662843810444009554921868; 

    // Sepolia config
    address constant VRF_COORDINATOR = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
    bytes32 constant KEY_HASH = 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;
    
    // game gonfig
    uint32 constant CALLBACK_GAS_LIMIT = 500000; 
    uint16 constant REQUEST_CONFIRMATIONS = 3;
    uint32 constant NUM_WORDS = 1;
    uint256 constant HOUSE_EDGE = 9800; 
    uint256 constant MIN_BET = 0.00001 ether;


    struct GameRequest {
        address player;
        uint256 betAmount;
        uint256 prediction; 
        bool fulfilled;
        bool didWin;
        uint256 result;
        uint256 payoutAmount;
    }

    mapping(uint256 => GameRequest) public gameRequests;

    event DiceRolled(uint256 indexed requestId, address indexed player, uint256 amount, uint256 prediction);
    event DiceLanded(uint256 indexed requestId, uint256 result, bool winner, uint256 payout);


    constructor() VRFConsumerBaseV2Plus(VRF_COORDINATOR) {

    }

    // --- 1. Helper Function: Calculate Odds (Called by frontend) ---
    // Return value is multiplied by 100, e.g., 198 represents 1.98x odds
    function calculateMultiplier(uint256 prediction) public pure returns (uint256) {
        require(prediction >= 6 && prediction <= 96, "Prediction range 6-96");
        // Win probability = prediction value - 1 (Roll Under)
        uint256 winChance = prediction - 1;
        // Formula: 9800 / win probability
        return HOUSE_EDGE / winChance;
    }

    // --- 2. playdice ---
    function playDice(uint256 _prediction) external payable returns (uint256) {
        require(msg.value >= MIN_BET, "Bet too small");
        require(_prediction >= 6 && _prediction <= 96, "Prediction range 6-96");

        // 1. Forward the player's bet directly to the Treasury for safekeeping.
        (bool success, ) = i_treasury.call{value: msg.value}("");
        require(success, "Failed to send funds to Treasury");

        // 2.  Chainlink request
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: KEY_HASH,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        // 3. request record
        gameRequests[requestId] = GameRequest({
            player: msg.sender,
            betAmount: msg.value,
            prediction: _prediction,
            fulfilled: false,
            didWin: false,
            result: 0,
            payoutAmount: 0
        });

        emit DiceRolled(requestId, msg.sender, msg.value, _prediction);
        return requestId;
    }

    // --- 3. Chainlink callback ---
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        GameRequest storage request = gameRequests[requestId];
        require(!request.fulfilled, "Already fulfilled");

        request.fulfilled = true;
        
        uint256 result = (randomWords[0] % 100) + 1;
        request.result = result;

        if (result < request.prediction) {
            request.didWin = true;
            
            uint256 multiplier = calculateMultiplier(request.prediction);
            uint256 payoutAmount = (request.betAmount * multiplier) / 100;
            request.payoutAmount = payoutAmount;
            ITreasury(i_treasury).payout(payable(request.player), payoutAmount);
        }

        emit DiceLanded(requestId, result, request.didWin, request.payoutAmount);
    }
}