import { useState } from 'react';
import { supabase } from './supabaseClient';

interface SettingsProps {
  userNickname: string;
  setUserNickname: (val: string) => void;
  volume: number;
  setVolume: (val: number) => void;
  isMuted: boolean;
  setIsMuted: (val: boolean) => void;
  onBack: () => void;
}

export default function SettingsPage({ 
  userNickname, setUserNickname, volume, setVolume, isMuted, setIsMuted, onBack 
}: SettingsProps) {
  const [newNickname, setNewNickname] = useState(userNickname);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateNickname = async () => {
    if (!newNickname.trim()) return;
    setIsUpdating(true);
    
    const { error } = await supabase.auth.updateUser({
      data: { display_name: newNickname }
    });

    if (error) {
      alert("변경 실패: " + error.message);
    } else {
      setUserNickname(newNickname);
      alert("닉네임이 성공적으로 변경되었습니다.");
    }
    setIsUpdating(false);
  };

  return (
    <div className="w-full max-w-[320px] mt-16 flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Settings</h2>
        <button onClick={onBack} className="text-xs text-zinc-500 underline hover:text-white transition-colors">BACK</button>
      </div>

      {/* 닉네임 변경 섹션 */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-bold text-[#FF9900] uppercase tracking-widest">User Profile</h3>
        <div className="space-y-2">
          <input 
            type="text" 
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-white focus:border-[#FF9900] outline-none font-bold"
            placeholder="New Nickname"
          />
          <button 
            onClick={handleUpdateNickname}
            disabled={isUpdating || newNickname === userNickname}
            className="w-full h-10 bg-zinc-800 text-white rounded-lg text-xs font-bold uppercase hover:bg-zinc-700 disabled:opacity-50 transition-all"
          >
            {isUpdating ? 'Updating...' : 'Update Nickname'}
          </button>
        </div>
      </section>

      {/* 사운드 설정 섹션 */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h3 className="text-[10px] font-bold text-[#FF9900] uppercase tracking-widest">Audio Control</h3>
          <span className="text-xl font-mono font-bold text-white">{isMuted ? '0' : Math.round(volume * 100)}%</span>
        </div>
        
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 space-y-6">
          <div className="flex flex-col gap-4">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FF9900]"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 font-bold uppercase">
              <span>Silent</span>
              <span>Max Volume</span>
            </div>
          </div>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-full h-10 rounded-lg text-xs font-bold uppercase transition-all border ${
              isMuted 
              ? 'bg-[#FF9900] text-black border-[#FF9900]' 
              : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            {isMuted ? 'Unmute' : 'Mute All Sound'}
          </button>
        </div>
      </section>

      <p className="text-[10px] text-zinc-700 text-center uppercase tracking-widest mt-10">
        just RPS Version 1.0.0
      </p>
    </div>
  );
}