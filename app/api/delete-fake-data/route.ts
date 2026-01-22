import { NextRequest, NextResponse } from 'next/server';
import { getBigQueryClient } from '@/lib/bigquery';

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/delete-fake-data - 가짜 데이터 삭제
export async function POST(request: NextRequest) {
  try {
    const bigquery = getBigQueryClient();
    
    console.log('[API] 가짜 데이터 삭제 시작...');
    
    // 1. 먼저 삭제될 데이터 확인
    console.log('[API] 삭제될 데이터 확인 중...');
    
    const checkEvaluationsQuery = `
      SELECT COUNT(*) as count
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id LIKE 'AGT%'
    `;
    
    const checkAgentsQuery = `
      SELECT COUNT(*) as count
      FROM \`${DATASET_ID}.agents\`
      WHERE agent_id LIKE 'AGT%'
    `;
    
    const checkWatchListQuery = `
      SELECT COUNT(*) as count
      FROM \`${DATASET_ID}.watch_list\`
      WHERE agent_id LIKE 'AGT%'
    `;
    
    const [evaluationsCheck] = await bigquery.query({
      query: checkEvaluationsQuery,
      location: 'asia-northeast3',
    });
    
    const [agentsCheck] = await bigquery.query({
      query: checkAgentsQuery,
      location: 'asia-northeast3',
    });
    
    const [watchListCheck] = await bigquery.query({
      query: checkWatchListQuery,
      location: 'asia-northeast3',
    });
    
    const evaluationsCount = Number(evaluationsCheck[0]?.count) || 0;
    const agentsCount = Number(agentsCheck[0]?.count) || 0;
    const watchListCount = Number(watchListCheck[0]?.count) || 0;
    
    console.log(`[API] 발견된 가짜 데이터: evaluations=${evaluationsCount}, agents=${agentsCount}, watch_list=${watchListCount}`);
    
    // 2. evaluations 테이블에서 가짜 데이터 삭제
    if (evaluationsCount > 0) {
      console.log('[API] evaluations 테이블에서 가짜 데이터 삭제 중...');
      const deleteEvaluationsQuery = `
        DELETE FROM \`${DATASET_ID}.evaluations\`
        WHERE agent_id LIKE 'AGT%'
      `;
      
      await bigquery.query({
        query: deleteEvaluationsQuery,
        location: 'asia-northeast3',
      });
      console.log('[API] evaluations 테이블 삭제 완료');
    }
    
    // 3. agents 테이블에서 가짜 데이터 삭제
    if (agentsCount > 0) {
      console.log('[API] agents 테이블에서 가짜 데이터 삭제 중...');
      const deleteAgentsQuery = `
        DELETE FROM \`${DATASET_ID}.agents\`
        WHERE agent_id LIKE 'AGT%'
      `;
      
      await bigquery.query({
        query: deleteAgentsQuery,
        location: 'asia-northeast3',
      });
      console.log('[API] agents 테이블 삭제 완료');
    }
    
    // 4. watch_list 테이블에서 가짜 데이터 삭제
    if (watchListCount > 0) {
      console.log('[API] watch_list 테이블에서 가짜 데이터 삭제 중...');
      const deleteWatchListQuery = `
        DELETE FROM \`${DATASET_ID}.watch_list\`
        WHERE agent_id LIKE 'AGT%'
      `;
      
      await bigquery.query({
        query: deleteWatchListQuery,
        location: 'asia-northeast3',
      });
      console.log('[API] watch_list 테이블 삭제 완료');
    }
    
    // 5. 삭제 후 확인
    console.log('[API] 삭제 후 확인 중...');
    
    const [evaluationsAfter] = await bigquery.query({
      query: checkEvaluationsQuery,
      location: 'asia-northeast3',
    });
    
    const [agentsAfter] = await bigquery.query({
      query: checkAgentsQuery,
      location: 'asia-northeast3',
    });
    
    const [watchListAfter] = await bigquery.query({
      query: checkWatchListQuery,
      location: 'asia-northeast3',
    });
    
    const remainingEvaluations = Number(evaluationsAfter[0]?.count) || 0;
    const remainingAgents = Number(agentsAfter[0]?.count) || 0;
    const remainingWatchList = Number(watchListAfter[0]?.count) || 0;
    
    console.log(`[API] 삭제 완료: evaluations=${remainingEvaluations}, agents=${remainingAgents}, watch_list=${remainingWatchList}`);
    
    return NextResponse.json(
      {
        success: true,
        message: '가짜 데이터 삭제 완료',
        deleted: {
          evaluations: evaluationsCount,
          agents: agentsCount,
          watchList: watchListCount,
        },
        remaining: {
          evaluations: remainingEvaluations,
          agents: remainingAgents,
          watchList: remainingWatchList,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] 가짜 데이터 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
