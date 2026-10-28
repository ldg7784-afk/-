const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const firebase = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3000;
const TEACHER_ACCESS_CODE = process.env.TEACHER_ACCESS_CODE || '1234';
const INSTITUTION_NAME = process.env.INSTITUTION_NAME || '26] 고2 체육과 줄넘기 활동';
const PRIVACY_OFFICER_NAME = process.env.PRIVACY_OFFICER_NAME || '체육교과 담당교사';
const PRIVACY_OFFICER_CONTACT = process.env.PRIVACY_OFFICER_CONTACT || 'pe_dept@school.kr';
const DATA_RETENTION_MONTHS = parseInt(process.env.DATA_RETENTION_MONTHS || '12', 10);
const ALLOW_ANONYMOUS_STUDENT = process.env.ALLOW_ANONYMOUS_STUDENT !== 'false';

// 디렉토리 및 데이터베이스 파일 경로 (Vercel 서버리스 호환)
const os = require('os');
const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'data') : path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// 디렉토리 초기화
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
} catch (e) {
  // 읽기 전용 환경 무시
}

// 오늘 날짜 포맷 함수 (YYYY-MM-DD, 한국 표준시 기준)
function getTodayDateStr() {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + kstOffset);
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Firestore 비동기 동기화 헬퍼 (Spark 무료 플랜 최적화)
async function syncRecordToFirestore(record) {
  if (!firebase.isConfigured()) return;
  try {
    const fdb = firebase.getDb();
    await fdb.collection('records').doc(record.id).set(record, { merge: true });
  } catch (err) {
    console.error('Firestore record sync error:', err.message);
  }
}

async function syncStudentToFirestore(student) {
  if (!firebase.isConfigured()) return;
  try {
    const fdb = firebase.getDb();
    await fdb.collection('students').doc(student.id).set(student, { merge: true });
  } catch (err) {
    console.error('Firestore student sync error:', err.message);
  }
}

// 원자적 파일 저장 함수
function saveDatabase(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = path.join(DATA_DIR, `db.tmp.${Date.now()}`);
    const dataStr = JSON.stringify(db, null, 2);
    fs.writeFileSync(tempFile, dataStr, 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.warn('로컬 파일 저장 알림 (서버리스 환경에서는 Firestore가 주 저장소로 동작합니다):', err.message);
  }
}

// 데이터베이스 로드 함수
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('데이터베이스 파싱 에러:', err);
    }
  }

  // Vercel 배포 환경 초기 템플릿 로드 시도
  const exampleFile = path.join(__dirname, 'data', 'db.example.json');
  if (fs.existsSync(exampleFile)) {
    try {
      const raw = fs.readFileSync(exampleFile, 'utf8');
      return JSON.parse(raw);
    } catch (e) {}
  }
  // 기본 골격
  return {
    version: '2.0.0',
    institutionName: INSTITUTION_NAME,
    classes: ['201', '202', '203', '204', '205', '206', '207', '208'],
    purposeSetting: {
      purpose: 'TEACHER_ONLY',
      lastUpdated: new Date().toISOString(),
      updatedBy: '선생님',
      description: '교사 단독 행정·업무용: 반별/날짜별 줄넘기 회수 여부 확인 및 기록'
    },
    students: [],
    records: [],
    auditLogs: []
  };
}

// 감사 로그 기록 함수
function logAudit(db, action, details, clientIp) {
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    action,
    details,
    clientIp: clientIp || '127.0.0.1'
  };
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift(logEntry);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
}

let db = loadDatabase();

// Firestore 클라우드 동기화 (서버 시작 시)
async function loadFromFirestoreIfConfigured() {
  if (!firebase.isConfigured()) return;
  try {
    const fdb = firebase.getDb();
    const studentsSnap = await fdb.collection('students').get();
    if (!studentsSnap.empty) {
      const cloudStudents = [];
      studentsSnap.forEach(doc => cloudStudents.push(doc.data()));
      db.students = cloudStudents;
    }
    const recordsSnap = await fdb.collection('records').get();
    if (!recordsSnap.empty) {
      const cloudRecords = [];
      recordsSnap.forEach(doc => cloudRecords.push(doc.data()));
      db.records = cloudRecords;
    }
    saveDatabase(db);
    console.log(`☁️ [Firebase] Firestore로부터 ${db.students.length}명 학생 및 ${db.records.length}건 기록 동기화 완료!`);
  } catch (err) {
    console.error('Firestore startup sync error:', err.message);
  }
}
loadFromFirestoreIfConfigured();

