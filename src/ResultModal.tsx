import React from 'react';

interface ResultModalProps {
  isOpen: boolean;
  mode: string;
  round: number;
  time: number;
  earnedCoins: number;
  userCoins: number;
  isNewRecord: boolean;
  continueCount: number;
  continueCost: number;
  onContinue: () => void;
  onRetry: () => void;
  onLobby: () => void;
  onShop: () => void;
}

export default function ResultModal({ 
  isOpen, mode, round, time, earnedCoins, userCoins, isNewRecord, 
  continueCount, continueCost, onContinue, onRetry, onLobby, onShop 
}: ResultModalProps) {
  if (!isOpen) return null;

  const canContinue = continueCount > 0 && userCoins >= continueCost;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-[340px] bg-zinc-900 border-2 border-zinc-800 rounded-[40px] p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center animate-in zoom-in-95 duration-300">
        
        {/* 타이틀 영역 */}
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">
          Game Over
        </h2>
        {/* 🟠 [수정]: 모드 이름 뒤에 'MODE' 추가 및 대문자 유지 */}
        <p className="text-4xl font-black text-[#FF9900] italic uppercase tracking-tighter leading-none mb-8 text-center">
          {mode.includes('MODE') ? mode : `${mode} MODE`}
        </p>

        {/* 메인 결과 (ROUND) */}
        <div className="relative mb-8 text-center">
          <div className="text-8xl font-black text-white leading-none tracking-tighter">
            {round}
          </div>
          <div className="text-2xl font-black text-white uppercase italic tracking-widest mt-[-10px]">
            ROUND
          </div>
          {isNewRecord && (
            <div className="absolute -top-6 -right-10 bg-[#FF9900] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-[0_0_20px_#FF9900] animate-bounce">
              New Record!
            </div>
          )}
        </div>

        {/* 스탯 정보 */}
        <div className="w-full space-y-3 mb-8 bg-black/30 p-4 rounded-3xl border border-zinc-800/50">
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Clear Time</span>
            <span className="text-white font-mono font-bold text-lg">{time.toFixed(2)}s</span>
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Earned</span>
            <div className="flex items-center gap-1">
              <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
              <span className="text-[#FF9900] font-mono font-bold text-lg">+{earnedCoins}</span>
            </div>
          </div>
        </div>

        {/* 버튼 그룹 */}
        <div className="w-full space-y-3">
          {/* CONTINUE 버튼 */}
          <button 
            onClick={onContinue}
            disabled={!canContinue}
            className={`w-full h-16 rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl
              ${canContinue 
                ? 'bg-white text-black active:scale-95' 
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
          >
            <span className="text-lg font-black uppercase leading-none">Continue</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold uppercase opacity-70">Left: {continueCount}/3</span>
              <div className="flex items-center gap-1">
                {/* 🟠 [수정]: 기존 오리지널 코인 아이콘으로 교체 (grayscale 제거) */}
                <img src="/images/coin.png" alt="coin" className="w-3.5 h-3.5 object-contain" />
                <span className="text-[10px] font-bold">-{continueCost}</span>
              </div>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onRetry} className="h-14 bg-zinc-800 text-white font-black text-sm rounded-2xl uppercase hover:bg-zinc-700 active:scale-95 transition-all">Retry</button>
            <button onClick={onLobby} className="h-14 bg-zinc-800 text-white font-black text-sm rounded-2xl uppercase hover:bg-zinc-700 active:scale-95 transition-all">Lobby</button>
          </div>
        </div>

        {/* SHOP 바로가기 */}
        <button 
          onClick={onShop}
          className="mt-8 text-zinc-500 font-bold text-[10px] uppercase tracking-widest border-b border-zinc-800 pb-0.5 hover:text-[#FF9900] hover:border-[#FF9900] transition-all"
        >
          Visit Shop
        </button>
      </div>
    </div>
  );
}