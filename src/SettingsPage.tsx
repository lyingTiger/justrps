import React from 'react';

// 1. App.tsx에서 보내주는 데이터들의 '설계도'를 수정합니다.
interface SettingsProps {
  userNickname: string;
  setUserNickname: (val: string) => void;
  onSaveNickname: (newNickname: string) => Promise<void>; // 저장 함수 추가
  volume: number;
  setVolume: (val: number) => void;
  isMuted: boolean;
  setIsMuted: (val: boolean) => void;
  onBack: () => void;
}

export default function SettingsPage({
  userNickname,
  setUserNickname,
  onSaveNickname, // 함수 받아오기
  volume,
  setVolume,
  isMuted,
  setIsMuted,
  onBack
}: SettingsProps) {

  return (
    <div className="w-full max-w-[320px] flex flex-col items-center mt-12 space-y-8 p-4">
      {/* 뒤로가기 헤더 */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-4">
        <h3 className="text-[#FF9900] font-black text-xl italic uppercase tracking-tighter">Settings</h3>
        <button onClick={onBack} className="text-xs text-zinc-500 underline hover:text-white uppercase font-bold">Close</button>
      </div>

      {/* --- 닉네임 설정 구역 --- */}
      <div className="w-full space-y-3">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">User Nickname</p>
        <input 
          type="text" 
          value={userNickname} 
          onChange={(e) => setUserNickname(e.target.value)} 
          placeholder="Enter Nickname"
          className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none font-bold"
        />
        
        {/* [위치!] 입력창 바로 아래에 저장 버튼을 배치합니다 */}
        <button 
          onClick={() => onSaveNickname(userNickname)}
          className="w-full h-12 bg-[#FF9900] text-black font-black rounded-lg uppercase text-sm active:scale-95 transition-all shadow-lg shadow-orange-900/20"
        >
          Save Nickname
        </button>
      </div>

      {/* --- 사운드 설정 구역 --- */}
      <div className="w-full space-y-4 pt-4 border-t border-zinc-900">
        <div className="flex justify-between items-center">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Master Volume</p>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`text-[10px] font-bold px-2 py-1 rounded border ${isMuted ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
          >
            {isMuted ? 'MUTED' : 'MUTE'}
          </button>
        </div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={isMuted ? 0 : volume} 
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full accent-[#FF9900] cursor-pointer"
        />
      </div>

      <div className="pt-8 text-center">
        <p className="text-[9px] text-zinc-600 font-mono">TREASURE FACTORY © 2026</p>
      </div>
    </div>
  );
}