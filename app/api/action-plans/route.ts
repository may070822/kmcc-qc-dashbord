import { NextRequest, NextResponse } from 'next/server';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/action-plans
// TODO: BigQuery에 action_plans 테이블이 있다면 실제 데이터 조회
// 현재는 빈 배열 반환 (향후 구현)
export async function GET(request: NextRequest) {
  try {
    // TODO: BigQuery에서 액션 플랜 히스토리 조회
    // const result = await getActionPlanHistory(filters);
    
    // 임시로 빈 배열 반환
    return NextResponse.json(
      {
        success: true,
        data: [],
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Action plans error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch action plans',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/action-plans - 액션 플랜 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: BigQuery에 액션 플랜 저장
    console.log('[API] Action plan creation:', body);
    
    return NextResponse.json(
      {
        success: true,
        message: 'Action plan created successfully',
        data: body,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Action plans POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create action plan',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
