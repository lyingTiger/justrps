import React from 'react';

interface InfoPageProps {
  onBack: () => void;
  todayCount: number;
  totalCount: number;
}

const AppInfoFooter = () => (
  <div className="mt-12 w-full pt-8 border-t border-zinc-800 flex flex-col items-center gap-4">
    <div className="text-center">
      <h4 className="text-zinc-500 text-[10px] font-black uppercase tracking-tighter mb-1">Developed by</h4>
      <p className="text-white text-sm font-black italic uppercase">Treasure Factory</p>
    </div>
    
    <div className="flex gap-4 text-zinc-600 text-[9px] font-bold uppercase">
      <span>Terms of Service</span>
      <span>Privacy Policy</span>
    </div>

    <p className="text-zinc-700 text-[8px] font-mono opacity-50">App Version 1.0.0 (2026)</p>
  </div>
);

export default function InfoPage({ 
  onBack, 
  todayCount, 
  totalCount  
}: InfoPageProps) {
  return (
    <div className="w-full max-w-[340px] flex flex-col items-center mt-6 px-4 animate-in fade-in duration-300">
      
      <div className="w-full flex justify-end mb-0">
        <button onClick={onBack} 
          className="px-4 py-1 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700"
        >
          Back
        </button>
      </div>


      {/* 💉 [신규 추가] 2H soft 로고 구역 */}
      <div className="w-full flex justify-center mt-7 mb-0 opacity-90">
        <img 
          src="/images/logo_2hsoft.png" 
          alt="2H soft logo" 
          className="h-35 object-contain" 
        />
      </div>


      {/* 개발자 메일 */}
        <div className="w-full px-6 -mt-2">

          <div className="flex justify-between items-center py-3 border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-500 font-black uppercase">Developer</span>
            <a 
              href="mailto:wankim0916@gmail.com" 
              className="text-xs text-[#FF9900] font-black tracking-tighter hover:text-white"
            >
              wankim0916@gmail.com
            </a>
            
          </div>

          {/* 🔻 Contact (이메일 문의) 영역 */}
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

      {/* 게임 정보 카드 */}
      <div className="w-full space-y-1 mt-6">
        <div className="w-55 p-4 mb-6 mt-8 mx-auto border border-zinc-700 rounded-[16px] flex flex-col items-center text-center shadow-xl">
          
          {/* 💉 로고와 버전을 inline-block으로 감싸 로고 너비만큼만 공간을 확보합니다. */}
          <div className="inline-block text-right">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-0 text-center">
              <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
            </h1>
            
            {/* 💉 이제 이 텍스트는 위 h1(로고)의 너비 안에서만 우측 정렬됩니다. */}
            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0 mb-4">
              Ver. 1.1.86
            </p>
          </div>

          <div className="space-y-4 w-full text-zinc-400 text-[11px] font-bold uppercase leading-relaxed -mt-1">
            <p>Designed for web browsers.</p>
          </div>
        </div>
      </div>


      <div className="w-full space-y-1 mt-6">

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

      </div>
    </div>
  );
}