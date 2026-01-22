/**
 * BigQuery 테이블 스키마 확인 스크립트
 */

import { getBigQueryClient } from '../lib/bigquery'

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC'

async function checkSchema() {
  try {
    const bigquery = getBigQueryClient()
    
    console.log('📊 BigQuery 테이블 스키마 확인 중...\n')
    
    // targets 테이블 스키마 확인
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'targets'
      ORDER BY ordinal_position
    `
    
    const [rows] = await bigquery.query({
      query,
      location: 'asia-northeast3',
    })
    
    console.log('targets 테이블 컬럼:')
    if (rows.length === 0) {
      console.log('  ❌ targets 테이블이 존재하지 않거나 컬럼 정보를 가져올 수 없습니다.')
    } else {
      rows.forEach((row: any) => {
        console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`)
      })
    }
    
    // evaluations 테이블의 hire_date 확인
    console.log('\nevaluations 테이블의 hire_date 관련 컬럼:')
    const evalQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'evaluations'
        AND (column_name LIKE '%hire%' OR column_name LIKE '%tenure%')
      ORDER BY ordinal_position
    `
    
    const [evalRows] = await bigquery.query({
      query: evalQuery,
      location: 'asia-northeast3',
    })
    
    if (evalRows.length === 0) {
      console.log('  ⚠️  hire_date 또는 tenure 관련 컬럼을 찾을 수 없습니다.')
    } else {
      evalRows.forEach((row: any) => {
        console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`)
      })
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

if (require.main === module) {
  checkSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ 확인 실패:', error)
      process.exit(1)
    })
}

export { checkSchema }
