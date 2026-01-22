/**
 * BigQuery 데이터 건수 확인 스크립트
 * 
 * 모든 테이블의 현재 데이터 건수를 확인합니다.
 * 
 * 실행 방법:
 * npx ts-node scripts/check-data-count.ts
 */

import { getBigQueryClient } from '../lib/bigquery.js'

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC'

async function checkDataCount() {
  try {
    const bigquery = getBigQueryClient()
    
    console.log('📊 BigQuery 데이터 건수 확인 중...\n')
    console.log(`데이터셋: ${DATASET_ID}\n`)
    
    // 테이블 목록
    const tables = [
      'evaluations',
      'agents',
      'metrics_daily',
      'predictions',
      'watch_list',
      'targets'
    ]
    
    const results: { table: string; count: number }[] = []
    
    // 각 테이블의 데이터 건수 확인
    for (const table of tables) {
      try {
        const query = `SELECT COUNT(*) as count FROM \`${DATASET_ID}.${table}\``
        
        const [rows] = await bigquery.query({
          query,
          location: 'asia-northeast3',
        })
        
        const count = rows[0]?.count || 0
        results.push({ table, count: Number(count) })
        
        console.log(`✅ ${table.padEnd(20)} ${count.toLocaleString()}건`)
      } catch (error: any) {
        // 테이블이 존재하지 않거나 접근할 수 없는 경우
        if (error.message?.includes('Not found') || error.message?.includes('does not exist')) {
          console.log(`❌ ${table.padEnd(20)} 테이블 없음`)
          results.push({ table, count: 0 })
        } else {
          console.error(`❌ ${table.padEnd(20)} 오류: ${error.message}`)
          results.push({ table, count: -1 })
        }
      }
    }
    
    // 요약
    console.log('\n' + '='.repeat(50))
    console.log('📈 요약')
    console.log('='.repeat(50))
    
    const totalCount = results
      .filter(r => r.count >= 0)
      .reduce((sum, r) => sum + r.count, 0)
    
    console.log(`총 데이터 건수: ${totalCount.toLocaleString()}건\n`)
    
    // 테이블별 상세 정보
    results.forEach(({ table, count }) => {
      if (count >= 0) {
        const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0.0'
        console.log(`  ${table.padEnd(20)} ${count.toLocaleString().padStart(10)}건 (${percentage}%)`)
      }
    })
    
    // 추가 통계 (evaluations 테이블이 있는 경우)
    const evaluationsResult = results.find(r => r.table === 'evaluations')
    if (evaluationsResult && evaluationsResult.count > 0) {
      try {
        console.log('\n📅 evaluations 테이블 상세 정보:')
        
        // 날짜 범위
        const dateRangeQuery = `
          SELECT 
            MIN(evaluation_date) as min_date,
            MAX(evaluation_date) as max_date,
            COUNT(DISTINCT evaluation_date) as unique_dates,
            COUNT(DISTINCT agent_id) as unique_agents,
            COUNT(DISTINCT center) as unique_centers
          FROM \`${DATASET_ID}.evaluations\`
        `
        
        const [dateRows] = await bigquery.query({
          query: dateRangeQuery,
          location: 'asia-northeast3',
        })
        
        const dateInfo = dateRows[0]
        console.log(`  - 날짜 범위: ${dateInfo.min_date?.value || dateInfo.min_date} ~ ${dateInfo.max_date?.value || dateInfo.max_date}`)
        console.log(`  - 고유 날짜 수: ${dateInfo.unique_dates}일`)
        console.log(`  - 고유 상담사 수: ${dateInfo.unique_agents}명`)
        console.log(`  - 센터 수: ${dateInfo.unique_centers}개`)
      } catch (error) {
        console.log('  (상세 정보 조회 실패)')
      }
    }
    
    console.log('\n✅ 확인 완료')
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  checkDataCount()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 확인 실패:', error)
      process.exit(1)
    })
}

export { checkDataCount }
