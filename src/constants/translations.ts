// ------------------------------------------------------------------
// 💉 코드 로직과 100% 일치시킨 다국어 번역 사전
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
      kakao_login: "LOGIN WITH KAKAO",
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
      btn_play_from_save: "Load Game",
    },

    // --- 4. 설정 페이지 (settings) ---
    settings: {
      language: "Settings",
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
      msg_continue_title: "Continue?",
      msg_ad_start_title: "WATCH AD",
      msg_watch_ad: "WATCH AD",
      msg_copy_title: "COPIED!",
      msg_copy_desc: "MESSAGE & LINK COPIED!",
      msg_best_record_info: "start from best record",
      msg_session_expired: "Please login again.",
      msg_signin_to_start: "",
      daily_reward_title: "DAILY GIFT!",
      daily_reward_desc: "Daily login reward!\nAttack Item Set (1 each)",
      msg_save_load_title: "LOAD game?",
      load_game_info: "Start from saved game",
      msg_save_load_free: "Continue from your save for free?",
      msg_save_load_cost: "-{{cost}} coins",
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
      SAVE_GAME: "SAVE DATA",
      SAVE_PROGRESS: "SAVE DATA",
      EXISTING_DATA: "EXISTING DATA",
      NEW_DATA: "NEW DATA",
      SAVE_DISCLAIMER: "※ Only 1 save slot is available.\n(Existing data will be deleted.)",
      OVERWRITE: "OVERWRITE",
      CANCEL: "CANCEL",
      MODE: "MODE",
    },

    // --- 7. 랭킹 페이지 (ranking) ---
    ranking: {
    title_my_best: "'s BEST",
    loading: "Loading...",
    no_records: "No records",
    btn_back: "Back",
    round_suffix: "R",
    time_suffix: "s",
    mode_suffix: " MODE",
    WIN: "WIN",
    DRAW: "DRAW",
    LOSE: "LOSE",
    SHUFFLE: "SHUFFLE",
    EXPERT: "EXPERT"
    },

    // --- 8. 결과 모달 (resultModal) ---
    resultModal: {
    game_over: "Game Over",
    round_label: "ROUND",
    new_record: "New Record!",
    clear_time: "Clear Time",
    earned: "Earned",
    continue_question: "Continue?",
    attempts_left: "Attempts Left:",
    watch_ad: "WATCH AD",
    no_continues: "No Continues Left",
    retry: "Retry",
    game_lobby: "game lobby",
    time_suffix: "s",
    mode_suffix: " MODE",
    // 모드 명칭
    WIN: "WIN",
    DRAW: "DRAW",
    LOSE: "LOSE",
    SHUFFLE: "SHUFFLE",
    EXPERT: "EXPERT"
    },

    // --- 9. 멀티플레이 페이지 (multiplay) ---
    multiplay: {
    btn_back: "Back",
    search_placeholder: "ROOM NAME / SEARCH",
    btn_create: "Creat",
    pass_placeholder: "PASSWORD (OPTION)",
    item_game: "ITEM GAME",
    no_item: "NO ITEM",
    btn_quick_match: "random join",
    title_active_rooms: "Active Rooms",
    no_active_rooms: "No Active Sessions",
    status_playing: "Playing",
    status_waiting: "Waiting",
    title_private_room: "Private Room",
    pass_modal_placeholder: "ENTER PASSWORD",
    btn_cancel: "Cancel",
    btn_join: "Join",
    // 알림 메시지
    msg_room_full: "The room is full!",
    msg_join_failed: "Failed to \njoin the room.",
    msg_create_failed: "Failed to \ncreate room: ",
    msg_no_public_rooms: "No public rooms \navailable.",
    msg_wrong_pass: "Incorrect password."
    },

    footer: {
    terms: "Terms",
    privacy: "Privacy",
    contact: "Contact"
    },

    legal: {
      terms_title: "Terms of Service",
      privacy_title: "Privacy Policy",
      terms_content: `[Article 1: Purpose]\nThese terms govern the use of the 'justRPS' service provided by 2H soft (the 'Company') and the rights and responsibilities of the Company and its members.\n\n[Article 2: Definitions]\n'Service' refers to the web game and related functions provided by the Company.\n\n[Article 3: Formation of Contract]\nA service use agreement is formed when a member creates an account within the service and agrees to these terms.\n\n[Article 4: Service Use and Restrictions]\n1. The Company, in principle, provides the service 24/7 but may suspend it for equipment maintenance or in case of failure.\n2. Users must not play the game using unfair methods such as macros, hacking, or bug abuse. If detected, accounts may be permanently suspended.\n\n[Article 5: Limitation of Liability]\n1. The Company is not liable for service interruptions caused by natural disasters or force majeure.\n2. The Company is not responsible for the loss of data (coins, items) caused by the user's negligence.`,
    
      privacy_content: `This Privacy Policy explains how the Company collects, uses, and protects users' personal information.\n\n[1. Collected Information]\nThe Company collects email addresses, nicknames, and game play records for account creation and management (via Supabase).\n\n[2. Collection Method]\nMembers can easily provide information through Google or Kakao social login.\n\n[3. Cookies and Advertising Services (Important)]\n1. This service uses Google AdSense to serve advertisements.\n2. Google uses cookies to serve ads based on a user's prior visits to this or other websites.\n3. Users may opt out of personalized advertising by visiting Google Ads Settings (www.google.com/settings/ads).\n\n[4. Data Retention and Destruction]\nPersonal information is destroyed immediately once a user requests account deletion or the purpose of collection is fulfilled.\n\n[5. Third-Party Disclosure]\nThe Company does not sell or provide users' personal information to third parties without consent, except where there is a legal obligation.`
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
      kakao_login: "카카오 로그인",
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
      btn_multi: "멀티 플레이 (배틀모드)",
      btn_play_from_best: "최고 기록에서 시작",
      btn_play_from_save: "저장된 게임 불러오기",
    },

    // --- 4. 설정 페이지 (settings) ---
    settings: {
      language: "설정",
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
      msg_nick_updated: "닉네임 변경!",
      msg_continue_title: "이어서 플레이",
      msg_ad_start_title: "광고 시청",
      msg_watch_ad: "광고 시청",
      msg_copy_title: "복사 완료!",
      msg_copy_desc: "메시지와 링크가 \n복사되었습니다!",
      msg_best_record_info: "최고 기록에서 시작합니다",
      msg_session_expired: "다시 로그인해 주세요.",
      msg_signin_to_start: "",
      daily_reward_title: "일일 보상!",
      daily_reward_desc: "오늘의 첫 접속 보상입니다!\n공격 아이템 3종 세트 (각 1개)",
      msg_save_load_title: "게임 불러오기",
      load_game_info: "저장된 게임을 불러옵니다.\n기록 재사용 시 비용이 증가합니다.",
      msg_save_load_free: "첫 회 무료",
      msg_save_load_cost: "-{{cost}} 코인",
    },

    // --- 6. 게임 엔진 (game)  ---
    game: {
      ROUND: "라운드",
      PLAY_TIME: "진행 시간",
      SEC: "초",
      WIN: " 승",
      DRAW: " 무",
      LOSE: " 패",
      OK_GOT_IT: "ok! 기억 완료!",
      SAVE_GAME: "게임 저장",
      SAVE_PROGRESS: "현재 기록 저장",
      EXISTING_DATA: "기존 저장 데이터",
      NEW_DATA: "현재 플레이 데이터",
      SAVE_DISCLAIMER: "※ 저장 데이터는 1개만 저장 가능합니다.\n(기존 데이터는 삭제됩니다.)",
      OVERWRITE: "덮어쓰기",
      CANCEL: "취소",
      MODE: "모드",
    },

    // --- 7. 랭킹 페이지 (ranking) ---
    ranking: {
    title_my_best: "의 최고 기록",
    loading: "로딩 중...",
    no_records: "기록이 없습니다",
    btn_back: "뒤로",
    round_suffix: "R",
    time_suffix: "s",
    mode_suffix: " 모드",
    WIN: "승리",
    DRAW: "무승부",
    LOSE: "패배",
    SHUFFLE: "무작위",
    EXPERT: "초고난도"                
    },

    // --- 8. 결과 모달 (resultModal) ---
    resultModal: {
    game_over: "게임 오버",
    round_label: "라운드",
    new_record: "신기록!",
    clear_time: "클리어 타임",
    earned: "획득 코인",
    continue_question: "계속할까요?",
    attempts_left: "남은 기회:",
    watch_ad: "광고 시청",
    no_continues: "남은 기회 없음",
    retry: "다시하기",
    game_lobby: "로비로",
    time_suffix: "초",
    mode_suffix: " 모드",
    // 모드 명칭
    WIN: "승리",
    DRAW: "무승부",
    LOSE: "패배",
    SHUFFLE: "무작위",
    EXPERT: "초고난도"
    },

    // --- 9. 멀티플레이 페이지 (multiplay) ---
    multiplay: {
    btn_back: "뒤로",
    search_placeholder: "방이름 검색/생성",
    btn_create: "생성",
    pass_placeholder: "비밀번호(선택)",
    item_game: "아이템전",
    no_item: "노템전",
    btn_quick_match: "랜덤 입장",
    title_active_rooms: "생성된 방",
    no_active_rooms: "생성된 방이 \n없습니다",
    status_playing: "게임중",
    status_waiting: "대기중",
    title_private_room: "비밀방",
    pass_modal_placeholder: "비밀번호를 \n입력하세요",
    btn_cancel: "취소",
    btn_join: "입장",
    // 알림 메시지
    msg_room_full: "방이 가득 찼습니다!",
    msg_join_failed: "방 입장에 \n실패했습니다.",
    msg_create_failed: "방 생성 실패: ",
    msg_no_public_rooms: "입장 가능한 \n방이 없습니다.",
    msg_wrong_pass: "비밀번호가 \n틀렸습니다."
    },

    footer: {
    terms: "이용약관",
    privacy: "개인정보처리방침",
    contact: "문의하기"
    },

    legal: {
      terms_title: "이용약관",
      privacy_title: "개인정보처리방침",
      terms_content: `[제1조 목적]\n본 약관은 2H soft(이하 '회사')가 제공하는 'justRPS' 서비스의 이용과 관련하여 회사와 회원간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.\n\n[제2조 용어의 정의]\n'서비스'란 회사가 제공하는 웹 게임 및 관련 기능을 의미합니다.\n\n[제3조 이용계약의 성립]\n이용계약은 회원이 서비스 내에서 계정을 생성하고 약관에 동의함으로써 성립됩니다.\n\n[제4조 서비스의 이용 및 제한]\n1. 회사는 24시간 서비스를 제공하는 것을 원칙으로 하나, 설비 점검 및 고장 시 중단될 수 있습니다.\n2. 사용자는 매크로, 해킹, 버그 악용 등 부정한 방법으로 게임을 플레이해서는 안 되며, 적발 시 계정이 영구 정지될 수 있습니다.\n\n[제5조 책임의 제한]\n1. 회사는 천재지변 또는 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.\n2. 회사는 사용자의 과실로 인한 데이터(코인, 아이템) 손실에 대해 책임을 지지 않습니다.`,
    
      privacy_content: `본 개인정보처리방침은 회사가 사용자의 개인정보를 어떻게 수집, 사용 및 보호하는지 설명합니다.\n\n[1. 수집하는 정보]\n회사는 계정 생성 및 관리(Supabase 이용)를 위해 이메일 주소, 닉네임, 게임 플레이 기록을 수집합니다.\n\n[2. 정보의 수집 방법]\n회원은 Google 또는 Kakao 소셜 로그인을 통해 간편하게 정보를 제공할 수 있습니다.\n\n[3. 쿠키 및 광고 서비스 (중요)]\n1. 본 서비스는 광고 게재를 위해 Google AdSense를 사용합니다.\n2. Google은 쿠키를 사용하여 사용자의 웹사이트 방문 기록을 바탕으로 맞춤형 광고를 제공합니다.\n3. 사용자는 Google 광고 설정(www.google.com/settings/ads)을 통해 맞춤형 광고를 거부할 수 있습니다.\n\n[4. 정보의 보유 및 파기]\n사용자가 회원 탈퇴를 요청하거나 목적이 달성된 경우, 회사는 해당 정보를 즉시 파기합니다.\n\n[5. 제3자 제공]\n회사는 법적 의무가 있는 경우를 제외하고 사용자의 동의 없이 개인정보를 제3자에게 판매하거나 제공하지 않습니다.`
    }
  }
};