import React from 'react';

interface TutorialPageProps {
  onBack: () => void;
}

export default function TutorialPage({ onBack }: TutorialPageProps) {
  // 공통 스타일 정의
  const titleStyle = "text-sm font-black uppercase italic tracking-tight";
  const descStyle = `${titleStyle} text-zinc-500`; 
  const divider = <div className="w-full h-[1px] bg-zinc-700 my-6" />; 

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center py-8 px-4 animate-in fade-in slide-in-from-bottom-5 duration-500">
      {/* 헤더 섹션 */}
      <h2 className="text-5xl font-black text-[#FF9900] italic uppercase tracking-tighter mb-10 text-center [text-shadow:2px_2px_0_rgba(0,0,0,1)]">
        Tutorial
      </h2>

      {/* 단계별 가이드 영역 (커스텀 스크롤바 적용됨) */}
      <div className="w-full overflow-y-auto custom-scrollbar pr-2 max-h-[60vh]">
        
        {/* --- 01 단계: 기억하기 --- */}
        <div className="flex flex-col items-center text-center space-y-3 animate-in slide-in-from-top duration-700">
          <h4 className={`${titleStyle} text-white`}>
            <span className="text-[#FF9900] mr-2">01</span>Remember AI's Hand
          </h4>
          <p className={descStyle}>AI가 제시하는 손의 순서를 기억하세요.</p>
          <div className="flex gap-2 mt-1">
            {['rock', 'paper', 'scissor'].map(hand => (
              <div key={hand} className="w-11 h-11 bg-zinc-900 border border-zinc-800 rounded-2xl p-2">
                {/* [UPDATE] opacity-30 -> opacity-90 으로 변경하여 밝게 표시 */}
                <img src={`/images/${hand}.png`} className="w-full h-full object-contain opacity-90" />
              </div>
            ))}
          </div>
        </div>

        {divider}

        {/* --- 02 단계: I GOT IT 클릭 --- */}
        <div className="flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-500 delay-300">
          <h4 className={`${titleStyle} text-white`}>
            <span className="text-[#FF9900] mr-2">02</span>"I Got It" Click
          </h4>
          <div className="px-8 py-2.5 bg-zinc-900 rounded-full border border-[#FF9900]/50 text-[#FF9900] text-xs font-black uppercase italic animate-pulse shadow-[0_0_20px_rgba(255,153,0,0.15)]">
            "I GOT IT"
          </div>
          <p className={descStyle}>준비가 되면 버튼을 눌러 시작하세요.</p>
        </div>

        {divider}

        {/* --- 03 단계: 대응하기 --- */}
        <div className="flex flex-col items-center text-center space-y-3 animate-in slide-in-from-bottom duration-700 delay-500 pb-2">
          <h4 className={`${titleStyle} text-white`}>
            <span className="text-[#FF9900] mr-2">03</span>Match Based on Mode
          </h4>
          <div className="space-y-0.5">
            <p className={descStyle}>모드별 조건에 맞춰 클릭</p>
            <p className="text-[#FF9900] text-xs font-black uppercase italic">(예: WIN MODE)</p>
          </div>
          <div className="flex gap-2 mt-1">
            {['paper', 'scissor', 'rock'].map(hand => (
              <div key={hand} className="w-11 h-11 bg-zinc-900 border border-[#FF9900] rounded-2xl p-2 shadow-[0_0_15px_rgba(255,153,0,0.2)]">
                <img src={`/images/${hand}.png`} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 시작 버튼 */}
      <button 
        onClick={onBack}
        className="w-full h-14 shrink-0 bg-[#FF9900] text-black font-black uppercase rounded-2xl text-lg mt-8 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,153,0,0.2)]"
      >
        Ready to Battle
      </button>
    </div>
  );
}