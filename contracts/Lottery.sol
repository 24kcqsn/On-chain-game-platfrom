// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract Lottery is VRFConsumerBaseV2Plus {
    
    // ================= config =================
    address payable public i_treasury = payable(0x7eA4590384A80DdDB949b5fBBAF9a448C1ddd886);
    uint256 public s_subscriptionId = 14104446156907871786711022307629288755009078792531920662843810444009554921868;

    address constant VRF_COORDINATOR = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
    bytes32 constant KEY_HASH = 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;

    uint256 public constant TICKET_PRICE = 0.001 ether; 
    uint256 public constant INTERVAL = 120; 
    uint32 constant CALLBACK_GAS_LIMIT = 100000;
    uint16 constant REQUEST_CONFIRMATIONS = 3;
    uint32 constant NUM_WORDS = 1;

    address payable[] public s_players;
    uint256 public s_lastTimeStamp;
    enum LotteryState { OPEN, CALCULATING }
    LotteryState public s_lotteryState;
    address public s_recentWinner;

    // events
    event EnteredRaffle(address indexed player);
    
    event WinnerPicked(
        address indexed winner, 
        uint256 prize, 
        uint256 winnerIndex,  
        uint256 totalPlayers  
    );
    constructor() VRFConsumerBaseV2Plus(VRF_COORDINATOR) {
        s_lastTimeStamp = block.timestamp;
        s_lotteryState = LotteryState.OPEN;
    }

    // --- 1. buy tickets ---
    function enterRaffle() external payable {
        require(msg.value >= TICKET_PRICE, "Not enough ETH!");
        require(s_lotteryState == LotteryState.OPEN, "Lottery is calculating");
        if (s_players.length == 0) {
            s_lastTimeStamp = block.timestamp;
        }

        s_players.push(payable(msg.sender));
        
        emit EnteredRaffle(msg.sender);
    }

    // --- 2. check ---
    function checkUpkeep(bytes memory /* checkData */) public view returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = (s_lotteryState == LotteryState.OPEN);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > INTERVAL);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, "0x0");
    }

    // --- 3. peform ---
    function performUpkeep(bytes calldata /* performData */) external {
        (bool upkeepNeeded, ) = checkUpkeep("");
        require(upkeepNeeded, "No upkeep needed");
        s_lotteryState = LotteryState.CALCULATING; 
        s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: KEY_HASH,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );
    }

    // --- 4. Chainlink callback ---
    function fulfillRandomWords(uint256 /* requestId */, uint256[] calldata randomWords) internal override {
        uint256 totalPlayers = s_players.length;
        
        uint256 indexOfWinner = randomWords[0] % totalPlayers;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;

        uint256 totalBalance = address(this).balance;
        uint256 houseFee = (totalBalance * 10) / 100; 
        uint256 prize = totalBalance - houseFee;      

        (bool successFee, ) = i_treasury.call{value: houseFee}("");

        s_lotteryState = LotteryState.OPEN; 
        s_players = new address payable[](0); 
        s_lastTimeStamp = block.timestamp;    

        (bool success, ) = recentWinner.call{value: prize}("");
        require(success, "Transfer failed");
        emit WinnerPicked(recentWinner, prize, indexOfWinner, totalPlayers);
    }
    
    // --- helper function getPlayerTickets ---

    function getPlayerTickets(address player) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < s_players.length; i++) {
            if (s_players[i] == player) {
                count++;
            }
        }

        uint256[] memory ticketIndices = new uint256[](count);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < s_players.length; i++) {
            if (s_players[i] == player) {
                ticketIndices[currentIndex] = i; 
                currentIndex++;
            }
        }
        return ticketIndices;
    }
}