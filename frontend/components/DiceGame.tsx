import { useState, useMemo, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther, decodeEventLog } from 'viem';
import { DICE_GAME_ADDRESS, DICE_GAME_ABI } from '../utils/contracts';

export default function DiceGame() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  // === state variable ===
  const [amount, setAmount] = useState('0.001'); 
  const [prediction, setPrediction] = useState(50); 
  
  // Used to track the Request ID for the current round
  const [currentRequestId, setCurrentRequestId] = useState<bigint | null>(null);
  const [currentTxHash, setCurrentTxHash] = useState<string | null>(null); 
  // === 1. Write Contract (Place Bet) ===
  const { 
    writeContractAsync, 
    isPending: isWritePending, 
    data: hash 
  } = useWriteContract();

  // === 2. Wait for Transaction Confirmation ===
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    data: receipt 
  } = useWaitForTransactionReceipt({ hash });

  // === 3. Automatically poll for the query results. ===

  const { data: gameResultData, refetch: checkResult } = useReadContract({
    address: DICE_GAME_ADDRESS as `0x${string}`,
    abi: DICE_GAME_ABI,
    functionName: 'gameRequests',
    args: [currentRequestId || BigInt(0)], 
    query: {
      enabled: !!currentRequestId, 
      refetchInterval: (data) => {
        if (!data) return 2000;
        const result = data as unknown as any[];
        if (result && result[3]) return false; 
        return 2000; 
      }
    }
  });

  // === 4. Listen for transaction completion and extract the Request ID. ===
  useEffect(() => {
    if (isConfirmed && receipt && !currentRequestId) {
      // Find the DiceRolled event by iterating over the logs.
      setCurrentTxHash(receipt.transactionHash);
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: DICE_GAME_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === 'DiceRolled') {
            // @ts-ignore
            const id = event.args.requestId;
            console.log("Request ID:", id);
            setCurrentRequestId(id);
            break;
          }
        } catch (e) {

        }
      }
    }
  }, [isConfirmed, receipt, currentRequestId]);

  // === 5. Analyze the query results ===
  //  [player, betAmount, prediction, fulfilled, didWin, result, payoutAmount]
  const resultDisplay = useMemo(() => {
    if (!gameResultData) return null;
    const res = gameResultData as any[];
    
    // If fulfilled (res[3])is false, it means still waiting for Chainlink.
    if (!res[3]) return { status: 'pending' };

    return {
      status: 'completed',
      didWin: res[4],         // boolean
      diceResult: res[5].toString(), 
      payout: res[6].toString() 
    };
  }, [gameResultData]);

  // === 6. calculate multiplier​ ===
  const gameStats = useMemo(() => {
    const winChance = prediction - 1;
    let multiplier = 0;
    if (winChance > 0) multiplier = 98 / winChance;
    return {
      chance: winChance,
      multiplier: multiplier.toFixed(2), 
      payout: (Number(amount) * multiplier).toFixed(5)
    };
  }, [prediction, amount]);

  // === Dice Processing ===
  const handleRoll = async () => {
    if (!amount || !prediction) return alert("请输入金额");
    setCurrentRequestId(null); 
    setCurrentTxHash(null);
    try {
      await writeContractAsync({
        address: DICE_GAME_ADDRESS as `0x${string}`,
        abi: DICE_GAME_ABI,
        functionName: 'playDice',
        args: [BigInt(prediction)],
        value: parseEther(amount),
      });
    } catch (error: any) {
      alert(`错误: ${error.shortMessage || error.message}`);
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md shadow-xl">
      <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
        <span>🎲</span> Roll Under Game
      </h2>

      {
        <div className="space-y-6">
          
          {/* input */}
          <div>
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Bet Amount</span>
              <span>Balance: --</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
              />
              <span className="absolute right-3 top-3 text-gray-500 text-sm">ETH</span>
            </div>
          </div>

          {/* Slider */}
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Roll Under</span>
              <span className="text-3xl font-bold text-white">{prediction}</span>
            </div>
            <input 
              type="range" min="6" max="96" 
              value={prediction} 
              onChange={(e) => setPrediction(Number(e.target.value))}
              className="w-full cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>6</span><span>96</span>
            </div>
          </div>

          {/* Multiplier and payout */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-gray-700/50 p-2 rounded">
              <div className="text-gray-400 text-xs">Win Chance</div>
              <div className="text-green-400 font-bold">{gameStats.chance}%</div>
            </div>
            <div className="bg-gray-700/50 p-2 rounded">
              <div className="text-gray-400 text-xs">Multiplier</div>
              <div className="text-yellow-400 font-bold">{gameStats.multiplier}x</div>
            </div>
            <div className="bg-gray-700/50 p-2 rounded">
              <div className="text-gray-400 text-xs">Payout</div>
              <div className="text-blue-400 font-bold">{gameStats.payout}</div>
            </div>
          </div>

          {/* button */}
          <button
            onClick={handleRoll}
            disabled={isWritePending || isConfirming || (!!currentRequestId && !resultDisplay?.diceResult)}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              isWritePending || isConfirming ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isWritePending ? 'Waiting for Signature...' : 
             isConfirming ? 'Confirming...' : 
             (currentRequestId && !resultDisplay?.diceResult) ? 'Rolling...' :
             'ROLL DICE'}
          </button>

          {/* Result Display Area  */}
          {currentRequestId && currentTxHash && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-600 text-center animate-fade-in">
              
              {/* information */}
              <div className="flex flex-col gap-3 mb-4 text-left bg-gray-800 p-3 rounded border border-gray-700">
                
                {/* Transaction Hash */}
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Transaction Hash</div>
                  <div className="text-xs text-white font-mono truncate" title={currentTxHash}>
                    {currentTxHash}
                  </div>
                </div>

                {/* Request ID */}
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Request ID</div>
                  <div className="text-xs text-yellow-500 font-mono truncate" title={currentRequestId.toString()}>
                    {currentRequestId.toString()}
                  </div>
                </div>

                {/* link */}
                <div className="pt-2 border-t border-gray-700">
                  <a 
                    href={`https://sepolia.etherscan.io/address/${DICE_GAME_ADDRESS}#events`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1 font-bold mb-2"
                  >
                    🔗 Go to Etherscan to Verify Result
                  </a>              
                </div>
              </div>
              
              {(!resultDisplay || resultDisplay.status === 'pending') ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-yellow-400 font-bold animate-pulse">Waiting for dice result...</span>
                  <span className="text-xs text-gray-500">(Usually need 10-30 sec)</span>
                </div>
              ) : (
                <div className={`py-2 border-2 rounded-lg ${resultDisplay.didWin ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'}`}>
                  <div className="text-gray-400 uppercase text-xs tracking-widest mb-1">Dice Result</div>
                  <div className="text-6xl font-black text-white mb-2 drop-shadow-lg">
                    {resultDisplay.diceResult}
                  </div>
                  <div className="text-xl font-bold">
                    {resultDisplay.didWin ? (
                      <span className="text-green-400 flex items-center justify-center gap-2">
                        🎉 WIN! <span className="text-sm bg-green-800 px-2 rounded text-white">+{formatEther(BigInt(resultDisplay.payout))} ETH</span>
                      </span>
                    ) : (
                      <span className="text-red-400">😭 LOSS</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      }
    </div>
  );
}