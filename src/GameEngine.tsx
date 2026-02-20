import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface GameProps {
  round: number;
  mode: string;
  initialTime: number;
  sessionCoins: number;
  playClickSound: () => void;
  playTockSound: () => void;   
  playWhickSound: () => void;  
  playBeepSound: () => void;   
  onEarnCoin: () => void;
  onRoundClear: (nextRound: number) => void;
  onGameOver: (finalRound: number, entryTime: number) => void; // entryTime 기준
  isModalOpen: boolean; 
  onBackToLobby: () => void;
  t: (key: string) => string;
  configs: any;
}

export default function GameEngine({ 
  round, mode, onGameOver, onRoundClear, playClickSound, 
  playTockSound, playWhickSound, playBeepSound, // 💉 Destructuring 추가
  onEarnCoin, isModalOpen, initialTime, t,
  onBackToLobby, sessionCoins,
  configs,
}: GameProps) {
  
  // 2. [State 초기값 수정]
  const [playTime, setPlayTime] = useState(initialTime);      // 💉 0 대신 initialTime
  const [entryTime, setEntryTime] = useState(initialTime);

  // 💉 [상태 추가] 저장 모달 및 기존 데이터 보관용
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [existingSave, setExistingSave] = useState<any>(null);

  const [aiSelect, setAiSelect] = useState<number[]>([]); 
  const [targetConditions, setTargetConditions] = useState<string[]>([]); 
  const [questionTurn, setQuestionTurn] = useState(0);    
  const [solvedIndices, setSolvedIndices] = useState<number[]>([]); 
  const [satisfiedConditions, setSatisfiedConditions] = useState<string[]>([]); 
  const [isMemoryPhase, setIsMemoryPhase] = useState(true); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1라운드는 0초 시작, 그 외에는 현재까지 흐른 시간이 진입 시간
    if (round === 1) {
      setPlayTime(0);
      setEntryTime(0);
    } else {
      setEntryTime(playTime);
    }

    const questionNum = round + configs.game_difficulty_offset; 
    const newAiSelect = Array.from({ length: questionNum }, () => Math.floor(Math.random() * 3));
    setAiSelect(newAiSelect);

    if (mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') {
      const conditions = ['WIN', 'DRAW', 'LOSE'];
      const newConditions = Array.from({ length: questionNum }, () => conditions[Math.floor(Math.random() * 3)]);
      setTargetConditions(newConditions);
    } else {
      setTargetConditions(Array(questionNum).fill(mode.split(' ')[0]));
    }

    setQuestionTurn(0);
    setSolvedIndices([]);
    setSatisfiedConditions([]);
    setIsMemoryPhase(true); 
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [round, mode, configs.game_difficulty_offset]);


  // 🚨 [신규 추가] 모달 상태에 따라 타이머를 멈추거나 다시 시작하는 로직
  useEffect(() => {
    // 💉 결과창(isModalOpen)이나 세이브창(isSaveModalOpen) 중 하나라도 열리면 멈춤
    const shouldStop = isModalOpen || isSaveModalOpen;

    if (shouldStop) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // 💉 모든 창이 닫혀 있을 때만 타이머가 '하나'만 돌아가도록 보장
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setPlayTime(prev => prev + (configs.game_timer_step || 0.01));
        }, configs.game_timer_interval || 10);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // 💉 의존성 배열에 isSaveModalOpen을 반드시 추가!
  }, [isModalOpen, isSaveModalOpen, round, configs.game_timer_step, configs.game_timer_interval]);



  // 💉 [함수 추가] 저장 버튼 클릭 시 기존 데이터를 불러오고 모달을 엽니다.
  const handleSaveClick = async () => {
    playClickSound();
    
    // 타이머 일시정지 (선택 사항: 안내창 띄울 때 흐르지 않게 함)
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 기존 저장 데이터 가져오기 (테이블명은 'game_saves'로 가정)
      const { data } = await supabase
        .from('game_saves')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setExistingSave(data);
      setIsSaveModalOpen(true);
    } catch (e) {
      console.error("Save fetch error:", e);
    }
  };

  // 💉 [함수 추가] 최종 저장 실행 (덮어쓰기)
  const executeSave = async () => {
    playClickSound();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('game_saves').upsert({
      user_id: user.id,
      mode: mode,
      round: round,
      entry_time: entryTime,
      updated_at: new Date().toISOString()
    });

    // 💉 새로운 저장이 발생했으므로 '이어하기 비용' 카운트를 0으로 리셋합니다.
    // 이렇게 해야 다음번에 로비에서 불러올 때 다시 '무료'부터 시작합니다.
    await supabase
      .from('profiles')
      .update({ load_count: 0 })
      .eq('id', user.id);

    setIsSaveModalOpen(false);
    // 타이머 재개
    // timerRef.current = setInterval(() => setPlayTime(prev => prev + 0.01), 10);
  };


  const getCounts = (list: string[]) => {
    const counts = { WIN: 0, DRAW: 0, LOSE: 0 };
    list.forEach(c => { if (c in counts) counts[c as keyof typeof counts]++; });
    return counts;
  };

  const totalTargetCounts = getCounts(targetConditions);
  const currentSolvedCounts = mode === 'SHUFFLE MODE' ? getCounts(satisfiedConditions) : getCounts(targetConditions.slice(0, questionTurn));

  const handleSelect = (idx: number) => {
    playClickSound();
    
    // [1] 셔플 모드
    if (mode === 'SHUFFLE MODE') {
      let foundMatch = false;
      for (let i = 0; i < aiSelect.length; i++) {
        if (solvedIndices.includes(i)) continue;
        const hand = aiSelect[i];
        const result = idx === hand ? 'DRAW' : ((hand === 0 && idx === 1) || (hand === 1 && idx === 2) || (hand === 2 && idx === 0) ? 'WIN' : 'LOSE');
        
        const needed = totalTargetCounts[result as keyof typeof totalTargetCounts];
        const current = satisfiedConditions.filter(c => c === result).length;

        if (needed > current) {
          onEarnCoin();
          playTockSound(); // 💉 정답 효과음 재생
          const newSolvedIndices = [...solvedIndices, i];
          const newSatisfiedConditions = [...satisfiedConditions, result];
          setSolvedIndices(newSolvedIndices);
          setSatisfiedConditions(newSatisfiedConditions);

          if (newSatisfiedConditions.length === aiSelect.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            // 💉 (App.tsx에서 넘겨받은 onRoundClear가 whickSound를 포함하고 있음)
            onRoundClear(round + 1);
          }
          foundMatch = true; 
          break;
        }
      }
      
      if (!foundMatch) { 
        if (timerRef.current) clearInterval(timerRef.current); 
        onGameOver(round, parseFloat(entryTime.toFixed(2))); // 💉 (App.tsx에서 beepSound 처리)
      }
      return;
    }

    // [2] 일반/익스퍼트 모드
    const aiHand = aiSelect[questionTurn];
    const condition = targetConditions[questionTurn];
    let isCorrect = false;
    
    if (condition === 'DRAW') isCorrect = idx === aiHand;
    else if (condition === 'WIN') isCorrect = (aiHand === 0 && idx === 1) || (aiHand === 1 && idx === 2) || (aiHand === 2 && idx === 0);
    else if (condition === 'LOSE') isCorrect = (aiHand === 0 && idx === 2) || (aiHand === 1 && idx === 0) || (aiHand === 2 && idx === 1);

    if (isCorrect) {
      onEarnCoin();
      playTockSound(); // 💉 정답 효과음 재생
      if (questionTurn + 1 === aiSelect.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        onRoundClear(round + 1);
      } else {
        setQuestionTurn(prev => prev + 1);
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver(round, parseFloat(entryTime.toFixed(2)));
    }
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col h-[100dvh] justify-start pt-6 pb-10 animate-in fade-in duration-500 overflow-hidden mx-auto">    

      {/* 1. 헤더 영역 (로고 및 라운드 정보) - 고정 높이 */}
      <div className="w-full flex justify-between items-start mt-0 flex-none mb-4 px-4">
        
        {/* [좌측] 로고 및 획득 코인 표시 */}
        <div className="flex flex-col items-start">
          <button onClick={() => { playClickSound(); onBackToLobby(); }} className="active:scale-95 transition-transform">
            <h2 className="text-3xl font-bold tracking-tighter uppercase italic leading-none">
              <span className="text-[#FF9900]">just</span> <span className="text-[#0099CC]">R</span><span className="text-[#66CC00]">P</span><span className="text-[#FF0066]">S</span>
            </h2>
          </button>

          {/* 💉 [추가] 로고 아래 획득 코인 애니메이션 UI */}
          <div className="flex items-center gap-1.5 mt-2 ml-1 animate-bounce-subtle">
            <img src="/images/coin.png" alt="earned coin" className="w-4 h-4 object-contain" />
            <span className="text-white font-black text-sm font-mono">+{sessionCoins}</span>
          </div>
        </div>

        {/* [우측] 라운드 및 시간 (상단 정렬) */}
        <div className="text-right flex flex-col items-end pt-0">
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">{t('ROUND')} {round}</h2>
          <p className="text-zinc-500 text-[14px] font-mono tracking-tighter mt-2 leading-none">
            {playTime.toFixed(2)} {t('SEC')}
          </p>

          {/* 💉 저장 버튼 추가 */}
          <button 
            onClick={handleSaveClick}
            className="mt-3 px-3 py-1 bg-zinc-800/50 border border-zinc-700 rounded-lg text-[10px] font-black text-[#FF9900] uppercase tracking-widest hover:bg-[#FF9900] hover:text-black transition-all active:scale-90"
          >
            {t('SAVE_GAME') || 'SAVE'}
          </button>
        </div>
      </div>


      {/* 2. 💉 [수정] 문제 영역: flex-1을 주어 버튼 위쪽까지 공간을 모두 확장 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col items-center justify-center min-h-0">
        {/* justify-center를 추가하여 문제가 적을 때는 중앙에, 많을 때는 위에서부터 스크롤되게 함 */}

        {(mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') ? (
        <div className="text-center mb-8 flex-none">
          <div className="flex justify-center gap-3 text-2xl font-black text-[#FF9900] uppercase italic tracking-tighter">
            {/* 💉 텍스트 번역 적용: WIN, DRAW, LOSE */}
            <span>{totalTargetCounts.WIN} {t('WIN')}</span><span>{totalTargetCounts.DRAW} {t('DRAW')}</span><span>{totalTargetCounts.LOSE} {t('LOSE')}</span>
          </div>
          
            <div className="flex justify-center gap-4 text-xl font-bold text-white opacity-80 uppercase tracking-tight mt-1">
              {/* 💉 텍스트 번역 적용: WIN, DRAW, LOSE */}
              <span>{currentSolvedCounts.WIN} {t('WIN')}</span><span>{currentSolvedCounts.DRAW} {t('DRAW')}</span><span>{currentSolvedCounts.LOSE} {t('LOSE')}</span>
            </div>
          </div>
        ) : (
          <div className="text-center mb-10">
            {/* 💉 텍스트 번역 적용: 모드명 (기존 로직 보존) */}
            <p className="text-[#FF9900] text-6xl font-black tracking-tighter uppercase leading-none">{aiSelect.length} {t(mode.split(' ')[0])}</p>
            <p className="text-white text-2xl font-bold opacity-80 uppercase tracking-tight mt-1">{questionTurn} {t(mode.split(' ')[0])}</p>
          </div>
        )}


        {/* 문제 아이콘 리스트 - 이제 flex-1 내부에서 더 넓은 공간을 가짐 */}
        <div className="flex flex-wrap justify-center gap-3 mb-10 w-full px-4">
          {aiSelect.map((hand, i) => { // 💉 [수정] '('를 '{'로 변경 (변수 선언을 위해)
            const isSolved = mode === 'SHUFFLE MODE' ? solvedIndices.includes(i) : i < questionTurn;
            const isCurrent = i === questionTurn && !isMemoryPhase;
            const showDetails = isMemoryPhase || isSolved;

          return ( // 💉 명시적 return 필요
            <div key={i} className="relative flex flex-col items-center">

              {/* 💉 EXPERT MODE 조건명 */}
              {isCurrent && mode === 'EXPERT MODE' && (
                <span className="absolute -top-7 text-[16px] font-black text-white ">
                  {t(targetConditions[i])}
                </span>
              )}

              {/* 💉 문제 아이콘 컨테이너 */}
              <div className={`w-14 h-14 rounded-2xl transition-all duration-300 bg-zinc-900 ${
                showDetails ? (
                  hand === 0 ? 'shadow-[0_0_12px_rgba(236,72,153,0.7)]' : 
                  hand === 1 ? 'shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 
                  'shadow-[0_0_12px_rgba(34,197,94,0.7)]'
                ) : isCurrent ? 'border-2 border-[#FF9900] shadow-[0_0_15px_rgba(255,153,0,0.5)] scale-105' : 'shadow-none'
              }`}>

                {/* 💉 이미지 출력 로직 */}
                {isMemoryPhase ? (
                  <img 
                    src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {isSolved && (
                      <img 
                        src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} 
                        className="w-full h-full object-cover opacity-100" // 💉 유저 요청대로 opacity-100 적용
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
          })} 
        </div>
      </div>



      {/* 하단 버튼 영역 */}
      <div className="w-full flex justify-center mt-auto flex-none pb-4">
      {isMemoryPhase ? (
        <button 
          onClick={() => { playClickSound(); setIsMemoryPhase(false); }} 
          className="w-full h-14 font-bold uppercase transition-all text-[#ffcc33] text-4xl font-black italic uppercase hover:scale-105 transition-transform animate-pulse active:scale-95"
        >
          {t('OK_GOT_IT')}
        </button> 
      ) : (
        /* 💉 w-full을 w-[60%]로 변경하여 너비를 제한하고, gap을 2로 줄여 오밀조밀하게 배치 */
        <div className="flex gap-2 w-[60%]"> 
          {['rock', 'paper', 'scissor'].map((type) => (
            <button 
              key={type} 
              onClick={() => handleSelect(type === 'rock' ? 1 : type === 'paper' ? 2 : 0)} 
              /* flex-1이 설정되어 있어 60% 너비 안에서 3등분으로 자동 배분됩니다 */
              className={`flex-1 aspect-square rounded-2xl  active:scale-90 transition-all bg-zinc-900 ${
                type === 'rock' ? 'shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 
                type === 'paper' ? 'shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 
                'shadow-[0_0_10px_rgba(236,72,153,0.4)]'
              }`}
            >
              <img src={`/images/${type}.png`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      </div>


      {/* 💉 [신규] 전용 저장 안내창 (Overwrite Modal) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full max-w-[320px] bg-zinc-900 border-2 border-[#FF9900] rounded-[40px] p-8 flex flex-col items-center shadow-[0_0_60px_rgba(255,153,0,0.3)]">
            
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-8">{t('SAVE_PROGRESS') || 'SAVE PROGRESS'}</h3>

            <div className="w-full space-y-6 mb-10">
              {/* 기존 데이터 */}
              <div className="opacity-80">
                <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">● {t('EXISTING_DATA') || 'EXISTING DATA'}</p>
                <div className="bg-black/40 rounded-2xl p-4 border border-zinc-800">
                  {existingSave ? (
                    <div className="text-xs font-bold text-white space-y-1">
                      <p className="flex justify-between"><span>MODE:</span> <span>{existingSave.mode}</span></p>
                      <p className="flex justify-between"><span>ROUND:</span> <span>{existingSave.round}</span></p>
                      <p className="flex justify-between"><span>TIME:</span> <span>{existingSave.entry_time.toFixed(2)}s</span></p>
                    </div>
                  ) : (
                    <p className="text-center text-[10px] text-zinc-600 italic py-2">NO SAVED DATA</p>
                  )}
                </div>
              </div>

              {/* 현재 데이터 (화살표 아이콘은 

      [Image of arrow down]
      태그 대신 텍스트로 대체 가능) */}
              <div className="flex justify-center text-[#FF9900] text-xl">▼</div>

              {/* 새 데이터 */}
              <div>
                <p className="text-[10px] font-black text-[#FF9900] uppercase tracking-widest mb-2">● {t('NEW_DATA') || 'NEW DATA'}</p>
                <div className="bg-[#FF9900]/10 rounded-2xl p-4 border border-[#FF9900]/30">
                  <div className="text-xs font-black text-white space-y-1">
                    <p className="flex justify-between"><span>MODE:</span> <span>{mode}</span></p>
                    <p className="flex justify-between"><span>ROUND:</span> <span>{round}</span></p>
                    <p className="flex justify-between"><span>TIME:</span> <span>{entryTime.toFixed(2)}s</span></p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[12px] text-[#ffcc33] font-bold mb-6 text-center whitespace-pre-line">
              {t('SAVE_DISCLAIMER')}
            </p>

            <div className="flex gap-3 w-full">
              <button 
                onClick={() => {
                  setIsSaveModalOpen(false);
                  // timerRef.current = setInterval(() => setPlayTime(prev => prev + 0.01), 10);
                }}
                className="flex-1 h-12 rounded-2xl border border-zinc-600 bg-zinc-800 hover:bg-[#FF9900] text-white hover:text-black font-black text-xs uppercase active:scale-95 transition-all"
              >
                {t('CANCEL') || 'CANCEL'}
              </button>
              <button 
                onClick={executeSave}
                className="flex-1 h-12 rounded-2xl border border-zinc-600 bg-zinc-800 hover:bg-[#FF9900] text-white hover:text-black font-black text-xs uppercase active:scale-95 transition-all"
              >
                {t('OVERWRITE') || 'OVERWRITE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}