import { ConnectButton } from '@rainbow-me/rainbowkit';
import Head from 'next/head';
import DiceGame from '../components/DiceGame'; 
import Lottery from '../components/Lottery'; 
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <Head>
        <title>Web3 Lottery</title>
      </Head>

      <main className="flex flex-col items-center gap-8 w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-blue-400">Web3 Casino</h1>
        
        <div className="p-4 border border-gray-700 rounded-xl bg-gray-800">
          <ConnectButton />
        </div>

        {/* Dicegame component */}
        <DiceGame /> 
        {/* line */}
        <div className="w-full border-t border-gray-700 my-4"></div>

        {/* lottery */}
        <Lottery />
      </main>
    </div>
  );
}