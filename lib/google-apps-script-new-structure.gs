// ============================================
// QC 관리 시스템 - Google Apps Script (새 데이터 구조)
// agg_agent_daily, weekly, daily_14d 시트에서 데이터 읽기
// ============================================

// 설정값
const WEBAPP_URL = 'https://kmcc-qc-dashbord.vercel.app/api/sync';

const DAILY_SHEET = 'agg_agent_daily';
const WEEKLY_SHEET = 'weekly';
const DAILY_14D_SHEET = 'daily_14d';

/**
 * 메뉴 추가
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('QC 대시보드')
    .addItem('지금 동기화', 'syncData')
    .addItem('연결 테스트', 'testConnection')
    .addToUi();
}

/**
 * 데이터 동기화 - 새 데이터 구조
 */
function syncData() {
  try {
    Logger.log('[v0] ===== 동기화 시작 (새 데이터 구조) =====');
    
    // agg_agent_daily 시트에서 데이터 읽기
    const dailyData = readDailySheetData();
    Logger.log(`[v0] 일별 데이터: ${dailyData.length}건`);
    
    // 배치 처리로 전송
    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(dailyData.length / BATCH_SIZE);
    
    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, dailyData.length);
      const batch = dailyData.slice(startIdx, endIdx);
      
      const batchNumber = i + 1;
      const isLast = (i === totalBatches - 1);
      
      const payload = {
        batch: batchNumber,
        isLast: isLast,
        processedSoFar: endIdx,
        totalRecords: dailyData.length,
        data: batch
      };
      
      Logger.log(`[v0] 배치 ${batchNumber}/${totalBatches}: ${batch.length}건 전송 중...`);
      sendToWebApp(payload);
      
      // API rate limit 방지
      if (!isLast) {
        Utilities.sleep(100);
      }
    }
    
    Logger.log('[v0] ===== 동기화 완료 =====');
  } catch (error) {
    Logger.log(`[v0] ❌ 오류: ${error.message}`);
    Logger.log(`[v0] 스택: ${error.stack}`);
  }
}

/**
 * agg_agent_daily 시트에서 데이터 읽기
 */
function readDailySheetData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DAILY_SHEET);
  if (!sheet) {
    throw new Error(DAILY_SHEET + ' 시트를 찾을 수 없습니다.');
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('[v0] 데이터가 없습니다.');
    return [];
  }
  
  const headers = data[0];
  const records = [];
  
  // 헤더 인덱스 찾기 (유연하게)
  const findHeaderIndex = (possibleNames) => {
    for (const name of possibleNames) {
      const idx = headers.findIndex(h => 
        String(h).trim().toLowerCase() === name.toLowerCase() ||
        String(h).trim().includes(name)
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };
  
  const dateIdx = findHeaderIndex(['평가일', '날짜', 'date', 'eval_date']);
  const agentIdIdx = findHeaderIndex(['상담사id', '상담사ID', 'agent_id', 'agentId', 'id']);
  const centerIdx = findHeaderIndex(['센터명', '센터', 'center', 'center_name']);
  const groupIdx = findHeaderIndex(['그룹명', '그룹', '서비스', 'service', 'group', 'group_name']);
  const tenureIdx = findHeaderIndex(['근속기간', '근속', 'tenure']);
  
  const attitudeErrCntIdx = findHeaderIndex(['attitude_err_cnt', '태도오류건수', '태도오류']);
  const opsErrCntIdx = findHeaderIndex(['ops_err_cnt', '오상담오처리건수', '오상담오처리']);
  const totalErrCntIdx = findHeaderIndex(['total_err_cnt', '전체오류건수', '전체오류']);
  
  const attitudeErrRateIdx = findHeaderIndex(['attitude_err_rate', '태도오류율', '태도오류비중']);
  const opsErrRateIdx = findHeaderIndex(['ops_err_rate', '오상담오처리율', '오상담오처리비중']);
  const totalErrRateIdx = findHeaderIndex(['total_err_rate', '전체오류율', '전체오류비중']);
  
  // 필수 컬럼 확인
  if (dateIdx < 0 || agentIdIdx < 0) {
    throw new Error('필수 컬럼(평가일, 상담사ID)을 찾을 수 없습니다.');
  }
  
  Logger.log(`[v0] 헤더 매핑: 날짜=${dateIdx}, 상담사ID=${agentIdIdx}, 센터=${centerIdx}, 그룹=${groupIdx}`);
  
  // 데이터 행 순회 (헤더 제외)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // 빈 행 스킵
    if (!row[agentIdIdx]) continue;
    
    // 평가일 날짜 형식 통일 (YYYY-MM-DD)
    let evalDate = '';
    if (row[dateIdx]) {
      try {
        const dateValue = row[dateIdx];
        let dateObj;
        
        // 이미 Date 객체인 경우
        if (dateValue instanceof Date) {
          dateObj = dateValue;
        }
        // 문자열인 경우 파싱
        else if (typeof dateValue === 'string') {
          const dateStr = dateValue.trim();
          
          // "2025. 12. 19" 또는 "2025.12.19" 형식 처리
          if (dateStr.includes('.')) {
            const parts = dateStr.split('.').map(p => p.trim()).filter(p => p);
            if (parts.length >= 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const day = parseInt(parts[2], 10);
              dateObj = new Date(year, month - 1, day);
            } else {
              dateObj = new Date(dateStr);
            }
          }
          // "2025/12/19" 형식
          else if (dateStr.includes('/')) {
            const parts = dateStr.split('/').map(p => p.trim());
            if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const day = parseInt(parts[2], 10);
              dateObj = new Date(year, month - 1, day);
            } else {
              dateObj = new Date(dateStr);
            }
          }
          // "2025-12-19" 형식
          else if (dateStr.includes('-')) {
            dateObj = new Date(dateStr);
          }
          // 기타 형식
          else {
            dateObj = new Date(dateStr);
          }
        }
        // 숫자 타임스탬프인 경우
        else if (typeof dateValue === 'number') {
          dateObj = new Date(dateValue);
        }
        // 그 외의 경우
        else {
          dateObj = new Date(dateValue);
        }
        
        // 유효한 날짜인지 확인
        if (isNaN(dateObj.getTime())) {
          Logger.log(`[v0] 잘못된 날짜 형식: ${dateValue} (행 ${i + 1})`);
          continue;
        }
        
        // YYYY-MM-DD 형식으로 변환
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        evalDate = `${year}-${month}-${day}`;
      } catch (e) {
        Logger.log(`[v0] 날짜 파싱 오류: ${row[dateIdx]} (행 ${i + 1}): ${e.message}`);
        continue;
      }
    }
    
    // 평가일이 없으면 스킵
    if (!evalDate) {
      continue;
    }
    
    // 데이터 추출
    const record = {
      date: evalDate,
      agentId: String(row[agentIdIdx] || '').trim(),
      agentName: String(row[findHeaderIndex(['상담사명', '이름', 'name', 'agent_name'])] || '').trim(),
      center: centerIdx >= 0 ? String(row[centerIdx] || '').trim() : '',
      group: groupIdx >= 0 ? String(row[groupIdx] || '').trim() : '',
      service: groupIdx >= 0 ? String(row[groupIdx] || '').trim() : '', // 그룹 = 서비스
      tenure: tenureIdx >= 0 ? String(row[tenureIdx] || '').trim() : '',
      
      // 오류 건수
      attitudeErrors: attitudeErrCntIdx >= 0 ? (Number(row[attitudeErrCntIdx]) || 0) : 0,
      businessErrors: opsErrCntIdx >= 0 ? (Number(row[opsErrCntIdx]) || 0) : 0,
      totalErrors: totalErrCntIdx >= 0 ? (Number(row[totalErrCntIdx]) || 0) : 0,
      
      // 오류율 (비중)
      attitudeErrorRate: attitudeErrRateIdx >= 0 ? (Number(row[attitudeErrRateIdx]) || 0) : 0,
      businessErrorRate: opsErrRateIdx >= 0 ? (Number(row[opsErrRateIdx]) || 0) : 0,
      totalErrorRate: totalErrRateIdx >= 0 ? (Number(row[totalErrRateIdx]) || 0) : 0,
      
      timestamp: new Date().toISOString()
    };
    
    records.push(record);
  }
  
  return records;
}

