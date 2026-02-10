// ------------------------------------------------------------------
// 💉 [수정 완료] 코드 로직과 100% 일치시킨 다국어 번역 사전
// ------------------------------------------------------------------
export const translations = {
  en: {
    // --- 1. 로그인 및 인증 (main) ---
    main: {
      email_placeholder: "E-mail",
      password_placeholder: "Password",
      nickname_placeholder: "Nickname",
      loading_wait: "Wait...",
      auth_or: "or",
      google_login: "Sign in with Google",
      join_btn: "sign up",
      login_btn: "LOG IN",
      back_to_login: "Back to Login",
      create_acc: "Create Account",
    },

    // --- 2. 메인 로비 및 헤더 (lobby) ---
    lobby: {
      btn_share: "share game",
      btn_tutorial: "Tutorial",
      btn_ranking: "Rank Board",
      btn_inventory: "Inventory",
      btn_play: "Play",
      stats_total_play: "Total Play",
      stats_win_rate: "Win Rate",
      stats_best_rank: "Best Rank",
      loading_status: "Loading...",
    },

    // --- 3. 게임 모드 선택 (modeSelect) ---
    modeSelect: {
      btn_back: "back",
      title_select_mode: "select mode",
      title_start_with: "start with",
      mode_win: "WIN MODE",
      mode_draw: "DRAW MODE",
      mode_lose: "LOSE MODE",
      mode_shuffle: "SHUFFLE MODE",
      mode_expert: "EXPERT MODE",
      btn_single: "Single Play",
      btn_multi: "Multi Play",
      btn_play_from_best: "Play from Best",
    },

    // --- 4. 설정 페이지 (settings) ---
    settings: {
      language: "Language Settings",
      game_info: "Game Info", // 💉 glameinfo 오타 수정
      profile_nickname: "Nickname",
      save_changes: "Save Changes",
      master_volume: "Volume",
      sound_muted: "Sound Muted",
      sound_active: "Sound Active",
      confirm: "Confirm",
      cancel: "CANCEL",
      btn_back: "back"
    },

    // --- 5. 시스템 메시지 및 팝업 (popup) ---
    popup: {
      msg_welcome_title: "WELCOME!",
      msg_welcome_desc: "ENJOY JUST RPS!",
      msg_nick_updated: "NICKNAME \nUPDATED!",
      msg_continue_title: "CONTINUE?",
      msg_ad_start_title: "WATCH AD",
      msg_watch_ad: "WATCH AD",
      msg_copy_title: "COPIED!",
      msg_copy_desc: "MESSAGE & LINK COPIED!",
      msg_best_record_info: "start from best record",
      msg_session_expired: "Please login again.",
      msg_signin_to_start: "PLEASE SIGN IN TO START!",
    }, 

    // --- 6. 게임 엔진 (game) : 💉 코드 로직에 맞춰 대문자 키로 수정 ---
    game: {
      ROUND: "Round",
      PLAY_TIME: "Play Time",
      SEC: "sec",
      WIN: "WIN",
      DRAW: "DRAW",
      LOSE: "LOSE",
      OK_GOT_IT: "OK, I got it",
    }
  },

  ko: {
    // --- 1. 로그인 및 인증 (main) ---
    main: {
      email_placeholder: "이메일",
      password_placeholder: "비밀번호",
      nickname_placeholder: "닉네임",
      loading_wait: "로딩중...",
      auth_or: "또는",
      google_login: "구글로 로그인",
      join_btn: "회원 가입",
      login_btn: "로그인",
      back_to_login: "로그인으로 돌아가기",
      create_acc: "계정 만들기",
    },

    // --- 2. 메인 로비 및 헤더 (lobby) ---
    lobby: {
      btn_share: "게임 공유",
      btn_tutorial: "게임 방법",
      btn_ranking: "베스트 플레이어",
      btn_inventory: "아이템 & 샵",
      btn_play: "게임 시작",
      stats_total_play: "총 플레이",
      stats_win_rate: "승률",
      stats_best_rank: "최고 순위",
      loading_status: "로딩중...",
    },

    // --- 3. 게임 모드 선택 (modeSelect) ---
    modeSelect: {
      btn_back: "뒤로",
      title_select_mode: "모드 선택",
      title_start_with: "게임 선택",
      mode_win: "승리 모드",
      mode_draw: "무승부 모드",
      mode_lose: "패배 모드",
      mode_shuffle: "무작위 모드",
      mode_expert: "초고난도 모드",
      btn_single: "싱글 플레이",
      btn_multi: "멀티 플레이",
      btn_play_from_best: "최고 기록에서 시작",
    },

    // --- 4. 설정 페이지 (settings) ---
    settings: {
      language: "언어 설정",
      game_info: "게임 정보",
      profile_nickname: "닉네임",
      save_changes: "변경사항 저장",
      master_volume: "볼륨",
      sound_muted: "음소거",
      sound_active: "사운드 활성화",
      confirm: "확인",
      cancel: "취소",
      btn_back: "뒤로"
    },

    // --- 5. 시스템 메시지 및 팝업 (popup) ---
    popup: {
      msg_welcome_title: "환영합니다!",
      msg_welcome_desc: "색다른 가위바위보를 즐겨보세요!",
      msg_nick_updated: "닉네임이 \n변경되었습니다!",
      msg_continue_title: "계속하시겠습니까?",
      msg_ad_start_title: "광고 시청",
      msg_watch_ad: "광고 시청",
      msg_copy_title: "복사 완료!",
      msg_copy_desc: "메시지와 링크가 복사되었습니다!",
      msg_best_record_info: "최고 기록에서 시작합니다",
      msg_session_expired: "다시 로그인해 주세요.",
      msg_signin_to_start: "시작하려면 로그인해 주세요!",
    },

    // --- 6. 게임 엔진 (game) : 💉 코드 로직에 맞춰 대문자 키로 수정 ---
    game: {
      ROUND: "라운드",
      PLAY_TIME: "진행 시간",
      SEC: "초",
      WIN: " 승",
      DRAW: " 무",
      LOSE: " 패",
      OK_GOT_IT: "기억했습니다!",
    }
  }
};