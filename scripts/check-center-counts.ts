/**
 * BigQuery 센터별 평가 건수 확인 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/check-center-counts.ts
 */

import { getBigQueryClient } from '../lib/bigquery'

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC'

async function checkCenterCounts() {
  try {
    const bigquery = getBigQueryClient()
    
    console.log('📊 BigQuery 센터별 평가 건수 확인 중...\n')
    console.log(`데이터셋: ${DATASET_ID}\n`)
    
    // 센터별 평가 건수 조회
    const query = `
      SELECT 
        center,
        COUNT(*) as total_count,
        COUNT(DISTINCT agent_id) as unique_agents,
        COUNT(DISTINCT evaluation_date) as unique_dates,
        MIN(evaluation_date) as min_date,
        MAX(evaluation_date) as max_date,
        SUM(attitude_error_count) as total_attitude_errors,
        SUM(business_error_count) as total_business_errors,
        SUM(total_error_count) as total_errors,
        ROUND(AVG(SAFE_DIVIDE(attitude_error_count, 5) * 100), 2) as avg_attitude_rate,
        ROUND(AVG(SAFE_DIVIDE(business_error_count, 11) * 100), 2) as avg_business_rate
      FROM \`${DATASET_ID}.evaluations\`
      GROUP BY center
      ORDER BY center
    `
    
    const [rows] = await bigquery.query({
      query,
      location: 'asia-northeast3',
    })
    
    console.log('='.repeat(70))
    console.log('📈 센터별 평가 건수')
    console.log('='.repeat(70))
    
    let totalCount = 0
    let totalAgents = 0
    
    rows.forEach((row: any) => {
      const center = row.center || '알 수 없음'
      const count = Number(row.total_count) || 0
      const agents = Number(row.unique_agents) || 0
      const dates = Number(row.unique_dates) || 0
      const minDate = row.min_date?.value || row.min_date || 'N/A'
      const maxDate = row.max_date?.value || row.max_date || 'N/A'
      const attitudeErrors = Number(row.total_attitude_errors) || 0
      const businessErrors = Number(row.total_business_errors) || 0
      const totalErrors = Number(row.total_errors) || 0
      const avgAttitudeRate = Number(row.avg_attitude_rate) || 0
      const avgBusinessRate = Number(row.avg_business_rate) || 0
      
      totalCount += count
      totalAgents += agents
      
      console.log(`\n📍 ${center}`)
      console.log(`   평가 건수: ${count.toLocaleString()}건`)
      console.log(`   고유 상담사: ${agents}명`)
      console.log(`   평가 기간: ${dates}일 (${minDate} ~ ${maxDate})`)
      console.log(`   상담태도 오류: ${attitudeErrors.toLocaleString()}건 (평균 ${avgAttitudeRate}%)`)
      console.log(`   오상담/오처리 오류: ${businessErrors.toLocaleString()}건 (평균 ${avgBusinessRate}%)`)
      console.log(`   전체 오류: ${totalErrors.toLocaleString()}건`)
    })
    
    console.log('\n' + '='.repeat(70))
    console.log('📊 전체 요약')
    console.log('='.repeat(70))
    console.log(`총 평가 건수: ${totalCount.toLocaleString()}건`)
    console.log(`총 고유 상담사: ${totalAgents}명`)
    console.log(`센터 수: ${rows.length}개`)
    
    // 서비스별 통계
    console.log('\n' + '='.repeat(70))
    console.log('📋 서비스별 평가 건수')
    console.log('='.repeat(70))
    
    const serviceQuery = `
      SELECT 
        center,
        service,
        COUNT(*) as count,
        COUNT(DISTINCT agent_id) as agents
      FROM \`${DATASET_ID}.evaluations\`
      GROUP BY center, service
      ORDER BY center, service
    `
    
    const [serviceRows] = await bigquery.query({
      query: serviceQuery,
      location: 'asia-northeast3',
    })
    
    serviceRows.forEach((row: any) => {
      const center = row.center || '알 수 없음'
      const service = row.service || '알 수 없음'
      const count = Number(row.count) || 0
      const agents = Number(row.agents) || 0
      console.log(`   ${center} - ${service}: ${count.toLocaleString()}건 (${agents}명)`)
    })
    
    // 채널별 통계
    console.log('\n' + '='.repeat(70))
    console.log('📞 채널별 평가 건수')
    console.log('='.repeat(70))
    
    const channelQuery = `
      SELECT 
        center,
        channel,
        COUNT(*) as count,
        COUNT(DISTINCT agent_id) as agents
      FROM \`${DATASET_ID}.evaluations\`
      GROUP BY center, channel
      ORDER BY center, channel
    `
    
    const [channelRows] = await bigquery.query({
      query: channelQuery,
      location: 'asia-northeast3',
    })
    
    channelRows.forEach((row: any) => {
      const center = row.center || '알 수 없음'
      const channel = row.channel || '알 수 없음'
      const count = Number(row.count) || 0
      const agents = Number(row.agents) || 0
      console.log(`   ${center} - ${channel}: ${count.toLocaleString()}건 (${agents}명)`)
    })
    
    console.log('\n✅ 확인 완료')
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  checkCenterCounts()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 확인 실패:', error)
      process.exit(1)
    })
}

export { checkCenterCounts }
