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
  t: (key: string) => string; // 💉 [추가] 다국어 번역 함수 Prop
}

export default function ResultModal({ 
  isOpen, mode, round, time, earnedCoins, userCoins, isNewRecord, 
  continueCount, continueCost, onContinue, onRetry, onLobby, onShop,
  onWatchAd, t // 💉 [추가]
}: ResultModalProps) {
  if (!isOpen) return null;

  // 💉 [로직 보존] 모드 텍스트 번역 처리를 위한 키 추출
  const modeKey = mode.replace(' MODE', '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-[340px] bg-zinc-900 border-2 border-zinc-800 rounded-[40px] p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center animate-in zoom-in-95 duration-300">
        
        {/* 1. 상단 그룹: Game Over & Mode */}
        <div className="w-full text-center mb-4">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-5">
                {/* 💉 번역 적용: Game Over */}
                {t('game_over')}
            </h2>
            <p className="text-4xl -mb-5 font-black text-[#FF9900] italic uppercase tracking-tighter leading-none text-center">
                {/* 💉 번역 적용: 모드명 (기존 접미사 로직 유지) */}
                {t(modeKey)}{t('mode_suffix')}
            </p>
        </div>

        {/* 2. 중앙 그룹: ROUND */}
        <div className="relative my-8 text-center">
          <div className="text-8xl font-black text-white leading-none tracking-tighter">
            {round}
          </div>
          <div className="text-2xl font-black text-white uppercase italic tracking-widest mt-[-5px]">
            {/* 💉 번역 적용: ROUND */}
            {t('round_label')}
          </div>
          {isNewRecord && (
            <div className="absolute -top-6 -right-10 bg-[#FF9900] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-[0_0_20px_#FF9900] animate-bounce">
              {/* 💉 번역 적용: New Record! */}
              {t('new_record')}
            </div>
          )}
        </div>

        {/* 3. 하단 그룹: 데이터 (스탯 정보) */}
        <div className="w-full space-y-3 mb-6 bg-black/30 p-4 rounded-3xl border border-zinc-700">
          <div className="flex justify-between items-center px-1">
            {/* 💉 번역 적용: Clear Time */}
            <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest">{t('clear_time')}</span>
            {/* 💉 번역 적용: 시간 접미사 (s -> 초) */}
            <span className="text-white font-mono font-bold text-lg">{time.toFixed(2)}{t('time_suffix')}</span>
          </div>
          <div className="flex justify-between items-center px-1">
            {/* 💉 번역 적용: Earned */}
            <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest">{t('earned')}</span>
            <div className="flex items-center gap-1">
              <span className="text-[#FF9900] font-mono font-bold text-lg">+{earnedCoins}</span>
              <img src="/images/coin.png" alt="coin" className="w-4 h-4 object-contain" />
            </div>
          </div>
        </div>

        {/* 4. 최하단: 이어하기 & 버튼 그룹 */}
        <div className="w-full flex flex-col items-center">
            
            {/* 이어하기 섹션 */}
            {continueCount > 0 ? (
                <div className="w-full relative mb-6 group">
                    <div className="absolute inset-0 rounded-[32px] border-2 border-[#FF9900] shadow-[0_0_20px_rgba(255,153,0,0.4)] animate-pulse pointer-events-none"></div>

                    <div className="relative bg-black/40 p-6 rounded-[32px] flex flex-col items-center">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-1">
                            {/* 💉 번역 적용: Continue? */}
                            {t('continue_question')}
                        </h3>
                        <p className="text-sm text-zinc-500 font-bold uppercase mb-4">
                            {/* 💉 번역 적용: Attempts Left: */}
                            {t('attempts_left')} <span className="text-[#FF9900]">{continueCount}</span>/3
                        </p>

                        <div className="grid grid-cols-2 gap-3 w-full">
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

                            <button 
                                onClick={onWatchAd}
                                className="flex-1 h-10 rounded-2xl font-bold text-[12px] uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-700 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                            >
                                {/* 💉 번역 적용: WATCH AD */}
                                {t('watch_ad')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full h-12 flex items-center justify-center bg-zinc-800/50 rounded-2xl text-zinc-500 font-bold text-xs uppercase mb-6 border border-zinc-800">
                    {/* 💉 번역 적용: No Continues Left */}
                    {t('no_continues')}
                </div>
            )}

            <div className="w-full grid grid-cols-2 gap-3">
                <button 
                    onClick={onRetry} 
                    className="flex-1 h-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-700 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                >
                    {/* 💉 번역 적용: Retry */}
                    {t('retry')}
                </button>

                <button 
                    onClick={onLobby} 
                    className="flex-1 h-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-700 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                >
                    {/* 💉 번역 적용: game lobby */}
                    {t('game_lobby')}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}