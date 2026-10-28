// seed_soccer_players.js
const fs = require('fs');
const path = require('path');

const soccerRoster = {
  "201": [
    "손흥민", "박지성", "김민재", "이강인", "황희찬",
    "조규성", "기성용", "이청용", "구자철", "차범근"
  ],
  "202": [
    "리오넬 메시", "크리스티아누 호날두", "킬리안 음바페", "엘링 홀란", "네이마르",
    "해리 케인", "로베르트 레반도프스키", "카림 벤제마", "루이스 수아레스", "즐라탄 이브라히모비치"
  ],
  "203": [
    "케빈 더 브라위너", "루카 모드리치", "토니 크로스", "주드 벨링엄", "안드레스 이니에스타",
    "사비 에르난데스", "지네딘 지단", "안드레아 피를로", "은골로 캉테", "로드리"
  ],
  "204": [
    "버질 판 다이크", "세르히오 라모스", "파올로 말디니", "카를레스 푸욜", "티아고 실바",
    "마누엘 노이어", "잔루이지 부폰", "티보 쿠르투아", "알리송 베케르", "이케르 카시야스"
  ],
  "205": [
    "모하메드 살라", "부카요 사카", "필 포든", "마르틴 외데고르", "데클란 라이스",
    "브루노 페르난데스", "콜 파머", "트렌트 알렉산더 아놀드", "윌리엄 살리바", "베르나르두 실바"
  ],
  "206": [
    "비니시우스 주니오르", "호드리구", "라민 야말", "앙투안 그리즈만", "라우타로 마르티네스",
    "자말 무시알라", "플로리안 비르츠", "페데리코 발베르데", "하파엘 레앙", "흐비차 크바라츠헬리아"
  ],
  "207": [
    "안정환", "박주영", "이영표", "송종국", "설기현",
    "김남일", "이을용", "이운재", "김병지", "황선홍"
  ],
  "208": [
    "설영우", "이재성", "황인범", "정우영", "오현규",
    "양민혁", "배준호", "백승호", "조현우", "김진수"
  ]
};

// 중복 검증
const allNames = [];
for (const [classId, players] of Object.entries(soccerRoster)) {
  if (players.length !== 10) {
    throw new Error(`${classId}반의 선수 수가 10명이 아닙니다 (현재 ${players.length}명)`);
  }
  for (const name of players) {
    if (allNames.includes(name)) {
      throw new Error(`중복된 선수 이름 발견: ${name}`);
    }
    allNames.push(name);
  }
}
console.log(`✅ 8개 반 총 ${allNames.length}명의 중복 없는 축구 선수 명단 확인 완료!`);

const today = '2026-10-28';
const yesterday = '2026-10-27';

const students = [];
const records = [];

for (const [classId, players] of Object.entries(soccerRoster)) {
  players.forEach((name, idx) => {
    const studentNum = idx + 1;
    const numStr = String(studentNum).padStart(2, '0');
    const fullNumber = `${classId}${numStr}`;
    const studentId = `std_${fullNumber}`;

    students.push({
      id: studentId,
      classId,
      studentNum,
      studentNumber: fullNumber,
      name,
      isPseudonym: true,
      note: studentNum === 1 ? '주장 (줄넘기 교구 관리 담당)' : '',
      createdAt: new Date().toISOString()
    });

    // 오늘 날짜 반납 기록 예시 (반마다 6~8명 반납 완료 상태)
    const returnedToday = studentNum <= (classId === '201' ? 8 : (classId === '202' ? 7 : 6));
    records.push({
      id: `rec_${studentId}_${today}`,
      studentId,
      classId,
      date: today,
      returned: returnedToday,
      updatedAt: new Date().toISOString()
    });

    // 어제 날짜 반납 기록 예시
    const returnedYesterday = studentNum !== 5 && studentNum !== 9;
    records.push({
      id: `rec_${studentId}_${yesterday}`,
      studentId,
      classId,
      date: yesterday,
      returned: returnedYesterday,
      updatedAt: new Date().toISOString()
    });
  });
}

const dbData = {
  version: "2.0.0",
  institutionName: "26] 고2 체육과 줄넘기 활동 (축구 스타 리그)",
  classes: ["201", "202", "203", "204", "205", "206", "207", "208"],
  purposeSetting: {
    purpose: "TEACHER_ONLY",
    lastUpdated: new Date().toISOString(),
    updatedBy: "선생님",
    description: "교사 단독 행정·업무용: 반별/날짜별 줄넘기 회수 여부 확인 및 기록"
  },
  students,
  records,
  auditLogs: [
    {
      id: `log_init_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "INIT_ROSTER",
      details: "8개 반 80명 축구선수 명단 생성 (반별 10명, 중복 없음)",
      clientIp: "127.0.0.1"
    }
  ]
};

// 1. data/db.example.json 저장 (GitHub / Vercel 공용)
const examplePath = path.join(__dirname, 'data', 'db.example.json');
fs.writeFileSync(examplePath, JSON.stringify(dbData, null, 2), 'utf8');
console.log(`✅ ${examplePath} 저장 완료 (${students.length}명)`);

// 2. data/db.json 저장 (로컬 서버용)
const dbPath = path.join(__dirname, 'data', 'db.json');
fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
console.log(`✅ ${dbPath} 저장 완료 (${students.length}명)`);
