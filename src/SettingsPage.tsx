import React from 'react';

// 인터페이스 이름을 일치시키고 반환 형식을 유연하게 설정합니다.
interface SettingsPageProps {
  userNickname: string;
  setUserNickname: (name: string) => void;
  onSaveNickname: (newNickname: string) => void | Promise<void>; 
  volume: number;
  setVolume: (v: number) => void;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  onBack: () => void;
}

export default function SettingsPage({ 
  userNickname, 
  setUserNickname, 
  onSaveNickname, 
  volume, 
  setVolume, 
  isMuted, 
  setIsMuted, 
  onBack 
}: SettingsPageProps) {
  return (
    <div className="w-full max-w-[320px] flex flex-col items-center mt-12 px-4 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black italic text-[#FF9900] uppercase mb-10 tracking-tighter">Settings</h2>
      
      <div className="w-full space-y-8 bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800">
        {/* 닉네임 수정 섹션 */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">Profile Nickname</p>
          <input 
            type="text" 
            value={userNickname} 
            onChange={(e) => setUserNickname(e.target.value)}
            className="w-full h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-sm text-white outline-none focus:border-[#FF9900] transition-colors font-bold"
          />
          <button 
            onClick={() => onSaveNickname(userNickname)}
            className="w-full h-12 bg-[#FF9900] text-black font-black uppercase rounded-2xl text-xs active:scale-95 transition-all shadow-lg"
          >
            Save Changes
          </button>
        </div>

        {/* 볼륨 조절 섹션 */}
        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
          <div className="flex justify-between items-center px-1">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Master Volume</p>
            <span className="text-[10px] font-mono text-[#FF9900] font-bold">{Math.round(volume * 100)}%</span>
          </div>
          <input 
            type="range" min="0" max="1" step="0.01" 
            value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FF9900]"
          />
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-full h-12 border-2 font-black uppercase rounded-2xl text-[10px] transition-all
              ${isMuted ? 'border-red-900/50 text-red-500 bg-red-500/5' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
          >
            {isMuted ? 'Sound Muted' : 'Sound Active'}
          </button>
        </div>
      </div>

      <button onClick={onBack} className="mt-10 text-[10px] text-zinc-600 font-bold uppercase underline tracking-widest hover:text-[#FF9900] transition-colors">
        Back to Lobby
      </button>
    </div>
  );
}