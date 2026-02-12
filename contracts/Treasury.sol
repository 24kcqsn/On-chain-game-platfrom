// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Treasury is Ownable {
    
    // Record which contracts are whitelisted game contracts
    mapping(address => bool) public isAuthorizedGame;

    // event
    event GameStatusChanged(address game, bool status);
    event FundsReceived(address sender, uint256 amount);
    event Payout(address indexed game, address indexed player, uint256 amount);

    constructor() Ownable(msg.sender) {}

    // 1. receive ETH 
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    // 2. Authorization Management (Only administrators can operate).
    //For example, after deploying DiceGame, enter its address here and set it to true
    function setGameStatus(address _game, bool _status) external onlyOwner {
        isAuthorizedGame[_game] = _status;
        emit GameStatusChanged(_game, _status);
    }

    // 3. Core Function: Send Rewards to Players (Only authorized games can call this)  
    // _to: The winning player  
    // _amount: The amount won
    function payout(address payable _to, uint256 _amount) external {
        require(isAuthorizedGame[msg.sender], "Unauthorized game contract");
        require(address(this).balance >= _amount, "Treasury: Insufficient funds");

        // send ETH
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Payout transfer failed");

        emit Payout(msg.sender, _to, _amount);
    }

    // 4. Withdraw
    function adminWithdraw(uint256 _amount) external onlyOwner {
        require(address(this).balance >= _amount, "Insufficient funds");
        payable(msg.sender).transfer(_amount);
    }
}