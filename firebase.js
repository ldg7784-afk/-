/**
 * Firebase Firestore 연동 모듈 (Spark 무료 플랜 최적화)
 * - serviceAccountKey.json 파일이 존재하면 Firestore 클라우드 모드로 자동 동작
 * - 파일이 없을 경우 로컬 모드로 안전하게 폴백(Fallback) 동작하여 오류 방지
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let firestore = null;
let isConfigured = false;
let configuredProjectId = null;

function checkAndInit() {
  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  try {
    if (fs.existsSync(keyPath)) {
      if (!admin.apps.length) {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        configuredProjectId = serviceAccount.project_id;
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      firestore = admin.firestore();
      isConfigured = true;
      console.log(`🔥 [Firebase] Firestore 클라우드 데이터베이스가 성공적으로 연결되었습니다! (프로젝트: ${configuredProjectId || 'Spark 무료 플랜'})`);
      return true;
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      if (!admin.apps.length) {
        configuredProjectId = process.env.FIREBASE_PROJECT_ID;
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
      }
      firestore = admin.firestore();
      isConfigured = true;
      console.log('🔥 [Firebase] 환경변수 기반 Firestore 클라우드 데이터베이스가 성공적으로 연결되었습니다!');
      return true;
    } else {
      isConfigured = false;
      return false;
    }
  } catch (err) {
    console.warn('⚠️ [Firebase] 초기화 중 알림 (로컬 모드로 전환됩니다):', err.message);
    isConfigured = false;
    firestore = null;
    return false;
  }
}

// 최초 1회 초기화 시도
checkAndInit();

module.exports = {
  isConfigured: () => isConfigured,
  getDb: () => firestore,
  checkAndInit,
  getProjectId: () => configuredProjectId,
  admin
};
