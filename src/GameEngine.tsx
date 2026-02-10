import { useState, useEffect, useRef } from 'react';

interface GameProps {
  round: number;
  mode: string;
  initialTime: number;
  playClickSound: () => void;
  onEarnCoin: () => void;
  onRoundClear: (nextRound: number) => void;
  onGameOver: (finalRound: number, entryTime: number) => void; // entryTime 기준
  isModalOpen: boolean; 
  t: (key: string) => string; // 💉 언어 전환을 위해 필수적으로 추가된 Prop 외에는 건드리지 않음
}

export default function GameEngine({ round, mode, onGameOver, onRoundClear, playClickSound, onEarnCoin, isModalOpen, initialTime, t }: GameProps) {
  
  // 2. [State 초기값 수정]
  const [playTime, setPlayTime] = useState(initialTime);      // 💉 0 대신 initialTime
  const [entryTime, setEntryTime] = useState(initialTime);

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

    const questionNum = round + 2; 
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
  }, [round, mode]);


  // 🚨 [신규 추가] 모달 상태에 따라 타이머를 멈추거나 다시 시작하는 로직
  useEffect(() => {
    if (isModalOpen) {
      // 결과창이 뜨면 타이머를 멈춤
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // 결과창이 닫히면(이어하기 성공 시) 타이머가 없을 경우 다시 시작
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setPlayTime(prev => prev + 0.01), 10);
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isModalOpen, round]);


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
          const newSolvedIndices = [...solvedIndices, i];
          const newSatisfiedConditions = [...satisfiedConditions, result];
          setSolvedIndices(newSolvedIndices);
          setSatisfiedConditions(newSatisfiedConditions);

          if (newSatisfiedConditions.length === aiSelect.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            onRoundClear(round + 1);
          }
          foundMatch = true; 
          break;
        }
      }
      
      if (!foundMatch) { 
        if (timerRef.current) clearInterval(timerRef.current); 
        // 🔥 [수정] playTime이 아니라 entryTime(진입 시간)을 기록으로 사용
        onGameOver(round, parseFloat(entryTime.toFixed(2))); 
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
      if (questionTurn + 1 === aiSelect.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        onRoundClear(round + 1);
      } else {
        setQuestionTurn(prev => prev + 1);
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      // 🔥 [수정] entryTime(진입 시간)을 기록으로 사용
      onGameOver(round, parseFloat(entryTime.toFixed(2)));
    }
  };

  return (
    <div className="w-full max-w-[360px] flex flex-col h-[calc(100dvh-120px)] justify-start py-6 animate-in fade-in duration-500 overflow-hidden">      

      {/* 💉 flex-none으로 헤더 고정 */}
      <div className="w-full text-left mt-0 flex-none"> 
      {/* 💉 텍스트 번역 적용: ROUND */}
      <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">{t('ROUND')} {round}</h2>
      {/* 💉 텍스트 번역 적용: PLAY_TIME, SEC */}
      <p className="text-zinc-500 text-[14px] font-mono tracking-tighter mt-0">{t('PLAY_TIME')}: {playTime.toFixed(2)} {t('SEC')}</p>
      </div>


      {/* flex-1과 overflow-y-auto를 주어 이 영역만 스크롤되게 함 */}
    <div className="flex-1 overflow-y-auto my-4 custom-scrollbar pr-1 flex flex-col items-center">
      {(mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') ? (
        <div className="text-center mb-6 select-none flex-none">
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



        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {aiSelect.map((hand, i) => {
            const isSolved = mode === 'SHUFFLE MODE' ? solvedIndices.includes(i) : i < questionTurn;
            const isCurrent = i === questionTurn && !isMemoryPhase;
            const showDetails = isMemoryPhase || isSolved;
            return (
              <div key={i} className="relative flex flex-col items-center">
                {/* 💉 텍스트 번역 적용: EXPERT MODE 조건명 */}
                {isCurrent && mode === 'EXPERT MODE' && (
                  <span className="absolute -top-5 text-[9px] font-black text-[#FF9900] animate-pulse">{t(targetConditions[i])}</span>
                )}
                <div className={`w-14 h-14 rounded-2xl overflow-hidden transition-all duration-300 bg-zinc-900 ${showDetails ? (hand === 0 ? 'shadow-[0_0_12px_rgba(236,72,153,0.7)]' : hand === 1 ? 'shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 'shadow-[0_0_12px_rgba(34,197,94,0.7)]') : isCurrent ? 'border-2 border-[#FF9900] shadow-[0_0_15px_rgba(255,153,0,0.5)] scale-105' : 'shadow-none'}`}>
                  {isMemoryPhase ? <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">{isSolved && <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover opacity-40" />}</div>}
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
            className="w-full h-14 rounded-md font-bold uppercase transition-all bg-zinc-900 text-[#ffcc33] text-4xl font-black italic uppercase hover:scale-105 transition-transform animate-pulse border border-[#282828]"
          >
            {/* 💉 텍스트 번역 적용: OK_GOT_IT */}
            {t('OK_GOT_IT')}
          </button> 
        ) : (
          <div className="flex gap-4 w-full px-2">
            {['rock', 'paper', 'scissor'].map((type) => (
              <button 
                key={type} 
                onClick={() => handleSelect(type === 'rock' ? 1 : type === 'paper' ? 2 : 0)} 
                /* aspect-square는 유지하되 flex-none으로 압착 방지 */
                className={`flex-1 aspect-square rounded-3xl overflow-hidden active:scale-90 transition-all bg-zinc-900 ${type === 'rock' ? 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' : type === 'paper' ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'shadow-[0_0_15px_rgba(236,72,153,0.5)]'}`}
              >
                <img src={`/images/${type}.png`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}