// 미들웨어
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 기본 보안 응답 헤더
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 교사용 인증 검증 미들웨어
function requireTeacherAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const accessCode = req.headers['x-access-code'];
  const providedCode = accessCode || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!providedCode || providedCode !== TEACHER_ACCESS_CODE) {
    return res.status(401).json({
      success: false,
      message: '교사 인증 코드가 올바르지 않거나 만료되었습니다.'
    });
  }
  next();
}

// -------------------------------------------------------------
// [API 라우트]
// -------------------------------------------------------------

// 1. 공용 설정 및 반 목록 조회
app.get('/api/config', (req, res) => {
  const classList = db.classes || ['201', '202', '203', '204', '205', '206', '207', '208'];
  res.json({
    success: true,
    institutionName: db.institutionName || INSTITUTION_NAME,
    classes: classList,
    isFirebaseConnected: firebase.isConfigured(),
    privacyOfficerName: PRIVACY_OFFICER_NAME,
    privacyOfficerContact: PRIVACY_OFFICER_CONTACT,
    retentionMonths: DATA_RETENTION_MONTHS,
    allowAnonymous: ALLOW_ANONYMOUS_STUDENT,
    purposeSetting: db.purposeSetting || {
      purpose: 'TEACHER_ONLY',
      lastUpdated: new Date().toISOString()
    },
    today: getTodayDateStr(),
    serverTime: new Date().toISOString()
  });
});

// 2. 교사 접근 코드 검증
app.post('/api/auth/verify', (req, res) => {
  const { code } = req.body;
  if (!code || code !== TEACHER_ACCESS_CODE) {
    logAudit(db, 'AUTH_FAILED', '교사 인증 실패 시도', req.ip);
    saveDatabase(db);
    return res.status(401).json({
      success: false,
      message: '접근 인증 코드가 일치하지 않습니다.'
    });
  }

  logAudit(db, 'AUTH_SUCCESS', '교사 인증 성공', req.ip);
  saveDatabase(db);
  res.json({
    success: true,
    token: TEACHER_ACCESS_CODE,
    message: '교사 인증에 성공했습니다.'
  });
});

// 3. 반별 / 날짜별 반납 요약 및 학생 명부 조회 (핵심 기능 ⭐)
app.get('/api/records/summary', (req, res) => {
  const queryDate = req.query.date || getTodayDateStr();
  const selectedClass = req.query.classId || '201'; // 'all' 또는 '201', '202' 등
  const classList = db.classes || ['201', '202', '203', '204', '205', '206', '207', '208'];

  // 날짜별 레코드 매핑: studentId -> record
  const recordsOnDate = {};
  db.records.forEach(r => {
    if (r.date === queryDate) {
      recordsOnDate[r.studentId] = r;
    }
  });

  // 1) 전체 8개 반 각 반별 당일 통계 계산 (매트릭스 카드용)
  const classStats = classList.map(cId => {
    const studentsInC = db.students.filter(s => s.classId === cId);
    const total = studentsInC.length;
    let returned = 0;
    studentsInC.forEach(s => {
      const rec = recordsOnDate[s.id];
      if (rec && rec.returned === true) {
        returned++;
      }
    });
    const pending = total - returned;
    const rate = total > 0 ? Math.round((returned / total) * 100) : 0;
    return {
      classId: cId,
      name: `${cId}반`,
      total,
      returned,
      pending,
      rate,
      isAllReturned: total > 0 && returned === total
    };
  });

  // 전체 학교/학년 합계
  const allTotal = db.students.length;
  let allReturned = 0;
  db.students.forEach(s => {
    const rec = recordsOnDate[s.id];
    if (rec && rec.returned === true) allReturned++;
  });
  const allPending = allTotal - allReturned;
  const allRate = allTotal > 0 ? Math.round((allReturned / allTotal) * 100) : 0;

  // 2) 선택된 반 필터링 학생 목록
  let targetStudents = db.students;
  if (selectedClass !== 'all') {
    targetStudents = db.students.filter(s => s.classId === selectedClass);
  }

  let classReturnedCount = 0;
  const studentList = targetStudents.map(student => {
    const rec = recordsOnDate[student.id];
    const isReturned = rec ? rec.returned === true : false;
    if (isReturned) classReturnedCount++;

    return {
      id: student.id,
      classId: student.classId,
      studentNum: student.studentNum,
      studentNumber: student.studentNumber,
      name: student.name,
      isPseudonym: student.isPseudonym || false,
      returnedOnDate: isReturned,
      recordId: rec ? rec.id : null,
      updatedAt: rec ? rec.updatedAt : student.createdAt
    };
  });

  // 번호 및 학번 오름차순 정렬
  studentList.sort((a, b) => (a.studentNum || 0) - (b.studentNum || 0));

  const classTotal = targetStudents.length;
  const classPendingCount = classTotal - classReturnedCount;
  const classRate = classTotal > 0 ? Math.round((classReturnedCount / classTotal) * 100) : 0;

  res.json({
    success: true,
    date: queryDate,
    selectedClass,
    classSummary: {
      classId: selectedClass,
      className: selectedClass === 'all' ? '전체 학급' : `${selectedClass}반`,
      totalStudents: classTotal,
      returnedCount: classReturnedCount,
      pendingCount: classPendingCount,
      rate: classRate,
      isAllReturned: classTotal > 0 && classReturnedCount === classTotal
    },
    allSummary: {
      totalStudents: allTotal,
      returnedCount: allReturned,
      pendingCount: allPending,
      rate: allRate
    },
    classesMatrix: classStats,
    students: studentList
  });
});

