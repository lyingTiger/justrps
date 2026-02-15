import React from 'react';

export default function AdLoadingOverlay({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
      
      {/* 💉 중앙 회전 애니메이션 영역 */}
      <div className="relative w-24 h-24 mb-8">
        {['scissor', 'rock', 'paper'].map((type, i) => (
          <div 
            key={type}
            className="absolute inset-0 flex items-center justify-center animate-spin-slow"
            style={{ animationDelay: `${i * 0.2}s`, animationDuration: '3s' }}
          >
            <div className="w-10 h-10 -translate-y-10">
              <img src={`/images/${type}.png`} alt={type} className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,153,0,0.5)]" />
            </div>
          </div>
        ))}
      </div>

      {/* 💉 텍스트 안내 */}
      <div className="text-center">
        <h2 className="text-xl font-black text-[#FF9900] italic uppercase tracking-widest animate-pulse">
          Preparing Ad...
        </h2>
        <p className="text-zinc-500 text-[10px] font-bold uppercase mt-2 tracking-tighter">
          Checking Reward Data
        </p>
      </div>
    </div>
  );
}