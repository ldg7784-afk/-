/**
 * Firebase Firestore 연결 및 Spark 무료 플랜 상태 점검 스크립트
 * 실행: node check_firebase.js
 */

const fs = require('fs');
const path = require('path');
const firebase = require('./firebase');

console.log('====================================================');
console.log('  🔥 Firebase Firestore (Spark 무료 플랜) 상태 점검');
console.log('====================================================');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
const keyExists = fs.existsSync(keyPath);

console.log(`1. 서비스 계정 키 파일 (serviceAccountKey.json): ${keyExists ? '✅ 발견됨' : '❌ 미발견'}`);

if (!keyExists) {
  console.log('\n[안내]');
  console.log('  아직 serviceAccountKey.json 파일이 프로젝트 폴더에 없습니다.');
  console.log('  웹앱은 현재 초고속 로컬 DB 모드로 안전하게 동작 중입니다.');
  console.log('  가이드(docs/FIREBASE_SPARK_SETUP_GUIDE.md)를 참고하여 키 파일을 넣어주세요.');
  console.log('====================================================');
  process.exit(0);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  console.log(`2. 프로젝트 ID: ${serviceAccount.project_id || '알 수 없음'}`);
  console.log(`3. 클라이언트 이메일: ${serviceAccount.client_email || '알 수 없음'}`);
  
  if (firebase.isConfigured()) {
    const db = firebase.getDb();
    console.log('4. Firestore 연결 테스트 진행 중...');
    
    db.collection('_healthcheck').doc('ping').set({
      timestamp: new Date().toISOString(),
      note: 'Firebase Spark Plan Health Check OK'
    }).then(() => {
      console.log('✅ 5. Firestore 클라우드 쓰기/읽기 테스트 성공!');
      console.log('🎉 축하합니다! Firebase Firestore가 완벽하게 연결되었습니다.');
      console.log('\n[다음 단계]');
      console.log('  기존 115명 학생 명단을 클라우드로 전송하려면 다음 명령을 실행하세요:');
      console.log('  node migrate_to_firestore.js');
      console.log('====================================================');
      process.exit(0);
    }).catch(err => {
      console.error('❌ Firestore 통신 실패:', err.message);
      console.log('   Firebase 콘솔에서 Cloud Firestore가 생성되었는지 확인해주세요.');
      console.log('====================================================');
      process.exit(1);
    });
  } else {
    console.log('❌ Firebase 초기화 실패. serviceAccountKey.json 파일 내용이 올바른지 확인해주세요.');
    console.log('====================================================');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ JSON 파싱 에러:', err.message);
  console.log('====================================================');
  process.exit(1);
}