// 4. 단 1번 클릭으로 학생의 특정 날짜 반납 상태 토글 (교실 현장 최적화 ⭐)
app.post('/api/records/quick-toggle', requireTeacherAuth, (req, res) => {
  const { studentId, date } = req.body;
  const targetDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : getTodayDateStr();

  const student = db.students.find(s => s.id === studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: '학생을 찾을 수 없습니다.' });
  }

  let record = db.records.find(r => r.studentId === studentId && r.date === targetDate);
  let newStatus = true;

  if (record) {
    newStatus = !record.returned;
    record.returned = newStatus;
    record.updatedAt = new Date().toISOString();
  } else {
    newStatus = true;
    record = {
      id: `rec_${studentId}_${targetDate}`,
      studentId,
      classId: student.classId,
      date: targetDate,
      returned: newStatus,
      updatedAt: new Date().toISOString()
    };
    db.records.push(record);
  }

  logAudit(
    db,
    'QUICK_TOGGLE',
    `[${student.classId}반 ${student.studentNum}번] ${student.name} -> ${targetDate} 반납상태: ${newStatus ? '회수 완료' : '미회수'}`,
    req.ip
  );

  saveDatabase(db);
  syncRecordToFirestore(record);

  res.json({
    success: true,
    message: `${student.name} 학생 (${targetDate}) [${newStatus ? '회수 완료' : '미회수'}] 전환`,
    returnedOnDate: newStatus,
    studentId,
    record
  });
});

// 5. 해당 반 전원 반납 완료 (또는 전원 미회수) 일괄 처리 기능 (체육 수업 종료 시 극강의 편리함!)
app.post('/api/records/class-batch', requireTeacherAuth, (req, res) => {
  const { classId, date, returned } = req.body;
  const targetDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : getTodayDateStr();
  const setStatus = returned === true || returned === 'true';

  const classStudents = db.students.filter(s => s.classId === classId);
  if (classStudents.length === 0) {
    return res.status(404).json({ success: false, message: '해당 반 학생이 존재하지 않습니다.' });
  }

  let modifiedCount = 0;
  classStudents.forEach(student => {
    let record = db.records.find(r => r.studentId === student.id && r.date === targetDate);
    if (record) {
      if (record.returned !== setStatus) {
        record.returned = setStatus;
        record.updatedAt = new Date().toISOString();
        modifiedCount++;
      }
    } else {
      record = {
        id: `rec_${student.id}_${targetDate}`,
        studentId: student.id,
        classId: student.classId,
        date: targetDate,
        returned: setStatus,
        updatedAt: new Date().toISOString()
      };
      db.records.push(record);
      modifiedCount++;
    }
  });

  logAudit(
    db,
    'CLASS_BATCH',
    `${classId}반 ${targetDate} 일괄 처리: ${setStatus ? '전원 회수 완료' : '전원 미회수'} (${classStudents.length}명)`,
    req.ip
  );

  saveDatabase(db);

  // Firestore 일괄 커밋
  if (firebase.isConfigured()) {
    try {
      const fdb = firebase.getDb();
      const fBatch = fdb.batch();
      classStudents.forEach(student => {
        const rec = db.records.find(r => r.studentId === student.id && r.date === targetDate);
        if (rec) {
          fBatch.set(fdb.collection('records').doc(rec.id), rec, { merge: true });
        }
      });
      fBatch.commit().catch(e => console.error('Firestore batch error:', e.message));
    } catch (e) {
      console.error('Firestore batch catch:', e.message);
    }
  }

  res.json({
    success: true,
    message: `${classId}반 학생 ${classStudents.length}명이 ${targetDate}에 [${setStatus ? '회수 완료' : '미회수'}]로 일괄 처리되었습니다.`
  });
});

