import React from 'react';

interface ResultModalProps {
  isOpen: boolean;
  mode: string;
  round: number;
  time: number;
  earnedCoins: number;
  userCoins: number;
  sessionItems: { stop: number; switch: number; color: number; heal: number };
  isNewRecord: boolean;
  continueCount: number;
  continueCost: number;
  onContinue: () => void;
  onRetry: () => void;
  onLobby: () => void;
  onShop: () => void;
  onWatchAd: () => void;
  t: (key: string) => string; // 💉 [추가] 다국어 번역 함수 Prop
  playClickSound: () => void; 
  onSaveRewards: () => Promise<void>;
}

export default function ResultModal({ 
  isOpen, mode, round, time, earnedCoins, sessionItems, userCoins, isNewRecord, 
  continueCount, continueCost, onContinue, onRetry, onLobby, onShop,
  onWatchAd, t,playClickSound,
  onSaveRewards
}: ResultModalProps) {
  // 💉 획득한 아이템이 있는지 확인하는 헬퍼
  const hasItems = Object.values(sessionItems).some(count => count > 0);

  if (!isOpen) return null;

  // 💉 [로직 보존] 모드 텍스트 번역 처리를 위한 키 추출
  const modeKey = mode.replace(' MODE', '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-[340px] bg-zinc-900 border-2 border-zinc-800 rounded-[40px] p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center animate-in zoom-in-95 duration-300">
        
        {/* 1. 상단 그룹: Game Over & Mode */}
        <div className="w-full text-center mb-0">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">
                {t('game_over')}
            </h2>
            <p className="text-4xl -mb-2 font-black text-[#FF9900] italic uppercase tracking-tighter leading-none text-center">
                {t(modeKey)}{t('mode_suffix')}
            </p>
        </div>

        {/* 💉 2 & 3 통합 그룹: ROUND(L) + DATA STACK(R) */}
        <div className="w-full flex justify-between items-center mt-8 mb-0 px-1 relative"> 
        {/* 기존에는 my-8 이었으나, mb(margin-bottom) 값을 줄여서 아래 아이템 영역과 붙입니다. */}
          
          {/* [L] 라운드 숫자와 'R' 표시 */}
          <div className="flex items-baseline gap-1">
            <span className="text-8xl font-black text-white leading-none tracking-tighter">
              {round}
            </span>
            <span className="text-4xl font-black text-white italic uppercase tracking-tighter">
              R
            </span>
          </div>

          {/* [R] 3줄 데이터 스택 (위아래 정렬) */}
          <div className="flex flex-col items-end gap-1">
            {/* 1열: 진입 시간 라벨 */}
            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-none">
              {/* 💉 '클리어 타임' 대신 '진입 시간' (번역 키가 없다면 직접 텍스트로 표시 가능) */}
              {t('entry_time') || "진입 시간"}
            </span>
            {/* 2열: 시간 기록 */}
            <span className="text-white font-mono font-bold text-2xl leading-none">
              {time.toFixed(2)}{t('time_suffix')}
            </span>
            {/* 3열: 획득 코인 (기존 스타일 유지) */}
            <div className="flex items-center gap-1.5 mt-1">
              <img src="/images/coin.png" className="w-5 h-5 object-contain" alt="coin" />
              <span className="text-2xl font-black text-white italic leading-none">
                +{earnedCoins}
              </span>
            </div>
          </div>

          {/* 신기록 배지 (위치 조정) */}
          {isNewRecord && (
            <div className="absolute -top-6 left-0 bg-[#FF9900] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-[0_0_20px_#FF9900] animate-bounce">
              {t('new_record')}
            </div>
          )}
        </div>

        {/* 4. 아이템 영역: 기존 위치 유지하되 내부 여백 조절 */}
        {hasItems && (
          <div className="w-full mb-3  p-5">
            <div className="flex justify-center gap-4">
              {sessionItems.stop > 0 && (
                <div className="relative">
                  <img src="/images/itemStop3sec.png" className="w-10 h-10 object-contain" alt="stop" />
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {sessionItems.stop}
                  </span>
                </div>
              )}
              {sessionItems.switch > 0 && (
                <div className="relative">
                  <img src="/images/itemSwitchBtn.png" className="w-10 h-10 object-contain" alt="switch" />
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {sessionItems.switch}
                  </span>
                </div>
              )}
              {sessionItems.color > 0 && (
                <div className="relative">
                  <img src="/images/itemColor.png" className="w-10 h-10 object-contain" alt="color" />
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {sessionItems.color}
                  </span>
                </div>
              )}
              {sessionItems.heal > 0 && (
                <div className="relative">
                  <img src="/images/itemHeal.png" className="w-10 h-10 object-contain" alt="heal" />
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {sessionItems.heal}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. 최하단: 이어하기 & 버튼 그룹 (기존 유지) */}
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
                    onClick={async () => {
                      playClickSound();
                      await onSaveRewards(); // 💉 App.tsx에서 전달받은 saveSessionRewards 실행
                      onRetry(); 
                    }}
                    className="flex-1 h-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all bg-zinc-800 text-white border border-zinc-700 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"
                >
                    {/* 💉 번역 적용: Retry */}
                    {t('retry')}
                </button>

                <button 
                    onClick={async () => {
                      playClickSound();
                      await onSaveRewards(); // 💉 로비로 갈 때도 저장
                      onLobby(); 
                    }}
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