/**
 * 웹앱으로 데이터 전송
 */
function sendToWebApp(payload) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    Logger.log('[v0] 웹앱 URL: ' + WEBAPP_URL);
    Logger.log('[v0] 페이로드 크기: ' + JSON.stringify(payload).length + ' bytes');
    
    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('[v0] 응답 코드: ' + responseCode);
    Logger.log('[v0] 응답 본문 (처음 200자): ' + responseText.substring(0, 200));
    
    if (responseCode !== 200) {
      let errorMessage = 'HTTP ' + responseCode + ' 오류';
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch (e) {
        errorMessage = responseText.substring(0, 500);
      }
      throw new Error(errorMessage);
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      Logger.log('[v0] JSON 파싱 실패: ' + parseError.message);
      throw new Error('응답 파싱 실패: ' + responseText.substring(0, 200));
    }
    
    if (!result.success) {
      throw new Error(result.error || '동기화 실패');
    }
    
    Logger.log('[v0] ✅ 배치 전송 성공: ' + result.message);
    return result;
  } catch (error) {
    Logger.log('[v0] sendToWebApp 오류: ' + error.message);
    Logger.log('[v0] 스택: ' + error.stack);
    throw error;
  }
}

/**
 * 연결 테스트
 */
function testConnection() {
  try {
    Logger.log('[v0] ===== 연결 테스트 시작 =====');
    const testUrl = WEBAPP_URL.replace('/sync', '/sync');
    Logger.log('[v0] 테스트 URL: ' + testUrl);
    
    const startTime = new Date().getTime();
    const response = UrlFetchApp.fetch(testUrl, {
      method: 'get',
      muteHttpExceptions: true
    });
    const endTime = new Date().getTime();
    
    const responseTime = endTime - startTime;
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('[v0] 응답 시간: ' + responseTime + 'ms');
    Logger.log('[v0] 응답 코드: ' + responseCode);
    Logger.log('[v0] 응답 본문: ' + responseText);
    
    if (responseCode === 200) {
      Logger.log('[v0] ✅ 연결 성공!');
      try {
        const data = JSON.parse(responseText);
        Logger.log('[v0] 응답 데이터: ' + JSON.stringify(data, null, 2));
      } catch (e) {
        // JSON이 아니어도 OK
      }
    } else {
      Logger.log('[v0] ❌ 연결 실패: HTTP ' + responseCode);
    }
    
    Logger.log('[v0] ===== 연결 테스트 완료 =====');
  } catch (error) {
    Logger.log('[v0] ❌ 연결 테스트 오류: ' + error.message);
  }
}