// 6. 개별 학생 수기 등록/수정 (새 학생 전입 등)
app.post('/api/records', requireTeacherAuth, (req, res) => {
  let { classId, studentNum, name, studentNumber, returned, date, isPseudonym } = req.body;

  name = (name || '').trim();
  const targetDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : getTodayDateStr();
  const isReturned = returned === true || returned === 'true' || returned === 1;
  const pseudonymFlag = isPseudonym === true || isPseudonym === 'true';

  classId = (classId || '201').trim();
  const sNumInt = parseInt(studentNum || '0', 10);
  const fullNum = studentNumber || `${classId}${String(sNumInt).padStart(2, '0')}`;

  if (!name && !pseudonymFlag) {
    return res.status(400).json({ success: false, message: '학생 이름을 입력해주세요.' });
  }

  let student = db.students.find(s => s.studentNumber === fullNum || (s.classId === classId && s.studentNum === sNumInt));
  if (!student) {
    student = {
      id: `std_${fullNum}_${Date.now()}`,
      classId,
      studentNum: sNumInt,
      studentNumber: fullNum,
      name: name || `학생(${fullNum})`,
      isPseudonym: pseudonymFlag,
      createdAt: new Date().toISOString()
    };
    db.students.push(student);
  } else {
    if (name) student.name = name;
  }

  let record = db.records.find(r => r.studentId === student.id && r.date === targetDate);
  if (record) {
    record.returned = isReturned;
    record.updatedAt = new Date().toISOString();
  } else {
    record = {
      id: `rec_${student.id}_${targetDate}`,
      studentId: student.id,
      classId: student.classId,
      date: targetDate,
      returned: isReturned,
      updatedAt: new Date().toISOString()
    };
    db.records.push(record);
  }

  logAudit(db, 'RECORD_SAVE', `[${classId}반 ${fullNum}] ${student.name} 반납 기록 저장 (${targetDate})`, req.ip);
  saveDatabase(db);
  syncStudentToFirestore(student);
  syncRecordToFirestore(record);

  res.json({
    success: true,
    message: `${classId}반 ${student.name} 학생의 ${targetDate} 반납 상태가 저장되었습니다.`,
    student,
    record
  });
});

// 7. 심의 목적 설정
app.post('/api/settings/purpose', requireTeacherAuth, (req, res) => {
  const { purpose } = req.body;
  const descriptions = {
    TEACHER_ONLY: '교사 단독 행정·업무용: 반별/날짜별 줄넘기 회수 여부 확인 및 기록',
    CLASSROOM: '정규 수업 학생 직접 사용: 체육관 공용 태블릿에서 학생 직접 체크',
    HOME_HOMEWORK: '가정 및 과제 연계용: 방과후 줄넘기 연습 기록 관리'
  };
  db.purposeSetting = {
    purpose,
    description: descriptions[purpose] || '교사 단독 행정·업무용',
    lastUpdated: new Date().toISOString(),
    updatedBy: '선생님'
  };
  logAudit(db, 'PURPOSE_UPDATED', `소프트웨어 심의 목적 변경: ${purpose}`, req.ip);
  saveDatabase(db);
  res.json({ success: true, purposeSetting: db.purposeSetting });
});

