/**
 * Google Sheets 동기화 테스트 스크립트
 * 
 * API 엔드포인트를 직접 호출하여 동기화를 테스트합니다.
 * 
 * 실행 방법:
 * npx tsx scripts/test-sync-sheets.ts [local|production]
 */

const API_URL = process.argv[2] === 'local' 
  ? 'http://localhost:3000'
  : process.env.API_URL || 'https://qc-dashboard-wlof52lhea-du.a.run.app';

async function testSync() {
  try {
    console.log('🧪 Google Sheets 동기화 테스트\n');
    console.log(`API URL: ${API_URL}/api/sync-sheets\n`);

    const startTime = Date.now();
    
    const response = await fetch(`${API_URL}/api/sync-sheets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 동기화 실패:');
      console.error(`   상태 코드: ${response.status}`);
      console.error(`   오류 메시지: ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log('✅ 동기화 성공!\n');
    console.log('📊 결과:');
    console.log(`   메시지: ${result.message}`);
    if (result.summary) {
      console.log(`   전체 데이터: ${result.summary.total}건`);
      console.log(`   기존 데이터: ${result.summary.existing}건`);
      console.log(`   새 데이터: ${result.summary.new}건`);
      console.log(`   저장된 데이터: ${result.summary.saved}건`);
    }
    console.log(`   소요 시간: ${duration}초`);
    console.log(`   타임스탬프: ${result.timestamp}\n`);

    if (result.summary && result.summary.saved === 0) {
      console.log('ℹ️  새로운 데이터가 없습니다. 이미 동기화가 완료된 상태입니다.');
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    if (error instanceof Error) {
      console.error('   오류 메시지:', error.message);
    }
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  testSync()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 테스트 실패:', error);
      process.exit(1);
    });
}

export { testSync };
