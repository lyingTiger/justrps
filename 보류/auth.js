// auth.js

const SUPABASE_URL = "https://fwtggxslfborsyihpjnv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dGdneHNsZmJvcnN5aWhwam52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MTEwMDMsImV4cCI6MjA4NDM4NzAwM30.u0SPi2tbtIpsdVpWuhf3Cec2XfTyk28eEtJehl7HzPU";

// Supabase 클라이언트 초기화
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 연결 테스트 함수 (로그인 버튼 누를 때 확인용)
async function testConnection() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error("서버 연결 실패:", error.message);
    } else {
        console.log("Supabase 서버 연결 성공!");
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-login');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // 로그인 버튼 클릭 이벤트
    btnLogin.addEventListener('click', () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        if(!email || !password) {
            alert("이메일과 비밀번호를 입력해주세요.");
            return;
        }

        // TODO: 여기서 Supabase 로그인 API 호출 예정
        console.log("로그인 시도:", email);
        
        // 임시: 성공 시 메인 로비로 이동
        goToScreen('main-lobby');
    });
});

// 화면 전환 함수 (유니티 SceneManager.LoadScene 역할)
function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}