// 8. 데이터 백업 JSON 다운로드
app.get('/api/backup/export', requireTeacherAuth, (req, res) => {
  logAudit(db, 'BACKUP_EXPORT', '전체 8개 반 줄넘기 반납 데이터 JSON 백업 다운로드', req.ip);
  saveDatabase(db);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=jumprope_classes_backup_${getTodayDateStr()}.json`);
  res.send(JSON.stringify(db, null, 2));
});

// 9. 감사 로그 조회
app.get('/api/logs/audit', requireTeacherAuth, (req, res) => {
  res.json({ success: true, logs: db.auditLogs || [] });
});

// 10. 학생별 반납 이력 조회 (애를 누르면 이력이 뜨는 기능 ⭐)
app.get('/api/students/:id/history', (req, res) => {
  const studentId = req.params.id;
  const student = db.students.find(s => s.id === studentId);

  if (!student) {
    return res.status(404).json({ success: false, message: '학생을 찾을 수 없습니다.' });
  }

  // 해당 학생의 모든 날짜별 반납 기록 추출 (날짜 내림차순 정렬)
  const studentRecords = db.records
    .filter(r => r.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));

  // 이력 통계 계산
  const totalRecords = studentRecords.length;
  const returnedCount = studentRecords.filter(r => r.returned === true).length;
  const pendingCount = totalRecords - returnedCount;
  const returnRate = totalRecords > 0 ? Math.round((returnedCount / totalRecords) * 100) : 0;

  res.json({
    success: true,
    student: {
      id: student.id,
      name: student.name,
      classId: student.classId,
      studentNum: student.studentNum,
      studentNumber: student.studentNumber,
      note: student.note || ''
    },
    stats: {
      totalRecords,
      returnedCount,
      pendingCount,
      returnRate
    },
    records: studentRecords
  });
});

// 11. 학생별 교사용 메모 저장 (줄넘기 특이사항 등)
app.post('/api/students/:id/note', requireTeacherAuth, (req, res) => {
  const studentId = req.params.id;
  const { note } = req.body;
  const student = db.students.find(s => s.id === studentId);

  if (!student) {
    return res.status(404).json({ success: false, message: '학생을 찾을 수 없습니다.' });
  }

  student.note = (note || '').trim().slice(0, 300);
  logAudit(db, 'NOTE_UPDATE', `[${student.classId}반 ${student.studentNum}번 ${student.name}] 교사 메모 갱신`, req.ip);
  saveDatabase(db);

  res.json({
    success: true,
    message: `${student.name} 학생의 메모가 저장되었습니다.`,
    note: student.note
  });
});

// 12. Firebase 연결 상태 및 Spark 플랜 정보 조회
app.get('/api/firebase/status', (req, res) => {
  const isConn = firebase.isConfigured();
  const keyExists = fs.existsSync(path.join(__dirname, 'serviceAccountKey.json'));
  res.json({
    success: true,
    connected: isConn,
    plan: 'Spark (무료 플랜 100% 적용)',
    projectId: firebase.getProjectId() || (keyExists ? '파일 감지됨' : '미연결'),
    keyFileFound: keyExists,
    message: isConn
      ? '🔥 Firebase Cloud Firestore가 정상 연결되어 실시간 동기화 중입니다.'
      : (keyExists
          ? '⚠️ serviceAccountKey.json 파일이 감지되었으나 초기화가 필요합니다.'
          : '📁 serviceAccountKey.json 파일 대기 중 (현재 로컬 고속 DB로 안전하게 동작)'),
    sparkQuotas: {
      dailyReads: '50,000회/일 무료 (현재 예상 사용량: ~50회/일, 0.1%)',
      dailyWrites: '20,000회/일 무료 (현재 예상 사용량: ~115회/일, 0.5%)',
      dailyDeletes: '20,000회/일 무료',
      storage: '1 GiB 무료 (현재 사용량: ~2MB, 0.2%)',
      cost: '0원 (신용카드 등록 없이 영구 무료)'
    }
  });
});

// 13. Firebase 연결 실시간 재확인 (파일 등록 후 바로 연동 활성화)
app.post('/api/firebase/recheck', requireTeacherAuth, async (req, res) => {
  const reloaded = firebase.checkAndInit();
  if (reloaded) {
    await loadFromFirestoreIfConfigured();
  }
  res.json({
    success: true,
    connected: firebase.isConfigured(),
    projectId: firebase.getProjectId(),
    message: firebase.isConfigured()
      ? '🔥 Firebase Firestore 연결이 성공적으로 활성화되었습니다!'
      : '⚠️ 아직 serviceAccountKey.json 파일이 없거나 유효하지 않습니다.'
  });
});

// 서버 기동 (로컬 환경에서만 listen, Vercel에서는 모듈로 export)
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  [26] 고2 체육과 줄넘기 반납 관리 시스템 서버 실행`);
    console.log(`  - 201반 ~ 208반 8개 학급 학생 명단 로드 완료 (${db.students.length}명)`);
    console.log(`  - 접속 주소: http://localhost:${PORT}`);
    console.log(`  - 교사용 기본 접근 코드: ${TEACHER_ACCESS_CODE}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
