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
  onWatchAd: () => void;
}

export default function ResultModal({ 
  isOpen, mode, round, time, earnedCoins, userCoins, isNewRecord, 
  continueCount, continueCost, onContinue, onRetry, onLobby, onShop,
  onWatchAd 
}: ResultModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-[340px] bg-zinc-900 border-2 border-zinc-800 rounded-[40px] p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center animate-in zoom-in-95 duration-300">
        
        {/* 1. 상단 그룹: Game Over & Mode */}
        <div className="w-full text-center mb-4">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">
                Game Over
            </h2>
            <p className="text-4xl mb-2 font-black text-[#FF9900] italic uppercase tracking-tighter leading-none text-center">
                {mode.includes('MODE') ? mode : `${mode} MODE`}
            </p>
        </div>

        {/* 2. 중앙 그룹: ROUND */}
        <div className="relative my-8 text-center">
          <div className="text-8xl font-black text-white leading-none tracking-tighter">
            {round}
          </div>
          <div className="text-2xl font-black text-white uppercase italic tracking-widest mt-[-5px]">
            ROUND
          </div>
          {isNewRecord && (
            <div className="absolute -top-6 -right-10 bg-[#FF9900] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-[0_0_20px_#FF9900] animate-bounce">
              New Record!
            </div>
          )}
        </div>

        {/* 3. 하단 그룹: 데이터 (스탯 정보) */}
        {/* 🔻 [수정] border-zinc-800/50 ➡️ border-[#FF9900] (1px 주황색 테두리 적용) */}
        <div className="w-full space-y-3 mb-6 bg-black/30 p-4 rounded-3xl border border-zinc-700">
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Clear Time</span>
            <span className="text-white font-mono font-bold text-lg">{time.toFixed(2)}s</span>
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Earned</span>
            <div className="flex items-center gap-1">
              <span className="text-[#FF9900] font-mono font-bold text-lg">+{earnedCoins}</span>
              <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
            </div>
          </div>
        </div>

        {/* 4. 최하단: 이어하기 & 버튼 그룹 */}
        <div className="w-full flex flex-col items-center">
            
            {/* 이어하기 섹션 (테두리만 깜빡이는 이중 레이어 구조) */}
            {continueCount > 0 ? (
                <div className="w-full relative mb-6 group">
                    {/* 🔻 [추가] 테두리와 빛 번짐 효과만 담당하는 레이어 (내용물에 영향 없음) */}
                    <div className="absolute inset-0 rounded-[32px] border-2 border-[#FF9900] shadow-[0_0_20px_rgba(255,153,0,0.4)] animate-pulse pointer-events-none"></div>

                    {/* 🔻 [수정] 실제 내용물 레이어 (배경색만 담당, 깜빡임 없음) */}
                    <div className="relative bg-black/40 p-6 rounded-[32px] flex flex-col items-center">
                        {/* 텍스트 질문 */}
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-1">
                            Continue?
                        </h3>
                        {/* 남은 횟수 표기 */}
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-4">
                            Attempts Left: <span className="text-[#FF9900]">{continueCount}</span>/3
                        </p>

                        {/* 이어하기 버튼 2개 (마우스 오버/클릭 시 주황색 테두리 추가) */}
                        <div className="grid grid-cols-2 gap-3 w-full">
                            {/* 옵션 1: 코인 사용 */}
                            <button 
                                onClick={onContinue}
                                disabled={userCoins < continueCost}
                                className={`h-10 rounded-2xl flex items-center justify-center gap-2 transition-all border text-sm font-black uppercase
                                ${userCoins >= continueCost 
                                    ? 'bg-zinc-800 border-zinc-700 text-white  hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95' 
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
                                }`}
                            >
                                <img src="/images/coin.png" alt="coin" className="w-4 h-4" />
                                <span>-{continueCost}</span>
                            </button>

                            {/* 옵션 2: 광고 시청 */}
                            <button 
                                onClick={onWatchAd}
                                /* 🔻 [수정] hover:border-[#FF9900] 및 active:border-[#FF9900] 추가 */
                                className="flex-1 h-10 rounded-2xl font-bold text-[12px] uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-700 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                            >
                                WATCH AD
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* 횟수 다 씀 */
                <div className="w-full h-12 flex items-center justify-center bg-zinc-800/50 rounded-2xl text-zinc-500 font-bold text-xs uppercase mb-6 border border-zinc-800">
                    No Continues Left
                </div>
            )}

            {/* 하단 공통 버튼 (Retry / Main) */}
            <div className="w-full grid grid-cols-2 gap-3">
                {/* Retry 버튼 */}
                <button 
                    onClick={onRetry} 
                    className="flex-1 h-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-700 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                >
                    Retry
                </button>

                {/*  Main 버튼 */}
                <button 
                    onClick={onLobby} 
                    className="flex-1 h-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-700 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                >
                    game lobby
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}