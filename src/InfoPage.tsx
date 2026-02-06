import React from 'react';

interface InfoPageProps {
  onBack: () => void;
}

export default function InfoPage({ onBack }: InfoPageProps) {
  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in duration-300">
      {/* 상단 헤더 */}
      <div className="w-full flex justify-between items-center mb-10">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#FF9900]">Info</h2>
        <button 
          onClick={onBack} 
          className="h-10 px-4 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl border border-zinc-700 hover:border-[#FF9900] transition-all"
        >
          Back
        </button>
      </div>

      {/* 게임 정보 카드 */}
      <div className="w-full space-y-6">
        <div className="w-full p-8 bg-zinc-900 border border-zinc-700 rounded-[40px] flex flex-col items-center text-center shadow-xl">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2">
            <span className="text-[#FF9900]">just</span> RPS
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-6">Version 1.0.2 Beta</p>
          
          <div className="space-y-4 w-full text-zinc-400 text-[11px] font-bold uppercase leading-relaxed">
            <p>A fast-paced memory <br/> rock-paper-scissors game.</p>
            <div className="h-[1px] bg-zinc-800 w-12 mx-auto"></div>
            <p>Developed for <br/> mobile & web browsers.</p>
          </div>
        </div>

        {/* 하단 링크/정보 */}
        <div className="w-full px-6 space-y-3">
          <div className="flex justify-between items-center py-3 border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-500 font-black uppercase">Developer</span>
            <span className="text-[10px] text-white font-black uppercase tracking-tighter">Treasure Factory</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-500 font-black uppercase">License</span>
            <span className="text-[10px] text-white font-black uppercase tracking-tighter">All Rights Reserved</span>
          </div>
        </div>
      </div>

      <p className="mt-12 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
        © 2026 justRPS Project
      </p>
    </div>
  );
}