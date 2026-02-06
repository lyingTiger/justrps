import React from 'react';

interface InfoPageProps {
  onBack: () => void;
  todayCount: number;
  totalCount: number;
}

export default function InfoPage({ 
  onBack, 
  todayCount, 
  totalCount  
}: InfoPageProps) {
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
      <div className="w-full space-y-1">


          {/* 🔻 오늘 방문자 수 표시 영역 */}
          <div className="flex justify-between items-center border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-500 font-black uppercase">Today Visitors</span>
            <span className="text-[10px] text-white font-black uppercase tracking-tighter">{todayCount.toLocaleString()}</span>
          </div>

          {/* 🔻 누적 방문자 표시 영역 */}
          <div className="flex justify-between items-center border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-500 font-black uppercase">Total Visitors</span>
            <span className="text-[10px] text-white font-black uppercase tracking-tighter">{totalCount.toLocaleString()}</span>
          </div>


        <div className="w-full p-8 mb-6 mt-8 bg-zinc-900 border border-zinc-700 rounded-[40px] flex flex-col items-center text-center shadow-xl">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2">
            <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-6">Version 1.0.2 Beta</p>
          
          <div className="space-y-4 w-full text-zinc-400 text-[11px] font-bold uppercase leading-relaxed">
            <p>A fast-paced memory <br/> rock-paper-scissors game.</p>
            <div className="h-[1px] bg-zinc-800 w-12 mx-auto"></div>
            <p>Dsigned for <br/> mobile & web browsers.</p>
          </div>
        </div>

        {/* 하단 링크/정보 */}
        <div className="w-full px-6 space-y-0">

          <div className="flex justify-between items-center py-3 border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-500 font-black uppercase">Developer</span>
            <span className="text-xs text-[#FF9900] font-black tracking-tighter">wankim0916@gmail.com</span>
          </div>

                    {/* 🔻 [추가] Contact (이메일 문의) 영역 */}
          <div className="flex justify-between items-center border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-500 font-black uppercase">Contact</span>
            <a 
              href="mailto:wankim0916@gmail.com" // 👈 실제 이메일 주소로 변경하세요!
              className="text-[10px] text-[#FF9900] font-black uppercase tracking-tighter hover:text-white transition-colors"
            >
              Send Email
            </a>
          </div>

        </div>
      </div>


       {/* 🔻 저작권 표시 */}
      <p className="mt-12 text-[9px] text-[#FF9900] font-bold uppercase flex justify-center gap-8">
        <span>All Rights Reserved</span>
        {/* 🔻 gap-6를 통해 중간에만 고정된 여백을 줌 */}
        <span>© 2026 justRPS Project</span>
      </p>

    </div>
  );
}