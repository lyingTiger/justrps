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
  playClickSound: () => void;
  currentLang: 'en' | 'ko';
  onLangChange: (lang: 'en' | 'ko') => void;
  t: (key: any) => string;
}

export default function SettingsPage({ 
  userNickname, 
  setUserNickname, 
  onSaveNickname, 
  volume, 
  setVolume, 
  isMuted, 
  setIsMuted, 
  onBack,
  playClickSound, 
  currentLang, onLangChange, t
}: SettingsPageProps) {
  return (
    <div className="w-full max-w-[360px] flex flex-col items-center mt-4 px-4 animate-in fade-in duration-500">

      <div className="w-full flex justify-end mb-0">
         <button onClick={onBack} className="px-4 py-1 bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700">Back</button>
      </div>


      {/* 언어 설정 섹션 */}
      <div className="w-full mb-8">
        <p className="text-[10px] text-zinc-500 font-black uppercase mb-3 tracking-widest">{t('language')}</p>
        <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
          <button 
            onClick={() => { onLangChange('en'); playClickSound(); }}
            className={`flex-1 h-10 rounded-xl font-black text-xs transition-all ${currentLang === 'en' ? 'bg-[#FF9900] text-black' : 'text-zinc-500 hover:text-white'}`}
          >
            ENGLISH
          </button>
          <button 
            onClick={() => { onLangChange('ko'); playClickSound(); }}
            className={`flex-1 h-10 rounded-xl font-black text-xs transition-all ${currentLang === 'ko' ? 'bg-[#FF9900] text-black' : 'text-zinc-500 hover:text-white'}`}
          >
            한국어
          </button>
        </div>
      </div>

 
      <div className="w-full space-y-6 py-6 px-0 rounded-[32px] ">
        {/* 닉네임 수정 섹션 */}
        <div className="space-y-3">
            <p className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">{t('profile_nickname') || 'Profile Nickname'}</p>          <input 
            type="text" 
            value={userNickname} 
            onChange={(e) => setUserNickname(e.target.value)}
            maxLength={15}
            className="w-full h-12 bg-black border border-zinc-800 rounded-2xl px-4 text-sm text-white outline-none focus:border-[#FF9900] transition-colors font-bold"
          />
          <button 
            onClick={() => onSaveNickname(userNickname)}
            className="w-full h-12 rounded-md font-bold text-lg uppercase tracking-widest transition-all bg-zinc-900 text-white border border-zinc-800 hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900] hover:shadow-[0_0_15px_rgba(255,153,0,0.5)] active:bg-[#FF9900] active:text-black active:border-[#FF9900] active:scale-95"          >
            {t('save_changes') || 'Save Changes'}
          </button>
        </div>

        {/* 볼륨 조절 섹션 */}
        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
          <div className="flex justify-between items-center px-1">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('master_volume') || 'Master Volume'}</p>            
            <span className="text-[10px] font-mono text-[#FF9900] font-bold">{Math.round(volume * 100)}%</span>
          </div>
          <input 
            type="range" min="0" max="1" step="0.01" 
            value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FF9900]"
          />
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-full h-12 border-2 font-black uppercase rounded-2xl text-lg transition-all
            ${isMuted ? 'border-red-900/50 text-red-500 bg-red-500/5' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              {isMuted ? (t('sound_muted') || 'Sound Muted') : (t('sound_active') || 'Sound Active')}
          </button>
        </div>
      </div>
    </div>
  );
}