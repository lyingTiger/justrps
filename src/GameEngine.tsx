import { useState, useEffect, useRef } from 'react';

interface GameProps {
  round: number;
  mode: string;
  playClickSound: () => void;
  onEarnCoin: () => void;
  onRoundClear: (nextRound: number) => void;
  // 🔥 entryTime: 해당 라운드에 진입했을 때의 시간
  onGameOver: (finalRound: number, entryTime: number) => void; 
  isModalOpen: boolean; 
}

export default function GameEngine({ round, mode, onGameOver, onRoundClear, playClickSound, onEarnCoin }: GameProps) {
  // 화면 표시용 전체 시간
  const [playTime, setPlayTime] = useState(0);      
  // 🔥 [핵심] 기록용: 이번 라운드 진입 시간
  const [entryTime, setEntryTime] = useState(0);

  const [aiSelect, setAiSelect] = useState<number[]>([]); 
  const [targetConditions, setTargetConditions] = useState<string[]>([]); 
  const [questionTurn, setQuestionTurn] = useState(0);    
  const [solvedIndices, setSolvedIndices] = useState<number[]>([]); 
  const [satisfiedConditions, setSatisfiedConditions] = useState<string[]>([]); 
  const [isMemoryPhase, setIsMemoryPhase] = useState(true); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. 라운드 진입 시점의 시간을 스냅샷 찍음
    if (round === 1) {
      setPlayTime(0);
      setEntryTime(0);
    } else {
      // 2라운드부터는 현재까지 흐른 시간이 진입 시간
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
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setPlayTime(prev => prev + 0.01), 10);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, mode]); 

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
      
      // 틀렸을 때: 진입 시간(entryTime)을 기록으로 넘김
      if (!foundMatch) { 
        if (timerRef.current) clearInterval(timerRef.current); 
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
      // 틀렸을 때: 진입 시간(entryTime)을 기록으로 넘김
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver(round, parseFloat(entryTime.toFixed(2)));
    }
  };

  return (
    <div className="w-full max-w-[320px] flex flex-col min-h-[550px] justify-start py-6 animate-in fade-in duration-500">
      <div className="w-full text-left mt-0">
        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Round {round}</h2>
        {/* 화면에는 긴장감을 위해 계속 흐르는 시간 표시 */}
        <p className="text-zinc-500 text-[14px] font-mono tracking-tighter mt-0">Play Time: {playTime.toFixed(2)} sec</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {(mode === 'SHUFFLE MODE' || mode === 'EXPERT MODE') ? (
          <div className="text-center mb-10 select-none">
            <div className="flex justify-center gap-3 text-2xl font-black text-[#FF9900] uppercase italic tracking-tighter">
              <span>{totalTargetCounts.WIN} WIN</span><span>{totalTargetCounts.DRAW} DRAW</span><span>{totalTargetCounts.LOSE} LOSE</span>
            </div>
            <div className="flex justify-center gap-4 text-xl font-bold text-white opacity-80 uppercase tracking-tight mt-1">
              <span>{currentSolvedCounts.WIN} WIN</span><span>{currentSolvedCounts.DRAW} DRAW</span><span>{currentSolvedCounts.LOSE} LOSE</span>
            </div>
          </div>
        ) : (
          <div className="text-center mb-10">
            <p className="text-[#FF9900] text-6xl font-black tracking-tighter uppercase leading-none">{aiSelect.length} {mode.split(' ')[0]}</p>
            <p className="text-white text-2xl font-bold opacity-80 uppercase tracking-tight mt-1">{questionTurn} {mode.split(' ')[0]}</p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {aiSelect.map((hand, i) => {
            const isSolved = mode === 'SHUFFLE MODE' ? solvedIndices.includes(i) : i < questionTurn;
            const isCurrent = i === questionTurn && !isMemoryPhase;
            const showDetails = isMemoryPhase || isSolved;
            return (
              <div key={i} className="relative flex flex-col items-center">
                {isCurrent && mode === 'EXPERT MODE' && (
                  <span className="absolute -top-5 text-[9px] font-black text-[#FF9900] animate-pulse">{targetConditions[i]}</span>
                )}
                <div className={`w-14 h-14 rounded-2xl overflow-hidden transition-all duration-300 bg-zinc-900 ${showDetails ? (hand === 0 ? 'shadow-[0_0_12px_rgba(236,72,153,0.7)]' : hand === 1 ? 'shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 'shadow-[0_0_12px_rgba(34,197,94,0.7)]') : isCurrent ? 'border-2 border-[#FF9900] shadow-[0_0_15px_rgba(255,153,0,0.5)] scale-105' : 'shadow-none'}`}>
                  {isMemoryPhase ? <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">{isSolved && <img src={`/images/${['scissor', 'rock', 'paper'][hand]}.png`} className="w-full h-full object-cover opacity-40" />}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full flex justify-center mt-auto">
        {isMemoryPhase ? <button onClick={() => { playClickSound(); setIsMemoryPhase(false); }} className="text-[#FF9900] text-3xl font-black italic uppercase hover:scale-105 transition-transform animate-pulse">OK, I got it</button> : (
          <div className="flex gap-4 w-full px-2">
            {['rock', 'paper', 'scissor'].map((type) => (
              <button key={type} onClick={() => handleSelect(type === 'rock' ? 1 : type === 'paper' ? 2 : 0)} className={`flex-1 aspect-square rounded-3xl overflow-hidden active:scale-90 transition-all bg-zinc-900 ${type === 'rock' ? 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' : type === 'paper' ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'shadow-[0_0_15px_rgba(236,72,153,0.5)]'}`}><img src={`/images/${type}.png`} className="w-full h-full object-cover" /></button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}