/**
 * 고2 줄넘기 반납 관리 시스템 (201반 ~ 208반 학급별 / 날짜별 추적 및 학생별 이력 팝업)
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // [1. 상태 관리자]
  // -------------------------------------------------------------
  const state = {
    authCode: sessionStorage.getItem('pe_teacher_access_code') || '1234',
    selectedClass: '201', // 기본값: 201반
    selectedDate: '',     // YYYY-MM-DD
    todayStr: '',
    selectedStudentId: null, // 이력 모달에 열려있는 학생 ID
    classes: ['201', '202', '203', '204', '205', '206', '207', '208'],
    classesMatrix: [],
    students: [],
    activeFilter: 'all',  // 'all', 'returned', 'pending'
    searchQuery: '',
    breakdownMode: 'returned' // 'returned' or 'pending'
  };

  // -------------------------------------------------------------
  // [2. DOM 요소]
  // -------------------------------------------------------------
  const DOM = {
    headerInstitution: document.getElementById('header-institution-name'),
    authStatusBadge: document.getElementById('auth-status-badge'),
    btnOpenAuthModal: document.getElementById('btn-open-auth-modal'),
    btnExportBackup: document.getElementById('btn-export-backup'),
    btnOpenAuditLog: document.getElementById('btn-open-audit-log'),
    btnOpenAuditFooter: document.getElementById('link-open-audit-footer'),

    // 데이터베이스 & Firebase 연동
    dbStatusBadge: document.getElementById('db-status-badge'),
    dbStatusText: document.getElementById('db-status-text'),
    btnOpenFirebaseGuide: document.getElementById('btn-open-firebase-guide'),
    modalFirebaseGuide: document.getElementById('modal-firebase-guide'),
    firebaseGuideStatusTag: document.getElementById('firebase-guide-status-tag'),
    firebaseGuideStatusDesc: document.getElementById('firebase-guide-status-desc'),
    btnRecheckFirebase: document.getElementById('btn-recheck-firebase'),

    // 반 탭 컨테이너
    classTabContainer: document.getElementById('class-tab-container'),
    activeClassTitleTag: document.getElementById('active-class-title-tag'),
    rosterClassHeading: document.getElementById('roster-class-heading'),
    labelBatchClassBtn: document.getElementById('label-batch-class-btn'),

    // 날짜 네비게이터
    inputRecordDate: document.getElementById('input-record-date'),
    btnDatePrev: document.getElementById('btn-date-prev'),
    btnDateToday: document.getElementById('btn-date-today'),
    btnDateNext: document.getElementById('btn-date-next'),
    btnBatchComplete: document.getElementById('btn-batch-complete'),
    btnBatchReset: document.getElementById('btn-batch-reset'),

    // 요약 카드
    cardClassSummary: document.getElementById('card-class-summary'),
    cardClassPending: document.getElementById('card-class-pending'),
    cardAllClasses: document.getElementById('card-all-classes'),
    summaryCardClassName: document.getElementById('summary-card-class-name'),
    summaryCardDateBadge: document.getElementById('summary-card-date-badge'),
    metricClassReturned: document.getElementById('metric-class-returned'),
    metricClassTotal: document.getElementById('metric-class-total'),
    summaryCardRateText: document.getElementById('summary-card-rate-text'),
    progressClassFill: document.getElementById('progress-class-fill'),

    summaryCardPendingName: document.getElementById('summary-card-pending-name'),
    metricClassPending: document.getElementById('metric-class-pending'),
    progressPendingFill: document.getElementById('progress-pending-fill'),

    metricAllReturned: document.getElementById('metric-all-returned'),
    metricAllTotal: document.getElementById('metric-all-total'),
    summaryAllRateText: document.getElementById('summary-all-rate-text'),
    progressAllFill: document.getElementById('progress-all-fill'),

    // 회수 / 미회수 명단 간략 보기 모달
    modalStatusBreakdown: document.getElementById('modal-status-breakdown'),
    statusBreakdownTitle: document.getElementById('status-breakdown-title'),
    statusBreakdownBadge: document.getElementById('status-breakdown-badge'),
    statusBreakdownSubtitle: document.getElementById('status-breakdown-subtitle'),
    btnBreakdownTabReturned: document.getElementById('btn-breakdown-tab-returned'),
    btnBreakdownTabPending: document.getElementById('btn-breakdown-tab-pending'),
    breakdownCountReturned: document.getElementById('breakdown-count-returned'),
    breakdownCountPending: document.getElementById('breakdown-count-pending'),
    btnCopyBreakdownList: document.getElementById('btn-copy-breakdown-list'),
    breakdownStudentsList: document.getElementById('breakdown-students-list'),
    breakdownEmptyMsg: document.getElementById('breakdown-empty-msg'),

    // 입력 폼
    returnEntryForm: document.getElementById('return-entry-form'),
    formClassSelect: document.getElementById('form-class-select'),
    inputStudentNum: document.getElementById('input-student-num'),
    inputStudentName: document.getElementById('input-student-name'),
    checkReturnStatus: document.getElementById('check-return-status'),
    toggleStatusLabel: document.getElementById('toggle-status-label'),
    btnSaveRecord: document.getElementById('btn-save-record'),

    // 명부 및 검색
    filterPillBtns: document.querySelectorAll('.filter-pill-btn'),
    filterCountAll: document.getElementById('filter-count-all'),
    filterCountReturned: document.getElementById('filter-count-returned'),
    filterCountPending: document.getElementById('filter-count-pending'),
    inputSearchStudent: document.getElementById('input-search-student'),
    studentTableBody: document.getElementById('student-table-body'),
    rosterEmptyState: document.getElementById('roster-empty-state'),
    emptyStateMsg: document.getElementById('empty-state-msg'),

    // 학생 이력 모달 (⭐ 애를 누르면 이력이 뜨는 모달)
    modalStudentHistory: document.getElementById('modal-student-history'),
    historyModalName: document.getElementById('history-modal-name'),
    historyModalClassBadge: document.getElementById('history-modal-class-badge'),
    historyStatTotal: document.getElementById('history-stat-total'),
    historyStatReturned: document.getElementById('history-stat-returned'),
    historyStatPending: document.getElementById('history-stat-pending'),
    historyRecordsTbody: document.getElementById('history-records-tbody'),
    historyStudentNote: document.getElementById('history-student-note'),
    btnSaveStudentNote: document.getElementById('btn-save-student-note'),

    // 기타 모달들
    modalPrivacy: document.getElementById('modal-privacy'),
    modalTerms: document.getElementById('modal-terms'),
    modalAuth: document.getElementById('modal-auth'),
    modalAudit: document.getElementById('modal-audit'),
    linkOpenPrivacyModal: document.getElementById('link-open-privacy-modal'),
    linkOpenTermsModal: document.getElementById('link-open-terms-modal'),
    inputAuthCode: document.getElementById('input-auth-code'),
    btnSubmitAuth: document.getElementById('btn-submit-auth'),
    auditLogTbody: document.getElementById('audit-log-tbody'),
    toastContainer: document.getElementById('toast-container')
  };

  // -------------------------------------------------------------
  // [3. UI 유틸리티 (토스트 & 모달)]
  // -------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : 'ℹ ';
    toast.textContent = `${icon} ${message}`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function openModal(el) { if (el) el.classList.add('active'); }
  function closeModal(el) { if (el) el.classList.remove('active'); }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close-modal');
      closeModal(document.getElementById(id));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    }
  });

  // -------------------------------------------------------------
  // [4. API 통신 모듈]
  // -------------------------------------------------------------
  async function apiRequest(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Access-Code': state.authCode,
      ...(options.headers || {})
    };

    try {
      const response = await fetch(endpoint, { ...options, headers });
      const data = await response.json();

      if (response.status === 401) {
        showToast('교사 보안 인증이 필요합니다.', 'error');
        openModal(DOM.modalAuth);
        throw new Error(data.message || '인증 필요');
      }

      if (!response.ok) throw new Error(data.message || '요청 실패');
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // [5. 데이터 로드 및 요약 갱신]
  // -------------------------------------------------------------
  async function loadConfig() {
    try {
      const res = await apiRequest('/api/config');
      state.todayStr = res.today;
      if (!state.selectedDate) state.selectedDate = res.today;
      DOM.inputRecordDate.value = state.selectedDate;
      state.classes = res.classes || state.classes;
      DOM.headerInstitution.textContent = res.institutionName;

      // 데이터베이스 연동 배지 갱신
      if (res.isFirebaseConnected) {
        DOM.dbStatusBadge.className = 'db-indicator connected';
        DOM.dbStatusText.textContent = 'Firestore 연동됨';
        DOM.dbStatusBadge.title = 'Firebase Cloud Firestore 실시간 동기화 중 (Spark 무료 플랜)';
      } else {
        DOM.dbStatusBadge.className = 'db-indicator local';
        DOM.dbStatusText.textContent = '로컬 DB';
        DOM.dbStatusBadge.title = '로컬 고속 데이터베이스 동작 중 (클릭 시 Firebase 연동 안내)';
      }
    } catch (e) {
      console.warn('Config load fallback:', e);
      state.selectedDate = new Date().toISOString().split('T')[0];
      DOM.inputRecordDate.value = state.selectedDate;
    }
  }

  async function refreshSummaryAndRoster() {
    try {
      const date = state.selectedDate;
      const classId = state.selectedClass;

      const res = await apiRequest(`/api/records/summary?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(classId)}`);

      state.classesMatrix = res.classesMatrix || [];
      state.students = res.students || [];

      // 1) 반 탭 바 렌더링
      renderClassTabs();

      // 2) 날짜 뱃지 및 라벨 갱신
      updateDateControls();

      // 3) 요약 카드 3개 갱신
      const cs = res.classSummary;
      DOM.summaryCardClassName.textContent = `${cs.className} 회수 현황`;
      DOM.summaryCardDateBadge.textContent = state.selectedDate;
      DOM.metricClassReturned.textContent = cs.returnedCount;
      DOM.metricClassTotal.textContent = cs.totalStudents;
      DOM.summaryCardRateText.textContent = `회수율 ${cs.rate}% (${cs.returnedCount}명 반납 완료)`;
      DOM.progressClassFill.style.width = `${cs.rate}%`;

      DOM.summaryCardPendingName.textContent = `${cs.className} 미회수 인원`;
      DOM.metricClassPending.textContent = cs.pendingCount;
      const pendingRate = cs.totalStudents > 0 ? Math.round((cs.pendingCount / cs.totalStudents) * 100) : 0;
      DOM.progressPendingFill.style.width = `${pendingRate}%`;

      const all = res.allSummary;
      DOM.metricAllReturned.textContent = all.returnedCount;
      DOM.metricAllTotal.textContent = all.totalStudents;
      DOM.summaryAllRateText.textContent = `선택일 전체 학년 평균 회수율 ${all.rate}%`;
      DOM.progressAllFill.style.width = `${all.rate}%`;

      // 4) 명부 헤더 및 일괄 버튼 라벨 갱신
      DOM.rosterClassHeading.textContent = cs.className;
      DOM.activeClassTitleTag.textContent = `현재 선택: ${cs.className}`;
      DOM.labelBatchClassBtn.textContent = `${cs.className} 전원 회수 완료`;
      DOM.formClassSelect.value = state.selectedClass !== 'all' ? state.selectedClass : '201';

      // 5) 필터 카운트 및 학생 명부 렌더링
      updateFilterCounts();
      renderStudentRoster();

      // 만약 이력 모달이 현재 열려있다면 모달 내부도 함께 갱신
      if (state.selectedStudentId && DOM.modalStudentHistory.classList.contains('active')) {
        loadStudentHistory(state.selectedStudentId);
      }

      // 만약 회수/미회수 간략 명단 모달이 열려있다면 내부 목록도 함께 갱신
      if (DOM.modalStatusBreakdown && DOM.modalStatusBreakdown.classList.contains('active')) {
        renderBreakdownList(state.breakdownMode);
      }

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // [6. 반 선택 탭 바 렌더링]
  // -------------------------------------------------------------
  function renderClassTabs() {
    DOM.classTabContainer.innerHTML = '';

    state.classesMatrix.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = state.selectedClass === item.classId;
      const isComplete = item.isAllReturned;

      btn.className = `class-tab-btn ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

      const badgeText = isComplete ? '✓ 전원완료' : `${item.returned}/${item.total}명 (${item.rate}%)`;

      btn.innerHTML = `
        <span class="tab-title">${item.classId}반</span>
        <span class="tab-badge">${badgeText}</span>
      `;

      btn.addEventListener('click', () => {
        state.selectedClass = item.classId;
        refreshSummaryAndRoster();
      });

      DOM.classTabContainer.appendChild(btn);
    });

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    const isAllActive = state.selectedClass === 'all';
    allBtn.className = `class-tab-btn ${isAllActive ? 'active' : ''}`;
    allBtn.style.minWidth = '110px';
    const totalCountAll = state.classesMatrix.reduce((sum, c) => sum + (c.total || 0), 0);
    allBtn.innerHTML = `
      <span class="tab-title">전체 보기</span>
      <span class="tab-badge">8개 학급 ${totalCountAll}명</span>
    `;
    allBtn.addEventListener('click', () => {
      state.selectedClass = 'all';
      refreshSummaryAndRoster();
    });
    DOM.classTabContainer.appendChild(allBtn);
  }

  // -------------------------------------------------------------
  // [7. 날짜 컨트롤]
  // -------------------------------------------------------------
  function updateDateControls() {
    DOM.inputRecordDate.value = state.selectedDate;
    if (state.selectedDate === state.todayStr) {
      DOM.btnDateToday.classList.add('active-today');
    } else {
      DOM.btnDateToday.classList.remove('active-today');
    }
  }

  function shiftDate(days) {
    const current = new Date(state.selectedDate || state.todayStr);
    current.setDate(current.getDate() + days);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    state.selectedDate = `${y}-${m}-${d}`;
    refreshSummaryAndRoster();
  }

  DOM.btnDatePrev.addEventListener('click', () => shiftDate(-1));
  DOM.btnDateNext.addEventListener('click', () => shiftDate(1));
  DOM.btnDateToday.addEventListener('click', () => {
    state.selectedDate = state.todayStr;
    refreshSummaryAndRoster();
  });
  DOM.inputRecordDate.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    refreshSummaryAndRoster();
  });

  // -------------------------------------------------------------
  // [8. 반 전원 일괄 회수 및 초기화]
  // -------------------------------------------------------------
  DOM.btnBatchComplete.addEventListener('click', async () => {
    if (state.selectedClass === 'all') {
      showToast('상단에서 특정 학급(예: 201반)을 먼저 선택해주세요.', 'info');
      return;
    }

    try {
      const res = await apiRequest('/api/records/class-batch', {
        method: 'POST',
        body: JSON.stringify({
          classId: state.selectedClass,
          date: state.selectedDate,
          returned: true
        })
      });
      showToast(res.message, 'success');
      await refreshSummaryAndRoster();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  DOM.btnBatchReset.addEventListener('click', async () => {
    if (state.selectedClass === 'all') {
      showToast('상단에서 특정 학급을 먼저 선택해주세요.', 'info');
      return;
    }
    const confirmed = confirm(`${state.selectedClass}반의 ${state.selectedDate} 회수 기록을 모두 초기화하시겠습니까?`);
    if (!confirmed) return;

    try {
      const res = await apiRequest('/api/records/class-batch', {
        method: 'POST',
        body: JSON.stringify({
          classId: state.selectedClass,
          date: state.selectedDate,
          returned: false
        })
      });
      showToast(res.message, 'success');
      await refreshSummaryAndRoster();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // -------------------------------------------------------------
  // [9. 학생 명부 및 학생 클릭 시 이력 팝업 (⭐ 핵심 요구사항)]
  // -------------------------------------------------------------
  function updateFilterCounts() {
    const total = state.students.length;
    const returned = state.students.filter(s => s.returnedOnDate).length;
    const pending = total - returned;

    DOM.filterCountAll.textContent = total;
    DOM.filterCountReturned.textContent = returned;
    DOM.filterCountPending.textContent = pending;
  }

  function renderStudentRoster() {
    const query = state.searchQuery.toLowerCase().trim();
    let filtered = state.students.filter(student => {
      if (state.activeFilter === 'returned' && !student.returnedOnDate) return false;
      if (state.activeFilter === 'pending' && student.returnedOnDate) return false;
      if (query) {
        const nameMatch = student.name.toLowerCase().includes(query);
        const numMatch = String(student.studentNum).includes(query);
        const fullMatch = student.studentNumber.includes(query);
        if (!nameMatch && !numMatch && !fullMatch) return false;
      }
      return true;
    });

    DOM.studentTableBody.innerHTML = '';

    if (filtered.length === 0) {
      DOM.rosterEmptyState.style.display = 'block';
      DOM.emptyStateMsg.textContent = state.students.length === 0
        ? '등록된 학생이 없습니다.'
        : '조건에 일치하는 학생이 없습니다.';
      return;
    }

    DOM.rosterEmptyState.style.display = 'none';

    filtered.forEach(student => {
      const tr = document.createElement('tr');

      // 1) 번호 열 (클릭 시 이력 열기)
      const tdNum = document.createElement('td');
      tdNum.style.whiteSpace = 'nowrap';
      tdNum.innerHTML = `<span class="student-num-badge" style="cursor: pointer;" title="클릭하여 ${escapeHtml(student.name)} 학생 이력 보기">${student.studentNum}번</span>`;
      tdNum.addEventListener('click', () => openStudentHistory(student.id));

      // 2) 학생 이름 열 (클릭 시 이력 팝업 ⭐)
      const tdName = document.createElement('td');
      tdName.style.whiteSpace = 'nowrap';
      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'student-name-btn';
      nameBtn.title = `클릭하여 ${escapeHtml(student.name)} 학생의 전체 반납 이력 조회`;
      nameBtn.innerHTML = `
        <span class="student-name-text">${escapeHtml(student.name)}</span>
        <span class="history-badge">이력 📋</span>
        ${state.selectedClass === 'all' ? `<span class="class-sub-badge">${student.classId}반</span>` : ''}
      `;
      nameBtn.addEventListener('click', () => openStudentHistory(student.id));
      tdName.appendChild(nameBtn);

      // 3) 학번 열
      const tdFullNum = document.createElement('td');
      tdFullNum.style.whiteSpace = 'nowrap';
      tdFullNum.style.fontFamily = 'monospace';
      tdFullNum.style.color = 'var(--color-ink-muted-48)';
      tdFullNum.textContent = student.studentNumber;

      // 4) 줄넘기 회수 상태 열 (1-클릭 토글 버튼)
      const tdStatus = document.createElement('td');
      tdStatus.style.whiteSpace = 'nowrap';
      tdStatus.style.textAlign = 'center';
      const isRet = student.returnedOnDate;
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = `btn-quick-toggle ${isRet ? 'returned' : 'pending'}`;
      toggleBtn.title = isRet ? '클릭 시 미회수로 전환' : '클릭 시 회수 완료로 전환';
      toggleBtn.innerHTML = isRet ? '회수 완료 ✓' : '미회수 ⏳';

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 이름 클릭 이벤트와 분리
        handleQuickToggle(student.id);
      });
      tdStatus.appendChild(toggleBtn);

      tr.appendChild(tdNum);
      tr.appendChild(tdName);
      tr.appendChild(tdFullNum);
      tr.appendChild(tdStatus);

      DOM.studentTableBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 1-클릭 빠른 토글
  async function handleQuickToggle(studentId, specificDate) {
    try {
      const targetDate = specificDate || state.selectedDate;
      const res = await apiRequest('/api/records/quick-toggle', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          date: targetDate
        })
      });
      showToast(res.message, 'success');
      await refreshSummaryAndRoster();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // [10. 학생별 이력 팝업 상세 모달 기능 (⭐ 애를 누르면 이력 뜨는 기능)]
  // -------------------------------------------------------------
  async function openStudentHistory(studentId) {
    state.selectedStudentId = studentId;
    openModal(DOM.modalStudentHistory);

    // 모달 로딩 표시
    DOM.historyModalName.textContent = '불러오는 중...';
    DOM.historyRecordsTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">이력을 불러오는 중입니다...</td></tr>';

    await loadStudentHistory(studentId);
  }

  async function loadStudentHistory(studentId) {
    try {
      const res = await apiRequest(`/api/students/${studentId}/history`);
      const student = res.student;
      const stats = res.stats;
      const records = res.records;

      // 헤더 프로필 갱신
      DOM.historyModalName.textContent = `${student.name} 학생`;
      DOM.historyModalClassBadge.textContent = `${student.classId}반 ${student.studentNum}번 (학번: ${student.studentNumber})`;

      // 통계 지표 갱신
      DOM.historyStatTotal.textContent = `${stats.totalRecords}회`;
      DOM.historyStatReturned.textContent = `${stats.returnedCount}회 (${stats.returnRate}%)`;
      DOM.historyStatPending.textContent = `${stats.pendingCount}회`;

      // 메모 갱신
      DOM.historyStudentNote.value = student.note || '';

      // 날짜별 이력 목록 렌더링
      DOM.historyRecordsTbody.innerHTML = '';

      if (!records || records.length === 0) {
        DOM.historyRecordsTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 24px; color: var(--color-ink-muted-48);">아직 저장된 반납 이력이 없습니다.</td></tr>';
        return;
      }

      records.forEach(rec => {
        const tr = document.createElement('tr');
        const isRet = rec.returned === true;

        // 요일 계산
        const dateObj = new Date(rec.date + 'T00:00:00');
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeek = dayNames[dateObj.getDay()] || '';
        const isSelectedDate = rec.date === state.selectedDate;

        tr.innerHTML = `
          <td style="padding: 10px 12px; font-weight: 600;">
            ${rec.date} (${dayOfWeek})
            ${isSelectedDate ? '<span style="font-size: 10px; color: var(--color-primary); background: var(--color-primary-light); padding: 2px 4px; border-radius: 4px; margin-left: 4px;">선택일</span>' : ''}
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <span class="card-badge ${isRet ? 'green' : 'orange'}">
              ${isRet ? '회수 완료 ✓' : '미회수 ⏳'}
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: right;">
            <button type="button" class="date-btn" style="padding: 4px 10px; font-size: 12px;" title="${rec.date} 상태 전환">
              ${isRet ? '미회수로 변경' : '회수 완료로 변경'}
            </button>
          </td>
        `;

        // 모달 안에서도 해당 날짜 상태 즉시 전환
        const changeBtn = tr.querySelector('button');
        changeBtn.addEventListener('click', async () => {
          await handleQuickToggle(studentId, rec.date);
          await loadStudentHistory(studentId);
        });

        DOM.historyRecordsTbody.appendChild(tr);
      });

    } catch (err) {
      DOM.historyRecordsTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red; padding: 20px;">이력을 불러오지 못했습니다: ${err.message}</td></tr>`;
    }
  }

  // 교사용 메모 저장
  DOM.btnSaveStudentNote.addEventListener('click', async () => {
    if (!state.selectedStudentId) return;
    const note = DOM.historyStudentNote.value.trim();

    try {
      const res = await apiRequest(`/api/students/${state.selectedStudentId}/note`, {
        method: 'POST',
        body: JSON.stringify({ note })
      });
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // -------------------------------------------------------------
  // [11. 수기 폼 등록 및 필터/검색]
  // -------------------------------------------------------------
  DOM.checkReturnStatus.addEventListener('change', () => {
    DOM.toggleStatusLabel.textContent = DOM.checkReturnStatus.checked ? '줄넘기 회수 완료' : '미회수 (대기)';
  });

  DOM.returnEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const classId = DOM.formClassSelect.value;
    const studentNum = DOM.inputStudentNum.value.trim();
    const name = DOM.inputStudentName.value.trim();
    const isReturned = DOM.checkReturnStatus.checked;

    if (!name) {
      showToast('학생 이름을 입력해주세요.', 'error');
      DOM.inputStudentName.focus();
      return;
    }

    try {
      DOM.btnSaveRecord.disabled = true;
      const res = await apiRequest('/api/records', {
        method: 'POST',
        body: JSON.stringify({
          classId,
          studentNum,
          name,
          returned: isReturned,
          date: state.selectedDate
        })
      });

      showToast(res.message, 'success');
      DOM.inputStudentName.value = '';
      DOM.inputStudentNum.value = '';

      state.selectedClass = classId;
      await refreshSummaryAndRoster();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      DOM.btnSaveRecord.disabled = false;
    }
  });

  // 필터 탭 클릭
  DOM.filterPillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.filterPillBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.activeFilter = btn.getAttribute('data-filter');
      renderStudentRoster();
    });
  });

  // 검색
  DOM.inputSearchStudent.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderStudentRoster();
  });

  // 모달 링크들
  DOM.linkOpenPrivacyModal.addEventListener('click', () => openModal(DOM.modalPrivacy));
  DOM.linkOpenTermsModal.addEventListener('click', () => openModal(DOM.modalTerms));
  DOM.btnOpenAuthModal.addEventListener('click', () => openModal(DOM.modalAuth));

  DOM.btnSubmitAuth.addEventListener('click', async () => {
    const code = DOM.inputAuthCode.value.trim();
    try {
      const res = await apiRequest('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      state.authCode = code;
      sessionStorage.setItem('pe_teacher_access_code', code);
      closeModal(DOM.modalAuth);
      showToast(res.message, 'success');
      refreshSummaryAndRoster();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 감사 로그
  async function openAuditLog() {
    openModal(DOM.modalAudit);
    try {
      const res = await apiRequest('/api/logs/audit');
      DOM.auditLogTbody.innerHTML = '';
      (res.logs || []).forEach(l => {
        const tr = document.createElement('tr');
        const time = new Date(l.timestamp).toLocaleTimeString('ko-KR');
        tr.innerHTML = `
          <td>${time}</td>
          <td><strong>${escapeHtml(l.action)}</strong></td>
          <td>${escapeHtml(l.details)}</td>
        `;
        DOM.auditLogTbody.appendChild(tr);
      });
    } catch (e) {
      DOM.auditLogTbody.innerHTML = `<tr><td colspan="3">${e.message}</td></tr>`;
    }
  }

  DOM.btnOpenAuditLog.addEventListener('click', openAuditLog);
  DOM.btnOpenAuditFooter.addEventListener('click', openAuditLog);

  // 백업 다운로드
  DOM.btnExportBackup.addEventListener('click', async () => {
    showToast('전체 8개 반 백업 파일을 준비 중입니다...', 'info');
    window.location.href = '/api/backup/export';
  });

  // Firebase 연동 상태 확인 및 모달 제어
  async function checkFirebaseStatus(isRecheck = false) {
    try {
      DOM.firebaseGuideStatusTag.textContent = '확인 중...';
      DOM.firebaseGuideStatusTag.className = 'status-tag tag-pending';
      DOM.firebaseGuideStatusDesc.textContent = '서버 및 Firestore 상태를 조회하고 있습니다...';

      let res;
      if (isRecheck) {
        res = await apiRequest('/api/firebase/recheck', { method: 'POST' });
      } else {
        res = await apiRequest('/api/firebase/status');
      }

      if (res.connected) {
        DOM.firebaseGuideStatusTag.textContent = '연동 완료 (정상 동기화)';
        DOM.firebaseGuideStatusTag.className = 'status-tag tag-returned';
        DOM.firebaseGuideStatusDesc.innerHTML = `<strong>🔥 Firebase Firestore 연결 성공!</strong> (프로젝트: <code>${escapeHtml(res.projectId || 'Spark 무료')}</code>)<br>학생 반납 체크 시 구글 클라우드에 실시간으로 안전하게 저장됩니다. (Spark 100% 무료 플랜)`;
        DOM.dbStatusBadge.className = 'db-indicator connected';
        DOM.dbStatusText.textContent = 'Firestore 연동됨';
      } else {
        DOM.firebaseGuideStatusTag.textContent = '연동 대기 중';
        DOM.firebaseGuideStatusTag.className = 'status-tag tag-pending';
        DOM.firebaseGuideStatusDesc.innerHTML = `${escapeHtml(res.message)}<br><span style="color: var(--color-ink-muted-48); font-size: 12px; margin-top: 4px; display: inline-block;">아래 6단계 안내에 따라 <code>serviceAccountKey.json</code> 파일을 프로젝트 폴더에 넣어주세요.</span>`;
        DOM.dbStatusBadge.className = 'db-indicator local';
        DOM.dbStatusText.textContent = '로컬 DB';
      }
    } catch (e) {
      DOM.firebaseGuideStatusTag.textContent = '확인 실패';
      DOM.firebaseGuideStatusTag.className = 'status-tag tag-pending';
      DOM.firebaseGuideStatusDesc.textContent = `연동 상태 확인 중 오류: ${e.message}`;
    }
  }

  DOM.dbStatusBadge.addEventListener('click', () => {
    openModal(DOM.modalFirebaseGuide);
    checkFirebaseStatus();
  });
  DOM.btnOpenFirebaseGuide.addEventListener('click', () => {
    openModal(DOM.modalFirebaseGuide);
    checkFirebaseStatus();
  });
  DOM.btnRecheckFirebase.addEventListener('click', async () => {
    await checkFirebaseStatus(true);
    showToast('Firebase 연결 상태를 다시 확인했습니다.', 'info');
  });

  // -------------------------------------------------------------
  // [11. 회수 현황 / 미회수 인원 클릭 시 간략 명단 모달 (⭐ 신규 기능)]
  // -------------------------------------------------------------
  function openStatusBreakdown(mode = 'returned') {
    state.breakdownMode = mode;
    openModal(DOM.modalStatusBreakdown);
    renderBreakdownList(mode);
  }

  function renderBreakdownList(mode) {
    if (!DOM.modalStatusBreakdown) return;
    state.breakdownMode = mode;

    const isReturned = mode === 'returned';

    // 1) 탭 활성화 상태 동기화
    if (isReturned) {
      if (DOM.btnBreakdownTabReturned) DOM.btnBreakdownTabReturned.classList.add('active');
      if (DOM.btnBreakdownTabPending) DOM.btnBreakdownTabPending.classList.remove('active');
      const classTitle = state.selectedClass === 'all' ? '전체 학급' : `${state.selectedClass}반`;
      if (DOM.statusBreakdownTitle) DOM.statusBreakdownTitle.textContent = `${classTitle} 줄넘기 회수 완료 명단`;
      if (DOM.statusBreakdownBadge) DOM.statusBreakdownBadge.className = 'card-badge green';
    } else {
      if (DOM.btnBreakdownTabReturned) DOM.btnBreakdownTabReturned.classList.remove('active');
      if (DOM.btnBreakdownTabPending) DOM.btnBreakdownTabPending.classList.add('active');
      const classTitle = state.selectedClass === 'all' ? '전체 학급' : `${state.selectedClass}반`;
      if (DOM.statusBreakdownTitle) DOM.statusBreakdownTitle.textContent = `${classTitle} 줄넘기 미회수 학생 명단`;
      if (DOM.statusBreakdownBadge) DOM.statusBreakdownBadge.className = 'card-badge orange';
    }

    const currentClassText = state.selectedClass === 'all' ? '전체 학급' : `${state.selectedClass}반`;
    if (DOM.statusBreakdownSubtitle) {
      DOM.statusBreakdownSubtitle.textContent = `${currentClassText} · ${state.selectedDate} 기준 (총 ${state.students.length}명)`;
    }

    // 2) 회수 / 미회수 카운트 계산
    const returnedStudents = state.students.filter(s => s.isReturned);
    const pendingStudents = state.students.filter(s => !s.isReturned);

    if (DOM.breakdownCountReturned) DOM.breakdownCountReturned.textContent = returnedStudents.length;
    if (DOM.breakdownCountPending) DOM.breakdownCountPending.textContent = pendingStudents.length;

    const listToDisplay = isReturned ? returnedStudents : pendingStudents;
    if (DOM.statusBreakdownBadge) DOM.statusBreakdownBadge.textContent = `${listToDisplay.length}명`;

    // 3) 학생 리스트 렌더링
    if (DOM.breakdownStudentsList) {
      DOM.breakdownStudentsList.innerHTML = '';

      if (listToDisplay.length === 0) {
        if (DOM.breakdownEmptyMsg) {
          DOM.breakdownEmptyMsg.style.display = 'block';
          const p = DOM.breakdownEmptyMsg.querySelector('p');
          if (p) {
            p.textContent = isReturned
              ? '아직 줄넘기 회수가 완료된 학생이 없습니다.'
              : '🎉 축하합니다! 모든 학생이 줄넘기 반납을 완료했습니다.';
          }
        }
        return;
      }

      if (DOM.breakdownEmptyMsg) DOM.breakdownEmptyMsg.style.display = 'none';

      listToDisplay.forEach(student => {
        const item = document.createElement('div');
        item.className = 'breakdown-student-item';

        const classLabel = state.selectedClass === 'all' ? `${student.classId}반 ` : '';
        const numLabel = `${student.studentNum}번`;

        item.innerHTML = `
          <div class="breakdown-student-left" title="클릭하여 ${escapeHtml(student.name)} 학생 상세 이력 보기">
            <span class="student-num-badge">${classLabel}${numLabel}</span>
            <div>
              <div class="breakdown-student-name">${escapeHtml(student.name)}</div>
              <div class="breakdown-student-num">학번: ${escapeHtml(student.studentNumber)}</div>
            </div>
          </div>
          <div>
            <button type="button" class="btn-quick-toggle ${student.isReturned ? 'returned' : 'pending'}" style="min-width: 90px; padding: 5px 12px; font-size: 12px;" title="클릭하여 즉시 반납 상태 전환">
              ${student.isReturned ? '✓ 반납 완료' : '⏳ 미회수'}
            </button>
          </div>
        `;

        // 왼쪽 학생 이름/번호 클릭 시 개인별 반납 이력 모달 팝업
        const leftEl = item.querySelector('.breakdown-student-left');
        if (leftEl) {
          leftEl.addEventListener('click', () => {
            openStudentHistory(student.id);
          });
        }

        // 오른쪽 빠른 토글 버튼 클릭 시 즉시 반납 상태 토글
        const toggleBtn = item.querySelector('.btn-quick-toggle');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleQuickToggle(student.id);
          });
        }

        DOM.breakdownStudentsList.appendChild(item);
      });
    }
  }

  // 브레이크다운 모달 탭 클릭 리스너
  if (DOM.btnBreakdownTabReturned) {
    DOM.btnBreakdownTabReturned.addEventListener('click', () => {
      renderBreakdownList('returned');
    });
  }
  if (DOM.btnBreakdownTabPending) {
    DOM.btnBreakdownTabPending.addEventListener('click', () => {
      renderBreakdownList('pending');
    });
  }

  // 텍스트 복사 헬퍼
  function fallbackCopyText(text, titleLabel) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(`📋 ${titleLabel} 명단이 클립보드에 복사되었습니다!`, 'success');
    } catch (err) {
      showToast('명단 복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textarea);
  }

  // 명단 복사 버튼
  if (DOM.btnCopyBreakdownList) {
    DOM.btnCopyBreakdownList.addEventListener('click', () => {
      const isReturned = state.breakdownMode === 'returned';
      const targetList = state.students.filter(s => isReturned ? s.isReturned : !s.isReturned);
      const classLabel = state.selectedClass === 'all' ? '고2 전체 학급' : `${state.selectedClass}반`;
      const titleLabel = isReturned ? '회수 완료' : '미회수';

      if (targetList.length === 0) {
        showToast('복사할 학생 명단이 없습니다.', 'info');
        return;
      }

      const namesStr = targetList.map(s => {
        const prefix = state.selectedClass === 'all' ? `[${s.classId}반] ` : '';
        return `${prefix}${s.studentNum}번 ${s.name}`;
      }).join(', ');

      const copyText = `[${classLabel} 줄넘기 ${titleLabel} 명단 (${targetList.length}명)]\n${namesStr}\n(기준일자: ${state.selectedDate})`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText).then(() => {
          showToast(`📋 ${titleLabel} 명단이 클립보드에 복사되었습니다!`, 'success');
        }).catch(() => {
          fallbackCopyText(copyText, titleLabel);
        });
      } else {
        fallbackCopyText(copyText, titleLabel);
      }
    });
  }

  // 상단 요약 카드 클릭 이벤트 연결 (⭐ 회수 현황 & 미회수 인원 숫자 클릭 시 간략 명단 팝업)
  if (DOM.cardClassSummary) {
    DOM.cardClassSummary.addEventListener('click', () => {
      openStatusBreakdown('returned');
    });
    DOM.cardClassSummary.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openStatusBreakdown('returned');
      }
    });
  }

  if (DOM.cardClassPending) {
    DOM.cardClassPending.addEventListener('click', () => {
      openStatusBreakdown('pending');
    });
    DOM.cardClassPending.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openStatusBreakdown('pending');
      }
    });
  }

  if (DOM.cardAllClasses) {
    DOM.cardAllClasses.addEventListener('click', () => {
      state.selectedClass = 'all';
      refreshSummaryAndRoster().then(() => {
        openStatusBreakdown('returned');
      });
    });
    DOM.cardAllClasses.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        state.selectedClass = 'all';
        refreshSummaryAndRoster().then(() => {
          openStatusBreakdown('returned');
        });
      }
    });
  }

  // -------------------------------------------------------------
  // [12. 시작]
  // -------------------------------------------------------------
  async function init() {
    await loadConfig();
    await refreshSummaryAndRoster();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
