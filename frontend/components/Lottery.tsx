import { useState, useMemo, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance, useWatchContractEvent } from 'wagmi';
import { parseEther, formatEther, decodeEventLog } from 'viem';
import { LOTTERY_ADDRESS, LOTTERY_ABI } from '../utils/contracts';

export default function Lottery() {
  const { address, isConnected } = useAccount();
  const [lastWinnerInfo, setLastWinnerInfo] = useState<{
    winner: string, 
    prize: string,
    txHash: string 
  } | null>(null);

  // ==========================================
  // 1. ReadContract
  // ==========================================
  
  // A. pool
  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address: LOTTERY_ADDRESS as `0x${string}`,
  });

  // B. status (0=OPEN, 1=CALCULATING)
  const { data: lotteryState } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`,
    abi: LOTTERY_ABI,
    functionName: 's_lotteryState',
    query: { refetchInterval: 3000 } 
  });

  // C. PlayerTickets
  const { data: myTicketsData, refetch: refetchMyTickets } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`,
    abi: LOTTERY_ABI,
    functionName: 'getPlayerTickets',
    args: [address],
    query: { enabled: isConnected && !!address }
  });

  // D. recentWinner
  const { data: recentWinnerAddress, refetch: refetchRecentWinner } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`,
    abi: LOTTERY_ABI,
    functionName: 's_recentWinner',
    query: { refetchInterval: 3000 } 
  });

  // ==========================================
  // 2. calculation
  // ==========================================
  const myTicketNumbers = useMemo(() => {
    if (!myTicketsData) return [];
    // @ts-ignore
    return (myTicketsData as bigint[]).map(n => n.toString());
  }, [myTicketsData]);

  const stats = useMemo(() => {
    const totalBalance = balanceData ? Number(formatEther(balanceData.value)) : 0;
    const totalTickets = Math.floor(totalBalance / 0.001);
    const prizePot = totalBalance * 0.9;
    return {
      totalBalance: totalBalance.toFixed(4),
      totalTickets: totalTickets,
      prizePot: prizePot.toFixed(4),
    };
  }, [balanceData]);

  // ==========================================
  // 3. buy
  // ==========================================
  const { writeContractAsync, isPending: isBuyPending, data: buyHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: buyHash });

  const handleEnterRaffle = async () => {
    if (!isConnected) return alert("请先连接钱包");
    try {
      await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`,
        abi: LOTTERY_ABI,
        functionName: 'enterRaffle',
        value: parseEther('0.001'),
      });
    } catch (error: any) {
      alert(error.shortMessage || error.message);
    }
  };

  useEffect(() => {
    if (isConfirmed) {
      refetchBalance();
      refetchMyTickets();
    }
  }, [isConfirmed, refetchBalance, refetchMyTickets]);

  // ==========================================
  // 4. Listen for events
  // ==========================================

  useWatchContractEvent({
    address: LOTTERY_ADDRESS as `0x${string}`,
    abi: LOTTERY_ABI,
    eventName: 'WinnerPicked',
    onLogs(logs) {
      refetchBalance();
      refetchMyTickets();
      refetchRecentWinner();

      try {
        const log = logs[0];
        console.log("🔍 Logs:", log);
        const decoded = decodeEventLog({
          abi: LOTTERY_ABI,
          data: log.data,
          topics: log.topics
        });

        console.log("🔓 ", decoded);
        // @ts-ignore
        const { winner, prize, winnerIndex, totalPlayers } = decoded.args;

        const prizeEth = formatEther(prize as bigint);
        const wIndex = winnerIndex.toString();
        const tPlayers = totalPlayers.toString();
        const txHash = log.transactionHash as string;

        setLastWinnerInfo({ 
            winner: winner as string, 
            prize: prizeEth, 
            txHash: txHash 
        });


        if (address && (winner as string).toLowerCase() === address.toLowerCase()) {
          alert(`🎉 Congratulations! You Won!\n\n🎟️ Winning Number: #${wIndex}\n💰 Prize: ${prizeEth} ETH\n👥 Total Players: ${tPlayers}`);
        } else {
          alert(`🎰 Round Ended\n\n🏆 Winning Number: #${wIndex}\n👥 Total Players: ${tPlayers}\nWinner: ${(winner as string).slice(0,6)}...`);
        }

      } catch (error) {
        console.error("❌ :", error);
      }
    },
  });

  useEffect(() => {
    if (recentWinnerAddress && recentWinnerAddress !== '0x0000000000000000000000000000000000000000') {
        if (!lastWinnerInfo || lastWinnerInfo.winner.toLowerCase() !== (recentWinnerAddress as string).toLowerCase()) {
            console.log("⚠️ new winner:", recentWinnerAddress);
            setLastWinnerInfo({
                winner: recentWinnerAddress as string,
                prize: "???", 
                txHash: ""    
            });
            refetchBalance();
            refetchMyTickets();
        }
    }
  }, [recentWinnerAddress, lastWinnerInfo, refetchBalance, refetchMyTickets]);


  // ==========================================
  // 5. UI 
  // ==========================================
  const isCalculating = (lotteryState as number) === 1;

  return (
    <div className="p-6 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl border border-purple-500/50 w-full max-w-md shadow-2xl relative overflow-hidden">
      
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

      {/* title */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
            🎰 Chainlink Lottery
          </h2>
          <p className="text-xs text-purple-300 mt-1">Entry: 0.001 ETH</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isCalculating ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'bg-green-500/20 border-green-500 text-green-400'}`}>
          {isCalculating ? 'CALCULATING...' : 'OPEN'}
        </div>
      </div>

      {/* pool */}
      <div className="bg-black/40 p-5 rounded-xl border border-purple-500/30 mb-6 text-center relative z-10 backdrop-blur-sm">
        <div className="text-purple-300 text-xs uppercase tracking-widest mb-1">Estimated Prize (90%)</div>
        <div className="text-5xl font-black text-white drop-shadow-lg mb-2">
          {stats.prizePot} <span className="text-lg font-medium text-gray-500">ETH</span>
        </div>
        <div className="flex justify-center gap-4 text-xs text-gray-400 font-mono">
          <span>Pool: {stats.totalBalance} ETH</span>
          <span>Tickets: {stats.totalTickets}</span>
        </div>
      </div>

      {/* My Tickets */}
      <div className="mb-6 bg-purple-800/30 rounded-lg p-4 border border-purple-600/30 relative z-10">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-white font-bold flex items-center gap-2">
            🎫 My Tickets <span className="bg-purple-600 text-[10px] px-2 py-0.5 rounded-full">{myTicketNumbers.length}</span>
          </span>
          <span className="text-xs text-purple-300">
             Win Chance: {stats.totalTickets > 0 ? ((myTicketNumbers.length / stats.totalTickets) * 100).toFixed(2) : 0}%
          </span>
        </div>
        
        {myTicketNumbers.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4 border border-dashed border-gray-700 rounded">
            No tickets yet. Waiting for you!
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
            {myTicketNumbers.map((ticketId) => (
              <span key={ticketId} className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded shadow-sm hover:bg-yellow-400 transition-colors cursor-default">
                #{ticketId}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* button */}
      <button
        onClick={handleEnterRaffle}
        disabled={isBuyPending || isConfirming || isCalculating}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg mb-4 relative z-10
          ${isBuyPending || isConfirming ? 'bg-gray-600 cursor-not-allowed text-gray-400' : 
            isCalculating ? 'bg-red-600 cursor-not-allowed text-white' : 
            'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 hover:scale-[1.02] active:scale-[0.98] text-black'}`}
      >
        {isBuyPending ? 'Confirming...' : 
         isConfirming ? 'Buying...' : 
         isCalculating ? 'Raffle in Progress...' : 
         '🎟️ BUY TICKET'}
      </button>

      {/* success buy */}
      {isConfirmed && buyHash && (
        <div className="text-center mb-4 animate-fade-in">
           <a href={`https://sepolia.etherscan.io/tx/${buyHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:text-green-300 underline">
             ✅ Purchase Confirmed! View Tx
           </a>
        </div>
      )}

      {/* verification link */}
      {lastWinnerInfo && (
        <div className="relative z-10 mt-6 p-4 bg-gradient-to-r from-gray-900 to-black rounded-lg border border-yellow-500/50 animate-slide-up">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
          
          <div className="text-center">
             <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">🎉 Latest Winner</div>
             <div className="text-xs font-mono text-white truncate mb-2 bg-gray-800 py-1 px-2 rounded">
               {lastWinnerInfo.winner}
             </div>
             <div className="text-xl font-black text-yellow-400 mb-3">
               {lastWinnerInfo.prize === "???" ? "Check Wallet" : `Won ${lastWinnerInfo.prize} ETH`}
             </div>

             <div className="pt-3 border-t border-gray-800">
               {lastWinnerInfo.txHash ? (
                   <a 
                     href={`https://sepolia.etherscan.io/tx/${lastWinnerInfo.txHash}#eventlog`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center justify-center gap-1 font-bold"
                   >
                     🔗 Verify Randomness on Etherscan
                   </a>
               ) : (
                   <a 
                     href={`https://sepolia.etherscan.io/address/${LOTTERY_ADDRESS}#events`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center justify-center gap-1 font-bold"
                   >
                     🔗 View Events on Etherscan
                   </a>
               )}
               <p className="text-[10px] text-gray-600 mt-1">
                 (Check "Logs" tab for Chainlink VRF proof)
               </p>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}