/**
 * Firestore 데이터 마이그레이션 스크립트
 * 로컬 data/db.json (201반~208반 115명 및 기존 반납 기록)을 Firestore로 일괄 업로드
 * 실행: node migrate_to_firestore.js
 */

const fs = require('fs');
const path = require('path');
const { isConfigured, getDb } = require('./firebase');

async function migrate() {
  console.log('====================================================');
  console.log('  Firestore 데이터 마이그레이션 시작 (Spark 무료 플랜)');
  console.log('====================================================');

  if (!isConfigured()) {
    console.error('❌ serviceAccountKey.json 파일이 프로젝트 폴더에 없습니다.');
    console.log('   가이드에 따라 Firebase 콘솔에서 서비스 계정 키를 발급받아');
    console.log('   serviceAccountKey.json 이름으로 저장 후 다시 실행해주세요.');
    process.exit(1);
  }

  const db = getDb();
  const localDbPath = path.join(__dirname, 'data', 'db.json');

  if (!fs.existsSync(localDbPath)) {
    console.error('❌ 로컬 데이터베이스 data/db.json 파일이 없습니다.');
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  const students = localData.students || [];
  const records = localData.records || [];

  console.log(`총 ${students.length}명 학생 및 ${records.length}건의 반납 기록을 Firestore로 업로드합니다...`);

  // Firestore Batch는 최대 500개 작업 지원 (Spark 무료 한도 내에서 안전하게 처리)
  let batch = db.batch();
  let count = 0;

  // 1. 학생 업로드
  for (const s of students) {
    const docRef = db.collection('students').doc(s.id);
    batch.set(docRef, {
      id: s.id,
      name: s.name,
      classId: s.classId,
      studentNum: s.studentNum,
      studentNumber: s.studentNumber,
      note: s.note || '',
      isPseudonym: s.isPseudonym || false,
      createdAt: s.createdAt || new Date().toISOString()
    }, { merge: true });

    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`... ${count}개 데이터 업로드 중`);
    }
  }

  // 2. 반납 기록 업로드
  for (const r of records) {
    const docRef = db.collection('records').doc(r.id);
    batch.set(docRef, {
      id: r.id,
      studentId: r.studentId,
      classId: r.classId,
      date: r.date,
      returned: r.returned === true,
      updatedAt: r.updatedAt || new Date().toISOString()
    }, { merge: true });

    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`... ${count}개 데이터 업로드 중`);
    }
  }

  // 남은 배치 커밋
  await batch.commit();

  console.log(`✅ 마이그레이션 완료!`);
  console.log(`   - 학생: ${students.length}명`);
  console.log(`   - 반납 기록: ${records.length}건`);
  console.log(`   - 이제 웹앱이 Firebase Firestore와 실시간 연동되어 동작합니다.`);
  console.log('====================================================');
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
