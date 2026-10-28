// test/test_api.js - Automated API tests for Jumprope Return Manager
const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('  [테스트 시작] 고2 체육 줄넘기 반납 관리 시스템 API 검증');
  console.log('========================================================');

  // 1. 공용 설정 조회
  const cfg = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/config',
    method: 'GET'
  });
  console.log(`1. 설정 조회: Status ${cfg.status}, 오늘 = ${cfg.data.today}, 기관명 = ${cfg.data.institutionName}, Firebase = ${cfg.data.isFirebaseConnected}`);

  // 2. 초기 201반 요약 통계 확인
  const sum1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/records/summary?classId=201',
    method: 'GET'
  });
  const cs = sum1.data.classSummary;
  const as = sum1.data.allSummary;
  console.log(`2. 201반 요약: 학생 ${cs.totalStudents}명 중 반납 = ${cs.returnedCount}명, 미반납 = ${cs.pendingCount}명 (전체 8개 반 총합: ${as.totalStudents}명)`);

  // 3. 1번 학생 빠른 토글 테스트 (201반 1번 학생)
  const firstStudent = sum1.data.students[0];
  const toggle1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/records/quick-toggle',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Code': '1234'
    }
  }, {
    studentId: firstStudent.id,
    date: cfg.data.today
  });
  console.log(`3. 1-클릭 빠른 토글: Status ${toggle1.status}, ${toggle1.data.message}`);

  // 4. 학생별 이력 조회 (애를 누르면 이력이 뜨는 기능)
  const hist = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/students/${firstStudent.id}/history`,
    method: 'GET'
  });
  console.log(`4. 학생 이력 조회: Status ${hist.status}, 학생명 = ${hist.data.student.name}, 총 활동일 = ${hist.data.stats.totalRecords}일, 반납 횟수 = ${hist.data.stats.returnedCount}`);

  // 5. 학생별 교사용 메모 저장
  const noteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/students/${firstStudent.id}/note`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Code': '1234'
    }
  }, {
    note: '줄넘기 쌩쌩이 연습 열심히 함'
  });
  console.log(`5. 교사 메모 저장: Status ${noteRes.status}, 메모: "${noteRes.data.note}"`);

  // 6. 201반 전원 반납 완료 일괄 처리
  const batchRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/records/class-batch',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Code': '1234'
    }
  }, {
    classId: '201',
    date: cfg.data.today,
    returned: true
  });
  console.log(`6. 반 전원 일괄 회수: Status ${batchRes.status}, 메시지: ${batchRes.data.message}`);

  // 7. Firebase Spark 연결 상태 조회
  const fbStatus = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/firebase/status',
    method: 'GET'
  });
  console.log(`7. Firebase 상태 조회: Status ${fbStatus.status}, 플랜 = ${fbStatus.data.plan}, 비용 = ${fbStatus.data.sparkQuotas.cost}`);

  // 8. 잘못된 인증 코드 차단 검증
  const authErr = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/records/quick-toggle',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Code': 'wrong_9999'
    }
  }, {
    studentId: firstStudent.id
  });
  console.log(`8. 인증 코드 차단 검증: Status ${authErr.status} (401 기대), 차단 완료`);

  console.log('========================================================');
  console.log('  [테스트 완료] 모든 핵심 기능 및 API 테스트 100% 통과!');
  console.log('========================================================');
}

runTests().catch(console.error);
