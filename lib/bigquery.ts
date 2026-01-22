import { BigQuery } from '@google-cloud/bigquery';
import { AgentAnalysisContext, GroupAnalysisContext } from './types';

/**
 * BigQuery 클라이언트 초기화
 * 
 * 인증 방법:
 * 1. BIGQUERY_CREDENTIALS 환경 변수 (JSON 문자열)
 * 2. GOOGLE_APPLICATION_CREDENTIALS 환경 변수 (파일 경로)
 * 3. 기본 애플리케이션 인증 (GCP 환경)
 */
function initializeBigQuery(): BigQuery {
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'splyquizkm';
  
  // 환경 변수에서 credentials JSON 파싱
  if (process.env.BIGQUERY_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
      return new BigQuery({
        projectId,
        credentials,
      });
    } catch (error) {
      console.error('[BigQuery] Failed to parse BIGQUERY_CREDENTIALS:', error);
      throw new Error('Invalid BIGQUERY_CREDENTIALS format');
    }
  }
  
  // GOOGLE_APPLICATION_CREDENTIALS 환경 변수 또는 기본 인증 사용
  return new BigQuery({ projectId });
}

// BigQuery 클라이언트 싱글톤
let bigqueryClient: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    bigqueryClient = initializeBigQuery();
  }
  return bigqueryClient;
}

// 데이터셋 ID
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

// ============================================
// 대시보드 통계 조회
// ============================================

export interface DashboardStats {
  totalAgentsYongsan: number;
  totalAgentsGwangju: number;
  totalEvaluations: number;
  watchlistYongsan: number;
  watchlistGwangju: number;
  attitudeErrorRate: number;
  businessErrorRate: number;
  overallErrorRate: number;
  date: string;
}

export async function getDashboardStats(targetDate?: string): Promise<{ success: boolean; data?: DashboardStats; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 날짜가 없으면 어제 날짜 사용
    let queryDate = targetDate;
    if (!queryDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      queryDate = yesterday.toISOString().split('T')[0];
    }
    
    console.log(`[BigQuery] getDashboardStats: ${queryDate}`);
    
    const query = `
      WITH daily_stats AS (
        SELECT
          center,
          COUNT(*) as evaluation_count,
          COUNT(DISTINCT agent_id) as agent_count,
          SUM(attitude_error_count) as total_attitude_errors,
          SUM(business_error_count) as total_ops_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date = @queryDate
          AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
        GROUP BY center
      ),
      watchlist_counts AS (
        SELECT
          center,
          COUNT(DISTINCT agent_id) as watchlist_count
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date = @queryDate
          AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
          AND (
            (attitude_error_count / 5.0 * 100) > 5
            OR (business_error_count / 11.0 * 100) > 6
          )
        GROUP BY center
      )
      SELECT
        COALESCE(SUM(CASE WHEN ds.center = '용산' THEN ds.agent_count ELSE 0 END), 0) as totalAgentsYongsan,
        COALESCE(SUM(CASE WHEN ds.center = '광주' THEN ds.agent_count ELSE 0 END), 0) as totalAgentsGwangju,
        COALESCE(SUM(ds.evaluation_count), 0) as totalEvaluations,
        COALESCE(SUM(CASE WHEN wc.center = '용산' THEN wc.watchlist_count ELSE 0 END), 0) as watchlistYongsan,
        COALESCE(SUM(CASE WHEN wc.center = '광주' THEN wc.watchlist_count ELSE 0 END), 0) as watchlistGwangju,
        ROUND(SAFE_DIVIDE(SUM(ds.total_attitude_errors), SUM(ds.evaluation_count) * 5) * 100, 2) as attitudeErrorRate,
        ROUND(SAFE_DIVIDE(SUM(ds.total_ops_errors), SUM(ds.evaluation_count) * 11) * 100, 2) as businessErrorRate,
        -- 전체 오류율: (태도 오류 + 업무 오류) / (평가건수 * 16) * 100
        ROUND(SAFE_DIVIDE(SUM(ds.total_attitude_errors + ds.total_ops_errors), SUM(ds.evaluation_count) * 16) * 100, 2) as overallErrorRate
      FROM daily_stats ds
      LEFT JOIN watchlist_counts wc ON ds.center = wc.center
    `;
    
    const options = {
      query,
      params: { queryDate },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    if (rows.length === 0) {
      return {
        success: true,
        data: {
          totalAgentsYongsan: 0,
          totalAgentsGwangju: 0,
          totalEvaluations: 0,
          watchlistYongsan: 0,
          watchlistGwangju: 0,
          attitudeErrorRate: 0,
          businessErrorRate: 0,
          overallErrorRate: 0,
          date: queryDate,
        },
      };
    }
    
    const row = rows[0];
    const attitudeErrorRate = Number(row.attitudeErrorRate) || 0;
    const businessErrorRate = Number(row.businessErrorRate) || 0;
    // 전체 오류율: 쿼리에서 직접 계산한 값 사용 (태도 오류율 + 업무 오류율이 아님)
    const overallErrorRate = Number(row.overallErrorRate) || 0;
    
    return {
      success: true,
      data: {
        totalAgentsYongsan: Number(row.totalAgentsYongsan) || 0,
        totalAgentsGwangju: Number(row.totalAgentsGwangju) || 0,
        totalEvaluations: Number(row.totalEvaluations) || 0,
        watchlistYongsan: Number(row.watchlistYongsan) || 0,
        watchlistGwangju: Number(row.watchlistGwangju) || 0,
        attitudeErrorRate,
        businessErrorRate,
        overallErrorRate,
        date: queryDate,
      },
    };
  } catch (error) {
    console.error('[BigQuery] getDashboardStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 센터별 통계 조회
// ============================================

export interface CenterStats {
  name: string;
  evaluations: number;
  errorRate: number;
  attitudeErrorRate: number;
  businessErrorRate: number;
  trend?: number; // 증감비율 추가
  services: Array<{
    name: string;
    agentCount: number;
    errorRate: number;
    trend?: number; // 서비스별 증감비율 추가
  }>;
}

export async function getCenterStats(startDate?: string, endDate?: string): Promise<{ success: boolean; data?: CenterStats[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 이번 달
    if (!startDate || !endDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    
    // 이전 기간 계산 (현재 기간과 동일한 길이)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - periodDays + 1);
    const prevStartDate = prevStart.toISOString().split('T')[0];
    const prevEndDate = prevEnd.toISOString().split('T')[0];
    
    const query = `
      WITH center_stats AS (
        SELECT
          center,
          COUNT(*) as evaluations,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as ops_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date BETWEEN @startDate AND @endDate
          AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
        GROUP BY center
      ),
      prev_center_stats AS (
        SELECT
          center,
          COUNT(*) as evaluations,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as ops_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date BETWEEN @prevStartDate AND @prevEndDate
          AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
        GROUP BY center
      ),
      service_stats AS (
        SELECT
          center,
          COALESCE(NULLIF(service, ''), '미분류') as service,
          COUNT(DISTINCT agent_id) as agent_count,
          COUNT(*) as evaluations,
          SUM(attitude_error_count + business_error_count) as total_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date BETWEEN @startDate AND @endDate
          AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
        GROUP BY center, service
      ),
      prev_service_stats AS (
        SELECT
          center,
          COALESCE(NULLIF(service, ''), '미분류') as service,
          COUNT(*) as evaluations,
          SUM(attitude_error_count + business_error_count) as total_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date BETWEEN @prevStartDate AND @prevEndDate
          AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
        GROUP BY center, service
      )
      SELECT
        cs.center,
        cs.evaluations,
        ROUND(SAFE_DIVIDE(cs.attitude_errors, cs.evaluations * 5) * 100, 2) as attitudeErrorRate,
        ROUND(SAFE_DIVIDE(cs.ops_errors, cs.evaluations * 11) * 100, 2) as businessErrorRate,
        -- 전체 오류율: (태도 오류 + 업무 오류) / (평가건수 * 16) * 100
        ROUND(SAFE_DIVIDE(cs.attitude_errors + cs.ops_errors, cs.evaluations * 16) * 100, 2) as overallErrorRate,
        -- 이전 기간 전체 오류율
        ROUND(SAFE_DIVIDE(pcs.attitude_errors + pcs.ops_errors, pcs.evaluations * 16) * 100, 2) as prevOverallErrorRate,
        ARRAY_AGG(
          STRUCT(
            ss.service as name,
            ss.agent_count as agentCount,
            ROUND(SAFE_DIVIDE(ss.total_errors, ss.evaluations * 16) * 100, 2) as errorRate,
            ROUND(SAFE_DIVIDE(pss.total_errors, pss.evaluations * 16) * 100, 2) as prevErrorRate
          )
        ) as services
      FROM center_stats cs
      LEFT JOIN prev_center_stats pcs ON cs.center = pcs.center
      LEFT JOIN service_stats ss ON cs.center = ss.center
      LEFT JOIN prev_service_stats pss ON ss.center = pss.center AND ss.service = pss.service
      GROUP BY cs.center, cs.evaluations, cs.attitude_errors, cs.ops_errors, pcs.attitude_errors, pcs.ops_errors, pcs.evaluations
    `;
    
    const options = {
      query,
      params: { startDate, endDate, prevStartDate, prevEndDate },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: CenterStats[] = rows.map((row: any) => {
      const currentRate = Number(row.overallErrorRate) || 0;
      const prevRate = Number(row.prevOverallErrorRate) || 0;
      const trend = currentRate - prevRate; // 증감비율 계산
      
      return {
        name: row.center,
        evaluations: Number(row.evaluations) || 0,
        attitudeErrorRate: Number(row.attitudeErrorRate) || 0,
        businessErrorRate: Number(row.businessErrorRate) || 0,
        errorRate: currentRate,
        trend: trend, // 증감비율 추가
        services: (row.services || [])
          .filter((svc: any) => svc.name && svc.name.trim() !== '') // 빈 이름 필터링
          .map((svc: any) => {
            const svcCurrentRate = Number(svc.errorRate) || 0;
            const svcPrevRate = Number(svc.prevErrorRate) || 0;
            const svcTrend = svcCurrentRate - svcPrevRate;
            
            return {
              name: svc.name || '미분류',
              agentCount: Number(svc.agentCount) || 0,
              errorRate: svcCurrentRate,
              trend: svcTrend, // 서비스별 증감비율 추가
            };
          }),
      };
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getCenterStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 일별 트렌드 데이터 조회
// ============================================

export interface TrendData {
  date: string;
  yongsan: number;
  gwangju: number;
  overall: number;
  // 추가 필드 (태도/오상담 분리)
  yongsanAttitude?: number;
  yongsanOps?: number;
  yongsanTotal?: number;
  gwangjuAttitude?: number;
  gwangjuOps?: number;
  gwangjuTotal?: number;
}

export async function getDailyTrend(
  days?: number,
  startDateParam?: string,
  endDateParam?: string
): Promise<{ success: boolean; data?: TrendData[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    let startDateStr: string;
    let endDateStr: string;
    
    // startDate와 endDate가 제공되면 사용, 아니면 days 기반으로 계산
    if (startDateParam && endDateParam) {
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    } else {
      const daysToUse = days || 14;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToUse);
      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = endDate.toISOString().split('T')[0];
    }
    
    const query = `
      SELECT
        evaluation_date as date,
        -- 용산 태도 오류율
        SUM(CASE WHEN center = '용산' THEN attitude_error_count ELSE 0 END) as yongsan_attitude_errors,
        SUM(CASE WHEN center = '용산' THEN 1 ELSE 0 END) as yongsan_count,
        -- 용산 오상담 오류율
        SUM(CASE WHEN center = '용산' THEN business_error_count ELSE 0 END) as yongsan_ops_errors,
        -- 광주 태도 오류율
        SUM(CASE WHEN center = '광주' THEN attitude_error_count ELSE 0 END) as gwangju_attitude_errors,
        SUM(CASE WHEN center = '광주' THEN 1 ELSE 0 END) as gwangju_count,
        -- 광주 오상담 오류율
        SUM(CASE WHEN center = '광주' THEN business_error_count ELSE 0 END) as gwangju_ops_errors,
        -- 전체
        SUM(attitude_error_count + business_error_count) as total_errors,
        COUNT(*) as total_count
      FROM \`${DATASET_ID}.evaluations\`
      WHERE evaluation_date BETWEEN @startDate AND @endDate
        AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
      GROUP BY evaluation_date
      ORDER BY evaluation_date ASC
    `;
    
    const options = {
      query,
      params: { startDate: startDateStr, endDate: endDateStr },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: TrendData[] = rows.map((row: any) => {
      const yongsanAttitudeRate = row.yongsan_count > 0
        ? Number((Number(row.yongsan_attitude_errors) / (Number(row.yongsan_count) * 5) * 100).toFixed(2))
        : 0;
      const yongsanOpsRate = row.yongsan_count > 0
        ? Number((Number(row.yongsan_ops_errors) / (Number(row.yongsan_count) * 11) * 100).toFixed(2))
        : 0;
      const yongsanTotalRate = yongsanAttitudeRate + yongsanOpsRate;
      
      const gwangjuAttitudeRate = row.gwangju_count > 0
        ? Number((Number(row.gwangju_attitude_errors) / (Number(row.gwangju_count) * 5) * 100).toFixed(2))
        : 0;
      const gwangjuOpsRate = row.gwangju_count > 0
        ? Number((Number(row.gwangju_ops_errors) / (Number(row.gwangju_count) * 11) * 100).toFixed(2))
        : 0;
      const gwangjuTotalRate = gwangjuAttitudeRate + gwangjuOpsRate;
      
      const overallRate = row.total_count > 0
        ? Number((Number(row.total_errors) / (Number(row.total_count) * 16) * 100).toFixed(2))
        : 0;
      
      return {
        date: row.date.value || row.date,
        yongsan: overallRate, // 전체 평균 (하위 호환성)
        gwangju: overallRate, // 전체 평균 (하위 호환성)
        overall: overallRate,
        // 추가 필드 (향후 사용)
        yongsanAttitude: yongsanAttitudeRate,
        yongsanOps: yongsanOpsRate,
        yongsanTotal: yongsanTotalRate,
        gwangjuAttitude: gwangjuAttitudeRate,
        gwangjuOps: gwangjuOpsRate,
        gwangjuTotal: gwangjuTotalRate,
      };
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getDailyTrend error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 상담사 목록 조회
// ============================================

export interface AgentErrorInfo {
  name: string;
  count: number;
  rate: number; // 오류율 (%)
}

export interface Agent {
  id: string;
  name: string;
  center: string;
  service: string;
  channel: string;
  tenureMonths: number;
  tenureGroup: string;
  isActive: boolean;
  totalEvaluations: number;
  attitudeErrorRate: number;
  opsErrorRate: number;
  overallErrorRate: number;
  topErrors?: AgentErrorInfo[]; // 주요 오류 항목 (이름, 개수, 오류율 포함)
}

export async function getAgents(filters?: {
  center?: string;
  service?: string;
  channel?: string;
  tenure?: string;
  month?: string;
  date?: string; // 특정 날짜 조회 (YYYY-MM-DD 형식)
}): Promise<{ success: boolean; data?: Agent[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // date가 있으면 특정 날짜로, 없으면 month로 조회
    const hasDate = !!filters?.date;
    const month = filters?.month || new Date().toISOString().slice(0, 7);
    const date = filters?.date;
    
    let whereClause = 'WHERE 1=1';
    const params: any = hasDate ? { date } : { month };
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND a.center = @center';
      params.center = filters.center;
    }
    if (filters?.service && filters.service !== 'all') {
      whereClause += ' AND e.service = @service';
      params.service = filters.service;
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND e.channel = @channel';
      params.channel = filters.channel;
    }
    // tenure 필터는 agents 테이블에 tenure_group 컬럼 있을 때만 활성화
    // if (filters?.tenure && filters.tenure !== 'all') {
    //   whereClause += ' AND a.tenure_group = @tenure';
    //   params.tenure = filters.tenure;
    // }
    
    // WHERE 절 재구성 (evaluations 테이블 기준)
    // date가 있으면 특정 날짜로, 없으면 월 단위로 조회
    let evalWhereClause = hasDate
      ? 'WHERE evaluation_date = @date AND NOT STARTS_WITH(agent_id, \'AGT\')'
      : 'WHERE FORMAT_DATE(\'%Y-%m\', evaluation_date) = @month AND NOT STARTS_WITH(agent_id, \'AGT\')';
    
    if (filters?.center && filters.center !== 'all') {
      evalWhereClause += ' AND center = @center';
    }
    if (filters?.service && filters.service !== 'all') {
      evalWhereClause += ' AND service = @service';
    }
    if (filters?.channel && filters.channel !== 'all') {
      evalWhereClause += ' AND channel = @channel';
    }
    
    // tenure_months 컬럼 존재 여부 확인을 위한 안전한 쿼리
    // 컬럼이 없으면 0으로 처리
    // ops_error_count가 없으면 개별 오류 항목들을 합산하여 계산
    const query = `
      WITH agent_stats AS (
        SELECT
          agent_id,
          agent_name,
          center,
          service,
          channel,
          -- tenure_months 컬럼이 있을 경우에만 사용, 없으면 0
          IFNULL(MAX(tenure_months), 0) as tenureMonths,
          IFNULL(MAX(tenure_group), '') as tenureGroup,
          COUNT(*) as totalEvaluations,
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitudeErrorRate,
          -- ops_error_count가 있으면 사용, 없으면 개별 오류 항목 합산
          ROUND(SAFE_DIVIDE(
            COALESCE(
              SUM(ops_error_count),
              SUM(CAST(consult_type_error AS INT64)) +
              SUM(CAST(guide_error AS INT64)) +
              SUM(CAST(identity_check_error AS INT64)) +
              SUM(CAST(required_search_error AS INT64)) +
              SUM(CAST(wrong_guide_error AS INT64)) +
              SUM(CAST(process_missing_error AS INT64)) +
              SUM(CAST(process_incomplete_error AS INT64)) +
              SUM(CAST(system_error AS INT64)) +
              SUM(CAST(id_mapping_error AS INT64)) +
              SUM(CAST(flag_keyword_error AS INT64)) +
              SUM(CAST(history_error AS INT64))
            ),
            COUNT(*) * 11
          ) * 100, 2) as opsErrorRate,
          -- 주요 오류 항목 집계
          SUM(CAST(empathy_error AS INT64)) as empathy_errors,
          SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
          SUM(CAST(guide_error AS INT64)) as guide_errors,
          SUM(CAST(identity_check_error AS INT64)) as identity_check_errors,
          SUM(CAST(flag_keyword_error AS INT64)) as flag_keyword_errors,
          SUM(CAST(greeting_error AS INT64)) as greeting_errors,
          SUM(CAST(apology_error AS INT64)) as apology_errors,
          SUM(CAST(additional_inquiry_error AS INT64)) as additional_inquiry_errors,
          SUM(CAST(unkind_error AS INT64)) as unkind_errors
        FROM \`${DATASET_ID}.evaluations\`
        ${evalWhereClause}
        GROUP BY agent_id, agent_name, center, service, channel
      )
      SELECT
        agent_id as id,
        agent_name as name,
        center,
        service,
        channel,
        tenureMonths,
        tenureGroup,
        totalEvaluations,
        attitudeErrorRate,
        opsErrorRate,
        empathy_errors,
        consult_type_errors,
        guide_errors,
        identity_check_errors,
        flag_keyword_errors,
        greeting_errors,
        apology_errors,
        additional_inquiry_errors,
        unkind_errors
      FROM agent_stats
      ORDER BY attitudeErrorRate + opsErrorRate DESC
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    let rows: any[] = [];
    try {
      [rows] = await bigquery.query(options);
    } catch (queryError: any) {
      const errorMsg = queryError.message || '';
      // tenure_months 또는 tenure_group 컬럼이 없는 경우를 대비한 fallback 쿼리
      if (errorMsg.includes('tenure_months') || errorMsg.includes('tenure_group') || errorMsg.includes('Unrecognized name')) {
        console.warn('[BigQuery] tenure 관련 컬럼이 없어 fallback 쿼리 사용:', errorMsg);
        const fallbackQuery = `
          WITH agent_stats AS (
            SELECT
              agent_id,
              agent_name,
              center,
              service,
              channel,
              0 as tenureMonths,
              '' as tenureGroup,
              COUNT(*) as totalEvaluations,
              ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitudeErrorRate,
              -- ops_error_count가 없으면 개별 오류 항목 합산
              ROUND(SAFE_DIVIDE(
                SUM(CAST(consult_type_error AS INT64)) +
                SUM(CAST(guide_error AS INT64)) +
                SUM(CAST(identity_check_error AS INT64)) +
                SUM(CAST(required_search_error AS INT64)) +
                SUM(CAST(wrong_guide_error AS INT64)) +
                SUM(CAST(process_missing_error AS INT64)) +
                SUM(CAST(process_incomplete_error AS INT64)) +
                SUM(CAST(system_error AS INT64)) +
                SUM(CAST(id_mapping_error AS INT64)) +
                SUM(CAST(flag_keyword_error AS INT64)) +
                SUM(CAST(history_error AS INT64)),
                COUNT(*) * 11
              ) * 100, 2) as opsErrorRate,
              SUM(CAST(empathy_error AS INT64)) as empathy_errors,
              SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
              SUM(CAST(guide_error AS INT64)) as guide_errors,
              SUM(CAST(identity_check_error AS INT64)) as identity_check_errors,
              SUM(CAST(flag_keyword_error AS INT64)) as flag_keyword_errors,
              SUM(CAST(greeting_error AS INT64)) as greeting_errors,
              SUM(CAST(apology_error AS INT64)) as apology_errors,
              SUM(CAST(additional_inquiry_error AS INT64)) as additional_inquiry_errors,
              SUM(CAST(unkind_error AS INT64)) as unkind_errors
            FROM \`${DATASET_ID}.evaluations\`
            ${evalWhereClause}
            GROUP BY agent_id, agent_name, center, service, channel
          )
          SELECT
            agent_id as id,
            agent_name as name,
            center,
            service,
            channel,
            tenureMonths,
            tenureGroup,
            totalEvaluations,
            attitudeErrorRate,
            opsErrorRate,
            empathy_errors,
            consult_type_errors,
            guide_errors,
            identity_check_errors,
            flag_keyword_errors,
            greeting_errors,
            apology_errors,
            additional_inquiry_errors,
            unkind_errors
          FROM agent_stats
          ORDER BY attitudeErrorRate + opsErrorRate DESC
        `;
        try {
          [rows] = await bigquery.query({
            query: fallbackQuery,
            params,
            location: 'asia-northeast3',
          });
        } catch (fallbackError: any) {
          console.error('[BigQuery] Fallback query also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw queryError;
      }
    }
    
    const result: Agent[] = rows
      .filter((row: any) => {
        // AGT로 시작하는 ID는 테스트 데이터이므로 제외
        const agentId = row.id || '';
        return !agentId.startsWith('AGT');
      })
      .map((row: any) => {
        const attRate = Number(row.attitudeErrorRate) || 0;
        const opsRate = Number(row.opsErrorRate) || 0;
        
        // 주요 오류 항목 계산 (오류율 포함)
        const totalEvals = Number(row.totalEvaluations) || 1; // 0으로 나누기 방지
        const errors = [
          { name: '공감표현누락', count: Number(row.empathy_errors) || 0 },
          { name: '상담유형오설정', count: Number(row.consult_type_errors) || 0 },
          { name: '가이드미준수', count: Number(row.guide_errors) || 0 },
          { name: '본인확인누락', count: Number(row.identity_check_errors) || 0 },
          { name: '플래그키워드누락', count: Number(row.flag_keyword_errors) || 0 },
          { name: '첫인사끝인사누락', count: Number(row.greeting_errors) || 0 },
          { name: '사과표현누락', count: Number(row.apology_errors) || 0 },
          { name: '추가문의누락', count: Number(row.additional_inquiry_errors) || 0 },
          { name: '불친절', count: Number(row.unkind_errors) || 0 },
        ]
          .filter(e => e.count > 0)
          .map(e => ({
            name: e.name,
            count: e.count,
            rate: Number((e.count / totalEvals * 100).toFixed(2)) // 오류율 계산 (%)
          }))
          .sort((a, b) => b.count - a.count);
        
        const topErrors = errors.slice(0, 3);
        
        return {
          id: row.id,
          name: row.name,
          center: row.center,
          service: row.service,
          channel: row.channel,
          tenureMonths: Number(row.tenureMonths) || 0,
          tenureGroup: row.tenureGroup || '',
          isActive: true, // agents 테이블에 is_active 컬럼이 없으므로 기본값
          totalEvaluations: Number(row.totalEvaluations) || 0,
          attitudeErrorRate: attRate,
          opsErrorRate: opsRate,
          overallErrorRate: Number((attRate + opsRate).toFixed(2)),
          topErrors, // 주요 오류 항목 추가
        };
      });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getAgents error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 컬럼명 오류에 대한 더 명확한 메시지
    if (errorMessage.includes('ops_error_count') || errorMessage.includes('business_error_count') || errorMessage.includes('Unrecognized name')) {
      return {
        success: false,
        error: `테이블 스키마 오류: evaluations 테이블에 'ops_error_count' 컬럼이 없거나 다른 이름을 사용하고 있습니다. 원본 에러: ${errorMessage}`,
      };
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// 평가 데이터 조회
// ============================================

export async function getEvaluations(startDate?: string, endDate?: string, limit = 10000): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 최근 30일
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      startDate = start.toISOString().split('T')[0];
    }
    
    const query = `
      SELECT *
      FROM \`${DATASET_ID}.evaluations\`
      WHERE evaluation_date BETWEEN @startDate AND @endDate
      ORDER BY evaluation_date DESC, agent_id
      LIMIT @limit
    `;
    
    const options = {
      query,
      params: { startDate, endDate, limit },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    return { success: true, data: rows };
  } catch (error) {
    console.error('[BigQuery] getEvaluations error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 집중관리 대상 조회
// ============================================

export interface WatchListItem {
  agentId: string;
  agentName: string;
  center: string;
  service: string;
  channel: string;
  attitudeRate: number;
  opsRate: number;
  totalRate: number;
  evaluationCount: number;
  reason: string;
  topErrors: string[];
}

export async function getWatchList(filters?: {
  center?: string;
  channel?: string;
  tenure?: string;
  month?: string;
}): Promise<{ success: boolean; data?: WatchListItem[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const month = filters?.month || new Date().toISOString().slice(0, 7);
    
    let whereClause = 'WHERE 1=1';
    const params: any = { month };
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    // tenure 필터는 평가 테이블에 없으므로 주석 처리
    // if (filters?.tenure && filters.tenure !== 'all') {
    //   whereClause += ' AND tenure_group = @tenure';
    //   params.tenure = filters.tenure;
    // }
    
    const query = `
      WITH agent_errors AS (
        SELECT
          agent_id,
          agent_name,
          center,
          service,
          channel,
          COUNT(*) as evaluation_count,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as ops_errors,
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_rate,
          ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as ops_rate,
          SUM(CAST(empathy_error AS INT64)) as empathy_errors,
          SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
          SUM(CAST(guide_error AS INT64)) as guide_errors,
          SUM(CAST(identity_check_error AS INT64)) as identity_check_errors,
          SUM(CAST(flag_keyword_error AS INT64)) as flag_keyword_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE FORMAT_DATE('%Y-%m', evaluation_date) = @month
          AND NOT STARTS_WITH(agent_id, 'AGT')  -- AGT로 시작하는 테스트 데이터 제외
          ${filters?.center && filters.center !== 'all' ? 'AND center = @center' : ''}
          ${filters?.channel && filters.channel !== 'all' ? 'AND channel = @channel' : ''}
        GROUP BY agent_id, agent_name, center, service, channel
      )
      SELECT *
      FROM agent_errors
      WHERE attitude_rate > 5 OR ops_rate > 6
      ORDER BY (attitude_rate + ops_rate) DESC
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: WatchListItem[] = rows
      .filter((row: any) => {
        // AGT로 시작하는 ID는 테스트 데이터이므로 제외
        const agentId = row.agent_id || '';
        return !agentId.startsWith('AGT');
      })
      .map((row: any) => {
        const attRate = Number(row.attitude_rate) || 0;
        const opsRate = Number(row.ops_rate) || 0;
        
        // 주요 오류 항목
        const errors = [
          { name: '공감표현누락', count: Number(row.empathy_errors) || 0 },
          { name: '상담유형오설정', count: Number(row.consult_type_errors) || 0 },
          { name: '가이드미준수', count: Number(row.guide_errors) || 0 },
          { name: '본인확인누락', count: Number(row.identity_check_errors) || 0 },
          { name: '플래그키워드누락', count: Number(row.flag_keyword_errors) || 0 },
        ].filter(e => e.count > 0).sort((a, b) => b.count - a.count);
        
        const topErrors = errors.slice(0, 3).map(e => `${e.name}(${e.count})`);
        
        let reason = '';
        if (attRate > 10) {
          reason = '태도 오류율 10% 초과';
        } else if (opsRate > 10) {
          reason = '오상담 오류율 10% 초과';
        } else if (attRate > 5) {
          reason = '태도 오류율 5% 초과';
        } else {
          reason = '오상담 오류율 6% 초과';
        }
        
        return {
          agentId: row.agent_id,
          agentName: row.agent_name,
          center: row.center,
          service: row.service,
          channel: row.channel,
          attitudeRate: attRate,
          opsRate: opsRate,
          totalRate: Number((attRate + opsRate).toFixed(2)),
          evaluationCount: Number(row.evaluation_count) || 0,
          reason,
          topErrors,
        };
      });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getWatchList error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 목표 데이터 조회
// ============================================

export interface Goal {
  id: string;
  name: string;
  center: string | null;
  type: string;
  targetRate: number;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  isActive: boolean;
}

export async function getGoals(filters?: {
  center?: string;
  periodType?: string;
  isActive?: boolean;
  currentMonth?: boolean; // 현재 월 목표만 조회
}): Promise<{ success: boolean; data?: Goal[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // whereClause는 나중에 실제 컬럼명에 맞게 수정됨
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND (center = @center OR center IS NULL)';
      params.center = filters.center;
    }
    if (filters?.periodType) {
      // period_type 컬럼이 있는지 나중에 확인하고 추가
      // 단, currentMonth 필터가 있으면 periodType 필터를 무시 (연간 목표도 현재 월과 겹치면 표시)
      if (!filters?.currentMonth) {
        whereClause += ' AND period_type = @periodType';
        params.periodType = filters.periodType;
      }
    }
    if (filters?.isActive !== undefined) {
      whereClause += ' AND is_active = @isActive';
      params.isActive = filters.isActive;
    }
    
    // 현재 월 목표만 조회하는 경우 (나중에 실제 컬럼명에 맞게 수정됨)
    if (filters?.currentMonth) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      // 현재 월의 마지막 날짜 계산
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const currentMonthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      params.currentMonthStart = currentMonthStart;
      params.currentMonthEnd = currentMonthEnd;
    }
    
    // 먼저 테이블 존재 여부와 스키마 확인
    let hasTargetName = false;
    let hasTargetType = false;
    let hasTargetRate = false;
    let hasPeriodStart = false;
    
    try {
      const dataset = bigquery.dataset(DATASET_ID);
      const table = dataset.table('targets');
      const [tableExists] = await table.exists();
      
      if (!tableExists) {
        return {
          success: false,
          error: `targets 테이블이 존재하지 않습니다. BigQuery 콘솔에서 KMCC_QC_tables.sql 파일의 스키마를 사용하여 테이블을 생성해주세요.`,
        };
      }
      
      // 테이블 스키마 확인
      const [metadata] = await table.getMetadata();
      const schema = metadata.schema?.fields || [];
      const columnNames = schema.map((field: any) => field.name);
      
      hasTargetName = columnNames.includes('target_name');
      hasTargetType = columnNames.includes('target_type');
      hasTargetRate = columnNames.includes('target_rate');
      hasPeriodStart = columnNames.includes('period_start');
      
      // 실제 테이블 스키마에 맞는 쿼리 생성
      const hasAttitudeRate = columnNames.includes('target_attitude_error_rate');
      const hasBusinessRate = columnNames.includes('target_business_error_rate');
      const hasOverallRate = columnNames.includes('target_overall_error_rate');
      const hasStartDate = columnNames.includes('start_date');
      const hasEndDate = columnNames.includes('end_date');
      const hasPeriodType = columnNames.includes('period_type');
      
      console.log('[BigQuery] Targets table schema detected:', {
        hasTargetName,
        hasTargetType,
        hasTargetRate,
        hasPeriodStart,
        hasAttitudeRate,
        hasBusinessRate,
        hasOverallRate,
        hasStartDate,
        hasEndDate,
        hasPeriodType,
        columnNames,
      });
      
      // 실제 테이블 스키마 (target_name, target_type, target_rate 없음)
      if (!hasTargetName && !hasTargetType && !hasTargetRate && hasAttitudeRate && hasBusinessRate && hasOverallRate && hasStartDate && hasEndDate) {
        console.log('[BigQuery] Using actual table schema (without target_name, target_type, target_rate)');
        // whereClause를 실제 컬럼명에 맞게 수정
        let actualWhereClause = whereClause
          .replace(/period_start/g, 'start_date')
          .replace(/period_end/g, 'end_date');
        
        // period_type이 없으면 해당 필터 제거
        // 또는 currentMonth 필터가 있으면 periodType 필터 무시 (연간 목표도 현재 월과 겹치면 표시)
        if ((!hasPeriodType || filters?.currentMonth) && filters?.periodType) {
          actualWhereClause = actualWhereClause.replace(/AND period_type = @periodType/g, '');
          // params에서도 제거
          delete params.periodType;
        }
        
        // 현재 월 필터 수정
        if (filters?.currentMonth) {
          actualWhereClause += ' AND start_date <= @currentMonthEnd AND end_date >= @currentMonthStart';
        }
        
        // 실제 테이블 스키마에 맞는 쿼리
        const query = `
          SELECT
            target_id as id,
            CONCAT(
              FORMAT_DATE('%Y년 %m월', start_date), ' ',
              COALESCE(center, '전체'), ' ',
              CASE 
                WHEN target_attitude_error_rate IS NOT NULL AND target_business_error_rate IS NULL AND target_overall_error_rate IS NULL THEN '상담태도'
                WHEN target_attitude_error_rate IS NULL AND target_business_error_rate IS NOT NULL AND target_overall_error_rate IS NULL THEN '오상담/오처리'
                WHEN target_attitude_error_rate IS NULL AND target_business_error_rate IS NULL AND target_overall_error_rate IS NOT NULL THEN '합계'
                ELSE '혼합'
              END
            ) as name,
            center,
            CASE 
              WHEN target_attitude_error_rate IS NOT NULL AND target_business_error_rate IS NULL AND target_overall_error_rate IS NULL THEN 'attitude'
              WHEN target_attitude_error_rate IS NULL AND target_business_error_rate IS NOT NULL AND target_overall_error_rate IS NULL THEN 'ops'
              WHEN target_attitude_error_rate IS NULL AND target_business_error_rate IS NULL AND target_overall_error_rate IS NOT NULL THEN 'total'
              ELSE 'mixed'
            END as type,
            COALESCE(target_attitude_error_rate, target_business_error_rate, target_overall_error_rate, 0) as targetRate,
            ${hasPeriodType ? 'period_type as periodType' : "'monthly' as periodType"},
            start_date as periodStart,
            end_date as periodEnd,
            is_active as isActive
          FROM \`${DATASET_ID}.targets\`
          ${actualWhereClause}
          ORDER BY start_date DESC, center
        `;
        
        const options = {
          query,
          params,
          location: 'asia-northeast3',
        };
        
        let rows: any[];
        try {
          console.log('[BigQuery] Executing query with actual schema');
          [rows] = await bigquery.query(options);
          console.log('[BigQuery] Query successful, rows:', rows.length);
        } catch (queryError: any) {
          console.error('[BigQuery] Query error:', queryError);
          console.error('[BigQuery] Query was:', query);
          console.error('[BigQuery] Params were:', params);
          return {
            success: false,
            error: `쿼리 실행 오류: ${queryError.message}`,
          };
        }
        
        const result: Goal[] = rows.map((row: any) => {
          // type 변환: 'attitude' -> '태도', 'ops' -> '오상담/오처리', 'total' -> '합계'
          // 하지만 Goal 타입에서는 '태도' | '오상담/오처리' | '합계'를 기대하므로 변환 필요
          let goalType: '태도' | '오상담/오처리' | '합계' = '합계';
          if (row.type === 'attitude' || row.type === '태도') {
            goalType = '태도';
          } else if (row.type === 'ops' || row.type === '오상담/오처리') {
            goalType = '오상담/오처리';
          } else if (row.type === 'total' || row.type === '합계') {
            goalType = '합계';
          }
          
          return {
            id: row.id,
            name: row.name || `${row.periodStart} ${row.center || '전체'} ${goalType}`,
            center: row.center || '전체',
            type: goalType,
            targetRate: Number(row.targetRate) || 0,
            periodType: row.periodType || 'monthly',
            periodStart: row.periodStart?.value || row.periodStart,
            periodEnd: row.periodEnd?.value || row.periodEnd,
            isActive: Boolean(row.isActive),
          };
        });
        
        console.log('[BigQuery] getGoals result:', { count: result.length, goals: result });
        return { success: true, data: result };
      }
    } catch (checkError: any) {
      console.error('[BigQuery] Table check error:', checkError);
      return {
        success: false,
        error: `테이블 확인 중 오류 발생: ${checkError.message}`,
      };
    }
    
    // 표준 스키마 또는 혼합 스키마 사용
    console.log('[BigQuery] Using standard or mixed schema');
    // whereClause를 실제 컬럼명에 맞게 수정
    let actualWhereClause = whereClause;
    if (!hasPeriodStart) {
      actualWhereClause = actualWhereClause
        .replace(/period_start/g, 'start_date')
        .replace(/period_end/g, 'end_date');
      
      // 현재 월 필터 수정
      if (filters?.currentMonth) {
        actualWhereClause += ' AND start_date <= @currentMonthEnd AND end_date >= @currentMonthStart';
      }
    } else {
      // 현재 월 필터 추가
      if (filters?.currentMonth) {
        actualWhereClause += ' AND period_start <= @currentMonthEnd AND period_end >= @currentMonthStart';
      }
    }
    
    const query = `
      SELECT
        target_id as id,
        ${hasTargetName ? 'target_name as name' : "CONCAT(center, ' ', target_type) as name"},
        center,
        ${hasTargetType ? 'target_type as type' : "'attitude' as type"},
        ${hasTargetRate ? 'target_rate as targetRate' : '0 as targetRate'},
        period_type as periodType,
        ${hasPeriodStart ? 'period_start as periodStart' : 'start_date as periodStart'},
        ${hasPeriodStart ? 'period_end as periodEnd' : 'end_date as periodEnd'},
        is_active as isActive
      FROM \`${DATASET_ID}.targets\`
      ${actualWhereClause}
      ORDER BY ${hasPeriodStart ? 'period_start' : 'start_date'} DESC, center, ${hasTargetType ? 'target_type' : 'target_id'}
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    let rows: any[];
    try {
      [rows] = await bigquery.query(options);
    } catch (queryError: any) {
      // 테이블이 없거나 컬럼이 다른 경우 더 명확한 에러 메시지
      console.error('[BigQuery] Query error:', queryError);
      return {
        success: false,
        error: `쿼리 실행 오류: ${queryError.message}. 테이블 스키마를 확인해주세요.`,
      };
    }
    
    const result: Goal[] = rows.map((row: any) => ({
      id: row.id,
      name: row.name || `${row.periodStart} ${row.center || '전체'}`,
      center: row.center || '전체',
      type: row.type === 'attitude' ? '태도' : row.type === 'ops' ? '오상담/오처리' : '합계',
      targetRate: Number(row.targetRate) || 0,
      periodType: row.periodType || 'monthly',
      periodStart: row.periodStart?.value || row.periodStart,
      periodEnd: row.periodEnd?.value || row.periodEnd,
      isActive: Boolean(row.isActive),
    }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getGoals error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 목표 저장/수정
// ============================================

export interface GoalInput {
  id?: string; // 수정 시에만 제공
  name: string;
  center?: string | null;
  type: 'attitude' | 'ops' | 'total';
  targetRate: number;
  periodType: 'monthly' | 'quarterly';
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  isActive?: boolean;
}

export async function saveGoalToBigQuery(goal: GoalInput): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('targets');
    
    // 테이블 스키마 확인
    const [metadata] = await table.getMetadata();
    const schema = metadata.schema?.fields || [];
    const columnNames = schema.map((field: any) => field.name);
    
    const hasTargetName = columnNames.includes('target_name');
    const hasTargetType = columnNames.includes('target_type');
    const hasTargetRate = columnNames.includes('target_rate');
    const hasPeriodStart = columnNames.includes('period_start');
    const hasAttitudeRate = columnNames.includes('target_attitude_error_rate');
    const hasBusinessRate = columnNames.includes('target_business_error_rate');
    const hasOverallRate = columnNames.includes('target_overall_error_rate');
    const hasStartDate = columnNames.includes('start_date');
    const hasEndDate = columnNames.includes('end_date');
    
    // 날짜 형식 검증 및 변환 (먼저 수행)
    console.log('[BigQuery] saveGoalToBigQuery input:', {
      periodStart: goal.periodStart,
      periodEnd: goal.periodEnd,
      periodStartType: typeof goal.periodStart,
      periodEndType: typeof goal.periodEnd,
    });
    
    let periodStart = String(goal.periodStart || '').trim();
    let periodEnd = String(goal.periodEnd || '').trim();
    
    // 빈 문자열이나 null 체크
    if (!periodStart || !periodEnd || periodStart.length === 0 || periodEnd.length === 0) {
      console.error('[BigQuery] Empty dates:', { periodStart, periodEnd, original: { periodStart: goal.periodStart, periodEnd: goal.periodEnd } });
      return {
        success: false,
        error: `시작일과 종료일은 필수입니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`,
      };
    }
    
    // ISO 형식에서 날짜만 추출 (YYYY-MM-DD)
    if (periodStart.includes('T')) {
      periodStart = periodStart.split('T')[0];
    }
    if (periodEnd.includes('T')) {
      periodEnd = periodEnd.split('T')[0];
    }
    
    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
      console.error('[BigQuery] Invalid date format:', { periodStart, periodEnd });
      return {
        success: false,
        error: `날짜 형식이 올바르지 않습니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`,
      };
    }
    
    console.log('[BigQuery] Normalized dates:', { periodStart, periodEnd });
    
    // target_id 생성 (없으면 자동 생성) - 검증된 periodStart 사용
    const targetId = goal.id || `${periodStart.replace(/-/g, '')}_${goal.center || 'all'}_${goal.type}`;
    
    // 실제 테이블 스키마에 맞는 MERGE 쿼리 생성
    if (!hasTargetName && !hasTargetType && !hasTargetRate && hasAttitudeRate && hasBusinessRate && hasOverallRate && hasStartDate && hasEndDate) {
      // 실제 테이블 스키마 사용
      // NOT NULL 제약조건이 있을 수 있으므로, null 대신 0을 사용하거나 기존 값을 유지
      // 기존 레코드가 있으면 기존 값을 유지하고, 없으면 0으로 설정
      const attitudeRate = goal.type === 'attitude' ? Number(goal.targetRate) : null;
      const businessRate = goal.type === 'ops' ? Number(goal.targetRate) : null;
      const overallRate = goal.type === 'total' ? Number(goal.targetRate) : null;
      
      // MERGE 문에서 기존 값 유지: COALESCE를 사용하여 새 값이 null이면 기존 값 유지
      
      const mergeQuery = `
        MERGE \`${DATASET_ID}.targets\` T
        USING (
          SELECT 
            @targetId as target_id,
            @center as center,
            @attitudeRate as target_attitude_error_rate,
            @businessRate as target_business_error_rate,
            @overallRate as target_overall_error_rate,
            @periodType as period_type,
            @startDate as start_date,
            @endDate as end_date,
            @isActive as is_active,
            @createdAt as created_at,
            @updatedAt as updated_at
        ) S
        ON T.target_id = S.target_id
        WHEN MATCHED THEN
          UPDATE SET
            center = S.center,
            target_attitude_error_rate = COALESCE(S.target_attitude_error_rate, T.target_attitude_error_rate, 0),
            target_business_error_rate = COALESCE(S.target_business_error_rate, T.target_business_error_rate, 0),
            target_overall_error_rate = COALESCE(S.target_overall_error_rate, T.target_overall_error_rate, 0),
            period_type = S.period_type,
            start_date = S.start_date,
            end_date = S.end_date,
            is_active = S.is_active,
            updated_at = S.updated_at
        WHEN NOT MATCHED THEN
          INSERT (
            target_id, center, target_attitude_error_rate, target_business_error_rate, target_overall_error_rate,
            period_type, start_date, end_date, is_active, created_at, updated_at
          )
          VALUES (
            S.target_id, S.center, 
            COALESCE(S.target_attitude_error_rate, 0), 
            COALESCE(S.target_business_error_rate, 0), 
            COALESCE(S.target_overall_error_rate, 0),
            S.period_type, S.start_date, S.end_date, S.is_active, S.created_at, S.updated_at
          )
      `;
      
      const createdAt = new Date().toISOString();
      const updatedAt = new Date().toISOString();
      
      // null 값에 대한 타입 명시 (BigQuery 요구사항)
      // 모든 파라미터에 타입을 명시해야 하며, null 값이 있어도 타입을 지정해야 함
      const paramTypes: Record<string, string> = {
        targetId: 'STRING',
        center: 'STRING', // null이어도 타입 명시 필요
        attitudeRate: 'FLOAT64', // null이어도 타입 명시 필요
        businessRate: 'FLOAT64', // null이어도 타입 명시 필요
        overallRate: 'FLOAT64', // null이어도 타입 명시 필요
        periodType: 'STRING',
        startDate: 'DATE',
        endDate: 'DATE',
        isActive: 'BOOL',
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      };
      
      // 최종 검증: 날짜가 비어있지 않은지 확인
      if (!periodStart || !periodEnd || periodStart.length === 0 || periodEnd.length === 0) {
        console.error('[BigQuery] Dates are empty before query params:', { periodStart, periodEnd });
        return {
          success: false,
          error: `날짜가 비어있습니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`,
        };
      }
      
      const queryParams: Record<string, any> = {
        targetId,
        center: goal.center || null,
        attitudeRate: attitudeRate !== null ? attitudeRate : null,
        businessRate: businessRate !== null ? businessRate : null,
        overallRate: overallRate !== null ? overallRate : null,
        periodType: goal.periodType,
        startDate: periodStart,
        endDate: periodEnd,
        isActive: goal.isActive !== undefined ? goal.isActive : true,
        createdAt,
        updatedAt,
      };
      
      console.log('[BigQuery] saveGoalToBigQuery params:', {
        targetId,
        periodStart,
        periodEnd,
        periodType: goal.periodType,
        startDate: queryParams.startDate,
        endDate: queryParams.endDate,
        startDateType: typeof queryParams.startDate,
        endDateType: typeof queryParams.endDate,
        startDateLength: queryParams.startDate?.length,
        endDateLength: queryParams.endDate?.length,
      });
      
      // 쿼리 실행 전 최종 검증
      if (!queryParams.startDate || !queryParams.endDate) {
        console.error('[BigQuery] startDate or endDate is missing in queryParams:', queryParams);
        return {
          success: false,
          error: `날짜 파라미터가 없습니다. startDate: "${queryParams.startDate}", endDate: "${queryParams.endDate}"`,
        };
      }
      
      try {
        await bigquery.query({
          query: mergeQuery,
          params: queryParams,
          types: paramTypes,
          location: 'asia-northeast3',
        });
        
        console.log(`[BigQuery] Goal ${goal.id ? 'updated' : 'created'}: ${targetId}`);
        return { success: true, data: { id: targetId } };
      } catch (queryError: any) {
        console.error('[BigQuery] Query execution error:', {
          error: queryError,
          message: queryError?.message,
          errors: queryError?.errors,
          queryParams: {
            ...queryParams,
            startDate: queryParams.startDate,
            endDate: queryParams.endDate,
          },
        });
        throw queryError;
      }
    }
    
    // 표준 스키마 사용 (target_name, target_type, target_rate 있음)
    const createdAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();
    
    const mergeQuery = `
      MERGE \`${DATASET_ID}.targets\` T
      USING (
        SELECT 
          @targetId as target_id,
          ${hasTargetName ? '@targetName as target_name,' : ''}
          @center as center,
          ${hasTargetType ? '@targetType as target_type,' : ''}
          ${hasTargetRate ? '@targetRate as target_rate,' : ''}
          @periodType as period_type,
          ${hasPeriodStart ? '@periodStart as period_start,' : '@startDate as start_date,'}
          ${hasPeriodStart ? '@periodEnd as period_end,' : '@endDate as end_date,'}
          @isActive as is_active,
          @createdAt as created_at,
          @updatedAt as updated_at
      ) S
      ON T.target_id = S.target_id
      WHEN MATCHED THEN
        UPDATE SET
          ${hasTargetName ? 'target_name = S.target_name,' : ''}
          center = S.center,
          ${hasTargetType ? 'target_type = S.target_type,' : ''}
          ${hasTargetRate ? 'target_rate = S.target_rate,' : ''}
          period_type = S.period_type,
          ${hasPeriodStart ? 'period_start = S.period_start,' : 'start_date = S.start_date,'}
          ${hasPeriodStart ? 'period_end = S.period_end,' : 'end_date = S.end_date,'}
          is_active = S.is_active,
          updated_at = S.updated_at
      WHEN NOT MATCHED THEN
        INSERT (
          target_id, ${hasTargetName ? 'target_name, ' : ''}center, ${hasTargetType ? 'target_type, ' : ''}${hasTargetRate ? 'target_rate, ' : ''}
          period_type, ${hasPeriodStart ? 'period_start, period_end' : 'start_date, end_date'}, is_active, created_at, updated_at
        )
        VALUES (
          S.target_id, ${hasTargetName ? 'S.target_name, ' : ''}S.center, ${hasTargetType ? 'S.target_type, ' : ''}${hasTargetRate ? 'S.target_rate, ' : ''}
          S.period_type, ${hasPeriodStart ? 'S.period_start, S.period_end' : 'S.start_date, S.end_date'}, S.is_active, S.created_at, S.updated_at
        )
    `;
    
    // 최종 검증: 날짜가 비어있지 않은지 확인
    if (!periodStart || !periodEnd || periodStart.length === 0 || periodEnd.length === 0) {
      console.error('[BigQuery] Dates are empty before params:', { periodStart, periodEnd });
      return {
        success: false,
        error: `날짜가 비어있습니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`,
      };
    }
    
    const params: any = {
      targetId,
      center: goal.center || null,
      periodType: goal.periodType,
      startDate: periodStart,
      endDate: periodEnd,
      isActive: goal.isActive !== undefined ? goal.isActive : true,
      createdAt,
      updatedAt,
    };
    
    if (hasTargetName) params.targetName = goal.name;
    if (hasTargetType) params.targetType = goal.type;
    if (hasTargetRate) params.targetRate = Number(goal.targetRate);
    if (hasPeriodStart) {
      params.periodStart = periodStart;
      params.periodEnd = periodEnd;
    } else {
      params.startDate = periodStart;
      params.endDate = periodEnd;
    }
    
    console.log('[BigQuery] Final params for query:', {
      hasPeriodStart,
      startDate: params.startDate,
      endDate: params.endDate,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      startDateType: typeof params.startDate,
      endDateType: typeof params.endDate,
    });
    
    // null 값에 대한 타입 명시 (BigQuery 요구사항)
    const paramTypes: any = {
      targetId: 'STRING',
      periodType: 'STRING',
      isActive: 'BOOL',
      createdAt: 'TIMESTAMP',
      updatedAt: 'TIMESTAMP',
    };
    
    if (hasTargetName) paramTypes.targetName = 'STRING';
    if (hasTargetType) paramTypes.targetType = 'STRING';
    if (hasTargetRate) paramTypes.targetRate = 'FLOAT64';
    if (hasPeriodStart) {
      paramTypes.periodStart = 'DATE';
      paramTypes.periodEnd = 'DATE';
    } else {
      paramTypes.startDate = 'DATE';
      paramTypes.endDate = 'DATE';
    }
    paramTypes.center = 'STRING';
    
    // 쿼리 실행 전 최종 검증
    const finalStartDate = hasPeriodStart ? params.periodStart : params.startDate;
    const finalEndDate = hasPeriodStart ? params.periodEnd : params.endDate;
    
    if (!finalStartDate || !finalEndDate) {
      console.error('[BigQuery] startDate or endDate is missing in params:', {
        hasPeriodStart,
        startDate: params.startDate,
        endDate: params.endDate,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      });
      return {
        success: false,
        error: `날짜 파라미터가 없습니다. startDate: "${finalStartDate}", endDate: "${finalEndDate}"`,
      };
    }
    
    try {
      await bigquery.query({
        query: mergeQuery,
        params,
        types: paramTypes,
        location: 'asia-northeast3',
      });
      
      console.log(`[BigQuery] Goal ${goal.id ? 'updated' : 'created'}: ${targetId}`);
      
      return { success: true, data: { id: targetId } };
    } catch (queryError: any) {
      console.error('[BigQuery] Query execution error:', {
        error: queryError,
        message: queryError?.message,
        errors: queryError?.errors,
        params: {
          ...params,
          startDate: params.startDate,
          endDate: params.endDate,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
        },
      });
      throw queryError;
    }
  } catch (error) {
    console.error('[BigQuery] saveGoalToBigQuery error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      goalInput: {
        id: goal.id,
        periodStart: goal.periodStart,
        periodEnd: goal.periodEnd,
      },
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // BigQuery 에러 메시지에서 더 자세한 정보 추출
    if (errorMessage.includes('start_date') || errorMessage.includes('end_date')) {
      return {
        success: false,
        error: `날짜 필드 오류: ${errorMessage}. 전달된 값 - periodStart: "${goal.periodStart}", periodEnd: "${goal.periodEnd}"`,
      };
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// 데이터 저장 (동기화)
// ============================================

export async function saveEvaluationsToBigQuery(evaluations: any[]): Promise<{ success: boolean; saved?: number; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('evaluations');
    
    // BigQuery insert 형식으로 변환
    const rows = evaluations.map(evalData => ({
      evaluation_id: `${evalData.agentId}_${evalData.date}_${Date.now()}`,
      evaluation_date: evalData.date,
      center: evalData.center,
      service: evalData.service || '',
      channel: evalData.channel || 'unknown',
      agent_id: evalData.agentId,
      agent_name: evalData.agentName,
      tenure_group: evalData.tenure || '',
      attitude_error_count: evalData.attitudeErrors || 0,
      business_error_count: evalData.businessErrors || 0,
      total_error_count: (evalData.attitudeErrors || 0) + (evalData.businessErrors || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    // 배치로 나누어 삽입 (BigQuery 제한: 10,000 rows per request)
    const BATCH_SIZE = 10000;
    let savedCount = 0;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await table.insert(batch);
      savedCount += batch.length;
    }
    
    console.log(`[BigQuery] Saved ${savedCount} evaluations`);
    
    return { success: true, saved: savedCount };
  } catch (error) {
    console.error('[BigQuery] saveEvaluationsToBigQuery error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 상담사 상세 분석 데이터 조회 (AI 분석용)
// ============================================

export async function getAgentAnalysisData(
  agentId: string,
  month?: string
): Promise<{ success: boolean; data?: AgentAnalysisContext; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 이번 달
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    // 상담사 기본 정보 및 통계
    // tenure_group과 tenure_months가 없을 수 있으므로 안전하게 처리
    const agentQuery = `
      SELECT
        agent_id,
        agent_name,
        center,
        service,
        channel,
        COALESCE(MAX(tenure_group), '') as tenure_group,
        COALESCE(MAX(tenure_months), 0) as tenure_months,
        COUNT(*) as total_evaluations,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_error_rate,
        -- ops_error_count가 있으면 사용, 없으면 개별 오류 항목 합산
        ROUND(SAFE_DIVIDE(
          COALESCE(
            SUM(ops_error_count),
            SUM(CAST(consult_type_error AS INT64)) +
            SUM(CAST(guide_error AS INT64)) +
            SUM(CAST(identity_check_error AS INT64)) +
            SUM(CAST(required_search_error AS INT64)) +
            SUM(CAST(wrong_guide_error AS INT64)) +
            SUM(CAST(process_missing_error AS INT64)) +
            SUM(CAST(process_incomplete_error AS INT64)) +
            SUM(CAST(system_error AS INT64)) +
            SUM(CAST(id_mapping_error AS INT64)) +
            SUM(CAST(flag_keyword_error AS INT64)) +
            SUM(CAST(history_error AS INT64))
          ),
          COUNT(*) * 11
        ) * 100, 2) as ops_error_rate
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY agent_id, agent_name, center, service, channel
    `;
    
    // 항목별 오류 통계
    const errorBreakdownQuery = `
      SELECT
        '첫인사끝인사누락' as item_name,
        SUM(CAST(greeting_error AS INT64)) as error_count,
        COUNT(*) as total_evaluations
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '공감표현누락', SUM(CAST(empathy_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '사과표현누락', SUM(CAST(apology_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '추가문의누락', SUM(CAST(additional_inquiry_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '불친절', SUM(CAST(unkind_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '상담유형오설정', SUM(CAST(consult_type_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '가이드미준수', SUM(CAST(guide_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '본인확인누락', SUM(CAST(identity_check_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '필수탐색누락', SUM(CAST(required_search_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '오안내', SUM(CAST(wrong_guide_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '전산처리누락', SUM(CAST(process_missing_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '전산처리미흡정정', SUM(CAST(process_incomplete_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '전산조작미흡오류', SUM(CAST(system_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '콜픽트립ID매핑누락오기재', SUM(CAST(id_mapping_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '플래그키워드누락오기재', SUM(CAST(flag_keyword_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      UNION ALL
      SELECT '상담이력기재미흡', SUM(CAST(history_error AS INT64)), COUNT(*)
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
    `;
    
    const params = { agentId, month: targetMonth };
    
    // 병렬 쿼리 실행 (에러 처리 포함)
    let agentRows: any[] = [];
    let errorRows: any[] = [];
    let trendRows: any[] = [];
    
    try {
      [agentRows] = await bigquery.query({
        query: agentQuery,
        params,
        location: 'asia-northeast3',
      });
    } catch (agentError: any) {
      const errorMsg = agentError.message || '';
      // tenure_group, tenure_months 또는 ops_error_count 오류 시 fallback 쿼리
      if (errorMsg.includes('tenure_group') || errorMsg.includes('tenure_months') || errorMsg.includes('ops_error_count') || errorMsg.includes('Unrecognized name')) {
        console.warn('[BigQuery] getAgentAnalysisData fallback query:', errorMsg);
        const fallbackAgentQuery = `
          SELECT
            agent_id,
            agent_name,
            center,
            service,
            channel,
            '' as tenure_group,
            0 as tenure_months,
            COUNT(*) as total_evaluations,
            ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_error_rate,
            ROUND(SAFE_DIVIDE(
              SUM(CAST(consult_type_error AS INT64)) +
              SUM(CAST(guide_error AS INT64)) +
              SUM(CAST(identity_check_error AS INT64)) +
              SUM(CAST(required_search_error AS INT64)) +
              SUM(CAST(wrong_guide_error AS INT64)) +
              SUM(CAST(process_missing_error AS INT64)) +
              SUM(CAST(process_incomplete_error AS INT64)) +
              SUM(CAST(system_error AS INT64)) +
              SUM(CAST(id_mapping_error AS INT64)) +
              SUM(CAST(flag_keyword_error AS INT64)) +
              SUM(CAST(history_error AS INT64)),
              COUNT(*) * 11
            ) * 100, 2) as ops_error_rate
          FROM \`${DATASET_ID}.evaluations\`
          WHERE agent_id = @agentId
            AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
          GROUP BY agent_id, agent_name, center, service, channel
        `;
        [agentRows] = await bigquery.query({
          query: fallbackAgentQuery,
          params,
          location: 'asia-northeast3',
        });
      } else {
        throw agentError;
      }
    }
    
    try {
      [errorRows] = await bigquery.query({
        query: errorBreakdownQuery,
        params,
        location: 'asia-northeast3',
      });
    } catch (errorErr: any) {
      console.error('[BigQuery] Error breakdown query failed:', errorErr);
      errorRows = []; // 오류 항목 통계는 빈 배열로 처리
    }
    
    try {
      // trendQuery도 ops_error_count 대신 개별 항목 합산 사용
      const safeTrendQuery = `
        SELECT
          evaluation_date as date,
          ROUND(SAFE_DIVIDE(
            SUM(attitude_error_count) + 
            SUM(CAST(consult_type_error AS INT64)) +
            SUM(CAST(guide_error AS INT64)) +
            SUM(CAST(identity_check_error AS INT64)) +
            SUM(CAST(required_search_error AS INT64)) +
            SUM(CAST(wrong_guide_error AS INT64)) +
            SUM(CAST(process_missing_error AS INT64)) +
            SUM(CAST(process_incomplete_error AS INT64)) +
            SUM(CAST(system_error AS INT64)) +
            SUM(CAST(id_mapping_error AS INT64)) +
            SUM(CAST(flag_keyword_error AS INT64)) +
            SUM(CAST(history_error AS INT64)),
            COUNT(*) * 16
          ) * 100, 2) as error_rate
        FROM \`${DATASET_ID}.evaluations\`
        WHERE agent_id = @agentId
          AND evaluation_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        GROUP BY evaluation_date
        ORDER BY evaluation_date ASC
      `;
      [trendRows] = await bigquery.query({
        query: safeTrendQuery,
        params: { agentId },
        location: 'asia-northeast3',
      });
    } catch (trendErr: any) {
      console.error('[BigQuery] Trend query failed:', trendErr);
      trendRows = []; // 트렌드 데이터는 빈 배열로 처리
    }
    
    if (agentRows.length === 0) {
      return {
        success: false,
        error: '상담사 데이터를 찾을 수 없습니다.',
      };
    }
    
    const agent = agentRows[0];
    const attRate = Number(agent.attitude_error_rate) || 0;
    const opsRate = Number(agent.ops_error_rate) || 0;
    
    const errorBreakdown = errorRows.map((row: any) => ({
      itemName: row.item_name,
      errorCount: Number(row.error_count) || 0,
      errorRate: row.total_evaluations > 0
        ? Number((Number(row.error_count) / Number(row.total_evaluations) * 100).toFixed(2))
        : 0,
    }));
    
    const trendData = trendRows.map((row: any) => ({
      date: row.date.value || row.date,
      errorRate: Number(row.error_rate) || 0,
    }));
    
    const context: AgentAnalysisContext = {
      agentId: agent.agent_id,
      agentName: agent.agent_name,
      center: agent.center,
      service: agent.service,
      channel: agent.channel,
      tenureMonths: Number(agent.tenure_months) || 0,
      tenureGroup: agent.tenure_group || '',
      totalEvaluations: Number(agent.total_evaluations) || 0,
      attitudeErrorRate: attRate,
      opsErrorRate: opsRate,
      overallErrorRate: Number((attRate + opsRate).toFixed(2)),
      errorBreakdown,
      trendData,
    };
    
    return { success: true, data: context };
  } catch (error) {
    console.error('[BigQuery] getAgentAnalysisData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 그룹 분석 데이터 조회 (AI 분석용)
// ============================================

export async function getGroupAnalysisData(
  center: string,
  service: string,
  channel: string,
  month?: string
): Promise<{ success: boolean; data?: GroupAnalysisContext; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 이번 달
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    // 그룹 통계
    const groupStatsQuery = `
      SELECT
        center,
        service,
        channel,
        COUNT(DISTINCT agent_id) as total_agents,
        COUNT(*) as total_evaluations,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_error_rate,
        ROUND(SAFE_DIVIDE(SUM(ops_error_count), COUNT(*) * 11) * 100, 2) as ops_error_rate
      FROM \`${DATASET_ID}.evaluations\`
      WHERE center = @center
        AND service = @service
        AND channel = @channel
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY center, service, channel
    `;
    
    // 항목별 오류 통계 (상위 5개)
    const topErrorsQuery = `
      WITH error_counts AS (
        SELECT
          '첫인사끝인사누락' as item_name, SUM(CAST(greeting_error AS INT64)) as error_count, COUNT(*) as total
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '공감표현누락', SUM(CAST(empathy_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '사과표현누락', SUM(CAST(apology_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '추가문의누락', SUM(CAST(additional_inquiry_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '불친절', SUM(CAST(unkind_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '상담유형오설정', SUM(CAST(consult_type_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '가이드미준수', SUM(CAST(guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '본인확인누락', SUM(CAST(identity_check_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '필수탐색누락', SUM(CAST(required_search_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '오안내', SUM(CAST(wrong_guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '전산처리누락', SUM(CAST(process_missing_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '전산처리미흡정정', SUM(CAST(process_incomplete_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '전산조작미흡오류', SUM(CAST(system_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '콜픽트립ID매핑누락오기재', SUM(CAST(id_mapping_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '플래그키워드누락오기재', SUM(CAST(flag_keyword_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
        UNION ALL
        SELECT '상담이력기재미흡', SUM(CAST(history_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        WHERE center = @center AND service = @service AND channel = @channel
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      ),
      error_rates AS (
        SELECT
          item_name,
          error_count,
          total,
          ROUND(SAFE_DIVIDE(error_count, total) * 100, 2) as error_rate,
          COUNT(DISTINCT agent_id) as affected_agents
        FROM error_counts
        LEFT JOIN \`${DATASET_ID}.evaluations\` e
          ON e.center = @center AND e.service = @service AND e.channel = @channel
          AND FORMAT_DATE('%Y-%m', e.evaluation_date) = @month
        GROUP BY item_name, error_count, total
      )
      SELECT *
      FROM error_rates
      WHERE error_count > 0
      ORDER BY error_count DESC
      LIMIT 5
    `;
    
    // 상담사별 오류율 순위
    const agentRankingsQuery = `
      SELECT
        agent_id,
        agent_name,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count + ops_error_count), COUNT(*) * 16) * 100, 2) as error_rate
      FROM \`${DATASET_ID}.evaluations\`
      WHERE center = @center
        AND service = @service
        AND channel = @channel
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY agent_id, agent_name
      ORDER BY error_rate DESC
      LIMIT 10
    `;
    
    const params = { center, service, channel, month: targetMonth };
    
    const [groupRows] = await bigquery.query({
      query: groupStatsQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [topErrorRows] = await bigquery.query({
      query: topErrorsQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [rankingRows] = await bigquery.query({
      query: agentRankingsQuery,
      params,
      location: 'asia-northeast3',
    });
    
    if (groupRows.length === 0) {
      return {
        success: false,
        error: '그룹 데이터를 찾을 수 없습니다.',
      };
    }
    
    const group = groupRows[0];
    const attRate = Number(group.attitude_error_rate) || 0;
    const opsRate = Number(group.ops_error_rate) || 0;
    
    // affected_agents 계산을 위한 추가 쿼리 (간소화)
    const topErrors = await Promise.all(
      topErrorRows.map(async (row: any) => {
        const affectedQuery = `
          SELECT COUNT(DISTINCT agent_id) as count
          FROM \`${DATASET_ID}.evaluations\`
          WHERE center = @center
            AND service = @service
            AND channel = @channel
            AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
            AND CAST(${getErrorColumnName(row.item_name)} AS INT64) > 0
        `;
        const [affectedRows] = await bigquery.query({
          query: affectedQuery,
          params,
          location: 'asia-northeast3',
        });
        
        return {
          itemName: row.item_name,
          errorCount: Number(row.error_count) || 0,
          errorRate: Number(row.error_rate) || 0,
          affectedAgents: Number(affectedRows[0]?.count) || 0,
        };
      })
    );
    
    const context: GroupAnalysisContext = {
      center: group.center,
      service: group.service,
      channel: group.channel,
      totalAgents: Number(group.total_agents) || 0,
      totalEvaluations: Number(group.total_evaluations) || 0,
      attitudeErrorRate: attRate,
      opsErrorRate: opsRate,
      overallErrorRate: Number((attRate + opsRate).toFixed(2)),
      topErrors,
      agentRankings: rankingRows.map((row: any) => ({
        agentId: row.agent_id,
        agentName: row.agent_name,
        errorRate: Number(row.error_rate) || 0,
      })),
    };
    
    return { success: true, data: context };
  } catch (error) {
    console.error('[BigQuery] getGroupAnalysisData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 오류 항목명을 컬럼명으로 변환하는 헬퍼 함수
function getErrorColumnName(itemName: string): string {
  const mapping: Record<string, string> = {
    '첫인사끝인사누락': 'greeting_error',
    '공감표현누락': 'empathy_error',
    '사과표현누락': 'apology_error',
    '추가문의누락': 'additional_inquiry_error',
    '불친절': 'unkind_error',
    '상담유형오설정': 'consult_type_error',
    '가이드미준수': 'guide_error',
    '본인확인누락': 'identity_check_error',
    '필수탐색누락': 'required_search_error',
    '오안내': 'wrong_guide_error',
    '전산처리누락': 'process_missing_error',
    '전산처리미흡정정': 'process_incomplete_error',
    '전산조작미흡오류': 'system_error',
    '콜픽트립ID매핑누락오기재': 'id_mapping_error',
    '플래그키워드누락오기재': 'flag_keyword_error',
    '상담이력기재미흡': 'history_error',
  };
  return mapping[itemName] || 'greeting_error';
}

// ============================================
// 일자별 항목별 오류 통계 조회
// ============================================

export interface DailyErrorBreakdown {
  date: string;
  items: Array<{
    itemId: string;
    itemName: string;
    errorCount: number;
  }>;
}

export async function getDailyErrorBreakdown(
  startDate: string,
  endDate: string,
  filters?: {
    center?: string;
    service?: string;
    channel?: string;
  }
): Promise<{ success: boolean; data?: DailyErrorBreakdown[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate';
    const params: any = { startDate, endDate };
    
    if (filters?.center) {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.service) {
      whereClause += ' AND service = @service';
      params.service = filters.service;
    }
    if (filters?.channel) {
      whereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    
    const query = `
      WITH daily_errors AS (
        SELECT
          evaluation_date as date,
          '첫인사끝인사누락' as item_name,
          'att1' as item_id,
          SUM(CAST(greeting_error AS INT64)) as error_count
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '공감표현누락', 'att2', SUM(CAST(empathy_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '사과표현누락', 'att3', SUM(CAST(apology_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '추가문의누락', 'att4', SUM(CAST(additional_inquiry_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '불친절', 'att5', SUM(CAST(unkind_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '상담유형오설정', 'err1', SUM(CAST(consult_type_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '가이드미준수', 'err2', SUM(CAST(guide_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '본인확인누락', 'err3', SUM(CAST(identity_check_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '필수탐색누락', 'err4', SUM(CAST(required_search_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '오안내', 'err5', SUM(CAST(wrong_guide_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '전산처리누락', 'err6', SUM(CAST(process_missing_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '전산처리미흡정정', 'err7', SUM(CAST(process_incomplete_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '전산조작미흡오류', 'err8', SUM(CAST(system_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '콜픽트립ID매핑누락오기재', 'err9', SUM(CAST(id_mapping_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '플래그키워드누락오기재', 'err10', SUM(CAST(flag_keyword_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
        UNION ALL
        SELECT evaluation_date, '상담이력기재미흡', 'err11', SUM(CAST(history_error AS INT64))
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY evaluation_date
      )
      SELECT
        date,
        ARRAY_AGG(STRUCT(item_id, item_name, error_count)) as items
      FROM daily_errors
      GROUP BY date
      ORDER BY date ASC
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: DailyErrorBreakdown[] = rows.map((row: any) => ({
      date: row.date.value || row.date,
      items: (row.items || []).map((item: any) => ({
        itemId: item.item_id,
        itemName: item.item_name,
        errorCount: Number(item.error_count) || 0,
      })),
    }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getDailyErrorBreakdown error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 주차별 항목별 오류 통계 조회
// ============================================

export interface WeeklyErrorBreakdown {
  week: string;
  weekLabel: string;
  items: Array<{
    itemId: string;
    itemName: string;
    errorCount: number;
    errorRate: number;
  }>;
}

export async function getWeeklyErrorBreakdown(
  startDate: string,
  endDate: string,
  filters?: {
    center?: string;
    service?: string;
    channel?: string;
  }
): Promise<{ success: boolean; data?: WeeklyErrorBreakdown[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // whereClause는 테이블 별칭 없이 생성 (date_weeks CTE용)
    let baseWhereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate';
    const params: any = { startDate, endDate };
    
    if (filters?.center) {
      baseWhereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.service) {
      baseWhereClause += ' AND service = @service';
      params.service = filters.service;
    }
    if (filters?.channel) {
      baseWhereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    
    // JOIN 후 사용할 whereClause (테이블 별칭 명시)
    let joinWhereClause = 'WHERE e.evaluation_date BETWEEN @startDate AND @endDate';
    if (filters?.center) {
      joinWhereClause += ' AND e.center = @center';
    }
    if (filters?.service) {
      joinWhereClause += ' AND e.service = @service';
    }
    if (filters?.channel) {
      joinWhereClause += ' AND e.channel = @channel';
    }
    
    const query = `
      WITH date_weeks AS (
        SELECT DISTINCT
          evaluation_date,
          CASE
            WHEN EXTRACT(DAY FROM evaluation_date) <= 5 THEN 'W1'
            WHEN EXTRACT(DAY FROM evaluation_date) <= 12 THEN 'W2'
            WHEN EXTRACT(DAY FROM evaluation_date) <= 19 THEN 'W3'
            ELSE 'W4'
          END as week,
          FORMAT_DATE('%Y-%m', evaluation_date) as month
        FROM \`${DATASET_ID}.evaluations\`
        ${baseWhereClause}
      ),
      weekly_errors AS (
        SELECT
          dw.week,
          dw.month,
          '첫인사끝인사누락' as item_name,
          'att1' as item_id,
          SUM(CAST(e.greeting_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT
          dw.week,
          dw.month,
          '공감표현누락', 'att2', SUM(CAST(e.empathy_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '사과표현누락', 'att3', SUM(CAST(e.apology_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '추가문의누락', 'att4', SUM(CAST(e.additional_inquiry_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '불친절', 'att5', SUM(CAST(e.unkind_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '상담유형오설정', 'err1', SUM(CAST(e.consult_type_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '가이드미준수', 'err2', SUM(CAST(e.guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '본인확인누락', 'err3', SUM(CAST(e.identity_check_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '필수탐색누락', 'err4', SUM(CAST(e.required_search_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '오안내', 'err5', SUM(CAST(e.wrong_guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '전산처리누락', 'err6', SUM(CAST(e.process_missing_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '전산처리미흡정정', 'err7', SUM(CAST(e.process_incomplete_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '전산조작미흡오류', 'err8', SUM(CAST(e.system_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '콜픽트립ID매핑누락오기재', 'err9', SUM(CAST(e.id_mapping_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '플래그키워드누락오기재', 'err10', SUM(CAST(e.flag_keyword_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
        UNION ALL
        SELECT dw.week, dw.month, '상담이력기재미흡', 'err11', SUM(CAST(e.history_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\` e
        INNER JOIN date_weeks dw ON e.evaluation_date = dw.evaluation_date
        ${joinWhereClause}
        GROUP BY dw.week, dw.month
      )
      SELECT
        week,
        month,
        ARRAY_AGG(STRUCT(item_id, item_name, error_count, total_evaluations)) as items
      FROM weekly_errors
      GROUP BY week, month
      ORDER BY month, week
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: WeeklyErrorBreakdown[] = rows.map((row: any) => {
      const month = row.month;
      const weekNum = row.week.replace('W', '');
      return {
        week: row.week,
        weekLabel: `${month} ${weekNum}주`,
        items: (row.items || []).map((item: any) => ({
          itemId: item.item_id,
          itemName: item.item_name,
          errorCount: Number(item.error_count) || 0,
          errorRate: item.total_evaluations > 0
            ? Number((Number(item.error_count) / Number(item.total_evaluations) * 100).toFixed(1))
            : 0,
        })),
      };
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getWeeklyErrorBreakdown error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 항목별 오류 통계 조회
// ============================================

export interface ItemErrorStats {
  itemId: string;
  itemName: string;
  category: '상담태도' | '오상담/오처리';
  errorCount: number;
  errorRate: number;
  trend: number; // 전주 대비 변화
}

export async function getItemErrorStats(
  filters?: {
    center?: string;
    service?: string;
    channel?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ success: boolean; data?: ItemErrorStats[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 최근 30일
    let startDate = filters?.startDate;
    let endDate = filters?.endDate;
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      startDate = start.toISOString().split('T')[0];
    }
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate';
    const params: any = { startDate, endDate };
    
    if (filters?.center) {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.service) {
      whereClause += ' AND service = @service';
      params.service = filters.service;
    }
    if (filters?.channel) {
      whereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    
    // 전일대비 계산을 위한 이전 기간 계산
    // 현재 기간이 하루라면 전일과 비교, 여러 날이면 동일한 길이의 이전 기간과 비교
    const end = new Date(endDate);
    const start = new Date(startDate);
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // 전일대비: 어제 날짜 계산
    const yesterday = new Date(end);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // 이전 기간 계산 (현재 기간과 동일한 길이)
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - periodDays + 1);
    const prevStartDateStr = prevStart.toISOString().split('T')[0];
    const prevEndDateStr = prevEnd.toISOString().split('T')[0];
    
    // 이전 기간 whereClause 생성
    let prevWhereClause = 'WHERE evaluation_date BETWEEN @prevStartDate AND @prevEndDate';
    const prevParams: any = { prevStartDate: prevStartDateStr, prevEndDate: prevEndDateStr };
    if (filters?.center) {
      prevWhereClause += ' AND center = @center';
      prevParams.center = filters.center;
    }
    if (filters?.service) {
      prevWhereClause += ' AND service = @service';
      prevParams.service = filters.service;
    }
    if (filters?.channel) {
      prevWhereClause += ' AND channel = @channel';
      prevParams.channel = filters.channel;
    }
    
    const query = `
      WITH current_period AS (
        SELECT
          '첫인사끝인사누락' as item_name,
          'att1' as item_id,
          '상담태도' as category,
          SUM(CAST(greeting_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '공감표현누락', 'att2', '상담태도', SUM(CAST(empathy_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '사과표현누락', 'att3', '상담태도', SUM(CAST(apology_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '추가문의누락', 'att4', '상담태도', SUM(CAST(additional_inquiry_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '불친절', 'att5', '상담태도', SUM(CAST(unkind_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '상담유형오설정', 'err1', '오상담/오처리', SUM(CAST(consult_type_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '가이드미준수', 'err2', '오상담/오처리', SUM(CAST(guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '본인확인누락', 'err3', '오상담/오처리', SUM(CAST(identity_check_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '필수탐색누락', 'err4', '오상담/오처리', SUM(CAST(required_search_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '오안내', 'err5', '오상담/오처리', SUM(CAST(wrong_guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '전산처리누락', 'err6', '오상담/오처리', SUM(CAST(process_missing_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '전산처리미흡정정', 'err7', '오상담/오처리', SUM(CAST(process_incomplete_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '전산조작미흡오류', 'err8', '오상담/오처리', SUM(CAST(system_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '콜픽트립ID매핑누락오기재', 'err9', '오상담/오처리', SUM(CAST(id_mapping_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '플래그키워드누락오기재', 'err10', '오상담/오처리', SUM(CAST(flag_keyword_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '상담이력기재미흡', 'err11', '오상담/오처리', SUM(CAST(history_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
      ),
      prev_period AS (
        SELECT
          '첫인사끝인사누락' as item_name,
          'att1' as item_id,
          '상담태도' as category,
          SUM(CAST(greeting_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '공감표현누락', 'att2', '상담태도', SUM(CAST(empathy_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '사과표현누락', 'att3', '상담태도', SUM(CAST(apology_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '추가문의누락', 'att4', '상담태도', SUM(CAST(additional_inquiry_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '불친절', 'att5', '상담태도', SUM(CAST(unkind_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '상담유형오설정', 'err1', '오상담/오처리', SUM(CAST(consult_type_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '가이드미준수', 'err2', '오상담/오처리', SUM(CAST(guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '본인확인누락', 'err3', '오상담/오처리', SUM(CAST(identity_check_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '필수탐색누락', 'err4', '오상담/오처리', SUM(CAST(required_search_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '오안내', 'err5', '오상담/오처리', SUM(CAST(wrong_guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '전산처리누락', 'err6', '오상담/오처리', SUM(CAST(process_missing_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '전산처리미흡정정', 'err7', '오상담/오처리', SUM(CAST(process_incomplete_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '전산조작미흡오류', 'err8', '오상담/오처리', SUM(CAST(system_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '콜픽트립ID매핑누락오기재', 'err9', '오상담/오처리', SUM(CAST(id_mapping_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '플래그키워드누락오기재', 'err10', '오상담/오처리', SUM(CAST(flag_keyword_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
        UNION ALL
        SELECT '상담이력기재미흡', 'err11', '오상담/오처리', SUM(CAST(history_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${prevWhereClause}
      )
      SELECT
        cp.item_id,
        cp.item_name,
        cp.category,
        cp.error_count,
        cp.total_evaluations,
        ROUND(SAFE_DIVIDE(cp.error_count, cp.total_evaluations) * 100, 2) as error_rate,
        ROUND(SAFE_DIVIDE(pp.error_count, pp.total_evaluations) * 100, 2) as prev_error_rate
      FROM current_period cp
      LEFT JOIN prev_period pp ON cp.item_id = pp.item_id
      ORDER BY cp.error_count DESC
    `;
    
    const options = {
      query,
      params: { ...params, ...prevParams },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    // 전일대비 계산: 현재 오류율 - 이전 기간 오류율
    const result: ItemErrorStats[] = rows.map((row: any) => {
      const currentRate = Number(row.error_rate) || 0;
      const prevRate = Number(row.prev_error_rate) || 0;
      const trend = currentRate - prevRate; // 전일대비 증감비율
      
      return {
        itemId: row.item_id,
        itemName: row.item_name,
        category: row.category as '상담태도' | '오상담/오처리',
        errorCount: Number(row.error_count) || 0,
        errorRate: currentRate,
        trend: trend,
      };
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getItemErrorStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 근속기간별 항목별 오류 통계 조회
// ============================================

export interface TenureErrorStats {
  center: string;
  service: string;
  channel: string;
  tenureGroup: string;
  items: Record<string, number>; // itemId -> errorCount
}

export async function getTenureErrorStats(
  filters?: {
    center?: string;
    service?: string;
    channel?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ success: boolean; data?: TenureErrorStats[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    let startDate = filters?.startDate;
    let endDate = filters?.endDate;
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      startDate = start.toISOString().split('T')[0];
    }
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate';
    const params: any = { startDate, endDate };
    
    if (filters?.center) {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.service) {
      whereClause += ' AND service = @service';
      params.service = filters.service;
    }
    if (filters?.channel) {
      whereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    
    // tenure_group 컬럼 존재 여부 확인 및 fallback 쿼리
    let query = `
      WITH tenure_errors AS (
        SELECT
          center,
          service,
          channel,
          COALESCE(tenure_group, '미분류') as tenure_group,
          SUM(CAST(greeting_error AS INT64)) as att1,
          SUM(CAST(empathy_error AS INT64)) as att2,
          SUM(CAST(apology_error AS INT64)) as att3,
          SUM(CAST(additional_inquiry_error AS INT64)) as att4,
          SUM(CAST(unkind_error AS INT64)) as att5,
          SUM(CAST(consult_type_error AS INT64)) as err1,
          SUM(CAST(guide_error AS INT64)) as err2,
          SUM(CAST(identity_check_error AS INT64)) as err3,
          SUM(CAST(required_search_error AS INT64)) as err4,
          SUM(CAST(wrong_guide_error AS INT64)) as err5,
          SUM(CAST(process_missing_error AS INT64)) as err6,
          SUM(CAST(process_incomplete_error AS INT64)) as err7,
          SUM(CAST(system_error AS INT64)) as err8,
          SUM(CAST(id_mapping_error AS INT64)) as err9,
          SUM(CAST(flag_keyword_error AS INT64)) as err10,
          SUM(CAST(history_error AS INT64)) as err11
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY center, service, channel, tenure_group
      )
      SELECT *
      FROM tenure_errors
      ORDER BY center, service, channel, tenure_group
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    let rows: any[];
    try {
      [rows] = await bigquery.query(options);
    } catch (queryError: any) {
      const errorMsg = queryError.message || '';
      
      // tenure_group 컬럼이 없는 경우 fallback 쿼리 사용
      if (errorMsg.includes('tenure_group') || errorMsg.includes('Unrecognized name')) {
        console.log('[BigQuery] tenure_group not found, using fallback query with tenure_months');
        
        // tenure_months를 기반으로 tenure_group 계산
        const fallbackQuery = `
          WITH tenure_errors AS (
            SELECT
              center,
              service,
              channel,
              CASE
                WHEN COALESCE(tenure_months, 0) < 3 THEN '3개월 미만'
                WHEN COALESCE(tenure_months, 0) < 6 THEN '3개월 이상'
                WHEN COALESCE(tenure_months, 0) < 12 THEN '6개월 이상'
                ELSE '12개월 이상'
              END as tenure_group,
              SUM(CAST(greeting_error AS INT64)) as att1,
              SUM(CAST(empathy_error AS INT64)) as att2,
              SUM(CAST(apology_error AS INT64)) as att3,
              SUM(CAST(additional_inquiry_error AS INT64)) as att4,
              SUM(CAST(unkind_error AS INT64)) as att5,
              SUM(CAST(consult_type_error AS INT64)) as err1,
              SUM(CAST(guide_error AS INT64)) as err2,
              SUM(CAST(identity_check_error AS INT64)) as err3,
              SUM(CAST(required_search_error AS INT64)) as err4,
              SUM(CAST(wrong_guide_error AS INT64)) as err5,
              SUM(CAST(process_missing_error AS INT64)) as err6,
              SUM(CAST(process_incomplete_error AS INT64)) as err7,
              SUM(CAST(system_error AS INT64)) as err8,
              SUM(CAST(id_mapping_error AS INT64)) as err9,
              SUM(CAST(flag_keyword_error AS INT64)) as err10,
              SUM(CAST(history_error AS INT64)) as err11
            FROM \`${DATASET_ID}.evaluations\`
            ${whereClause}
            GROUP BY center, service, channel, tenure_group
          )
          SELECT *
          FROM tenure_errors
          ORDER BY center, service, channel, tenure_group
        `;
        
        try {
          [rows] = await bigquery.query({
            query: fallbackQuery,
            params,
            location: 'asia-northeast3',
          });
        } catch (fallbackError: any) {
          // tenure_months도 없는 경우 기본값 사용
          console.log('[BigQuery] tenure_months also not found, using default tenure_group');
          
          const defaultQuery = `
            WITH tenure_errors AS (
              SELECT
                center,
                service,
                channel,
                '미분류' as tenure_group,
                SUM(CAST(greeting_error AS INT64)) as att1,
                SUM(CAST(empathy_error AS INT64)) as att2,
                SUM(CAST(apology_error AS INT64)) as att3,
                SUM(CAST(additional_inquiry_error AS INT64)) as att4,
                SUM(CAST(unkind_error AS INT64)) as att5,
                SUM(CAST(consult_type_error AS INT64)) as err1,
                SUM(CAST(guide_error AS INT64)) as err2,
                SUM(CAST(identity_check_error AS INT64)) as err3,
                SUM(CAST(required_search_error AS INT64)) as err4,
                SUM(CAST(wrong_guide_error AS INT64)) as err5,
                SUM(CAST(process_missing_error AS INT64)) as err6,
                SUM(CAST(process_incomplete_error AS INT64)) as err7,
                SUM(CAST(system_error AS INT64)) as err8,
                SUM(CAST(id_mapping_error AS INT64)) as err9,
                SUM(CAST(flag_keyword_error AS INT64)) as err10,
                SUM(CAST(history_error AS INT64)) as err11
              FROM \`${DATASET_ID}.evaluations\`
              ${whereClause}
              GROUP BY center, service, channel
            )
            SELECT *
            FROM tenure_errors
            ORDER BY center, service, channel
          `;
          
          [rows] = await bigquery.query({
            query: defaultQuery,
            params,
            location: 'asia-northeast3',
          });
        }
      } else {
        throw queryError;
      }
    }
    
    const result: TenureErrorStats[] = rows.map((row: any) => ({
      center: row.center,
      service: row.service,
      channel: row.channel,
      tenureGroup: row.tenure_group,
      items: {
        att1: Number(row.att1) || 0,
        att2: Number(row.att2) || 0,
        att3: Number(row.att3) || 0,
        att4: Number(row.att4) || 0,
        att5: Number(row.att5) || 0,
        err1: Number(row.err1) || 0,
        err2: Number(row.err2) || 0,
        err3: Number(row.err3) || 0,
        err4: Number(row.err4) || 0,
        err5: Number(row.err5) || 0,
        err6: Number(row.err6) || 0,
        err7: Number(row.err7) || 0,
        err8: Number(row.err8) || 0,
        err9: Number(row.err9) || 0,
        err10: Number(row.err10) || 0,
        err11: Number(row.err11) || 0,
      },
    }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getTenureErrorStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 서비스별 주차별 항목별 오류 통계 조회
// ============================================

export interface ServiceWeeklyStats {
  center: string;
  service: string;
  channel: string;
  week: string;
  items: Record<string, { count: number; rate: number }>; // itemId -> {count, rate}
}

export async function getServiceWeeklyStats(
  month: string,
  filters?: {
    center?: string;
    service?: string;
    channel?: string;
  }
): Promise<{ success: boolean; data?: ServiceWeeklyStats[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    let whereClause = `WHERE FORMAT_DATE('%Y-%m', evaluation_date) = @month`;
    const params: any = { month };
    
    if (filters?.center) {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.service) {
      whereClause += ' AND service = @service';
      params.service = filters.service;
    }
    if (filters?.channel) {
      whereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    
    const query = `
      WITH service_weekly AS (
        SELECT
          center,
          service,
          channel,
          CASE
            WHEN EXTRACT(DAY FROM evaluation_date) <= 5 THEN 'W1'
            WHEN EXTRACT(DAY FROM evaluation_date) <= 12 THEN 'W2'
            WHEN EXTRACT(DAY FROM evaluation_date) <= 19 THEN 'W3'
            ELSE 'W4'
          END as week,
          SUM(CAST(greeting_error AS INT64)) as att1_count,
          SUM(CAST(empathy_error AS INT64)) as att2_count,
          SUM(CAST(apology_error AS INT64)) as att3_count,
          SUM(CAST(additional_inquiry_error AS INT64)) as att4_count,
          SUM(CAST(unkind_error AS INT64)) as att5_count,
          SUM(CAST(consult_type_error AS INT64)) as err1_count,
          SUM(CAST(guide_error AS INT64)) as err2_count,
          SUM(CAST(identity_check_error AS INT64)) as err3_count,
          SUM(CAST(required_search_error AS INT64)) as err4_count,
          SUM(CAST(wrong_guide_error AS INT64)) as err5_count,
          SUM(CAST(process_missing_error AS INT64)) as err6_count,
          SUM(CAST(process_incomplete_error AS INT64)) as err7_count,
          SUM(CAST(system_error AS INT64)) as err8_count,
          SUM(CAST(id_mapping_error AS INT64)) as err9_count,
          SUM(CAST(flag_keyword_error AS INT64)) as err10_count,
          SUM(CAST(history_error AS INT64)) as err11_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY center, service, channel, week
      )
      SELECT *
      FROM service_weekly
      ORDER BY center, service, channel, week
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: ServiceWeeklyStats[] = rows.map((row: any) => {
      const totalEvals = Number(row.total_evaluations) || 1;
      return {
        center: row.center,
        service: row.service,
        channel: row.channel,
        week: row.week,
        items: {
          att1: {
            count: Number(row.att1_count) || 0,
            rate: Number((Number(row.att1_count) / totalEvals * 100).toFixed(1)),
          },
          att2: {
            count: Number(row.att2_count) || 0,
            rate: Number((Number(row.att2_count) / totalEvals * 100).toFixed(1)),
          },
          att3: {
            count: Number(row.att3_count) || 0,
            rate: Number((Number(row.att3_count) / totalEvals * 100).toFixed(1)),
          },
          att4: {
            count: Number(row.att4_count) || 0,
            rate: Number((Number(row.att4_count) / totalEvals * 100).toFixed(1)),
          },
          att5: {
            count: Number(row.att5_count) || 0,
            rate: Number((Number(row.att5_count) / totalEvals * 100).toFixed(1)),
          },
          err1: {
            count: Number(row.err1_count) || 0,
            rate: Number((Number(row.err1_count) / totalEvals * 100).toFixed(1)),
          },
          err2: {
            count: Number(row.err2_count) || 0,
            rate: Number((Number(row.err2_count) / totalEvals * 100).toFixed(1)),
          },
          err3: {
            count: Number(row.err3_count) || 0,
            rate: Number((Number(row.err3_count) / totalEvals * 100).toFixed(1)),
          },
          err4: {
            count: Number(row.err4_count) || 0,
            rate: Number((Number(row.err4_count) / totalEvals * 100).toFixed(1)),
          },
          err5: {
            count: Number(row.err5_count) || 0,
            rate: Number((Number(row.err5_count) / totalEvals * 100).toFixed(1)),
          },
          err6: {
            count: Number(row.err6_count) || 0,
            rate: Number((Number(row.err6_count) / totalEvals * 100).toFixed(1)),
          },
          err7: {
            count: Number(row.err7_count) || 0,
            rate: Number((Number(row.err7_count) / totalEvals * 100).toFixed(1)),
          },
          err8: {
            count: Number(row.err8_count) || 0,
            rate: Number((Number(row.err8_count) / totalEvals * 100).toFixed(1)),
          },
          err9: {
            count: Number(row.err9_count) || 0,
            rate: Number((Number(row.err9_count) / totalEvals * 100).toFixed(1)),
          },
          err10: {
            count: Number(row.err10_count) || 0,
            rate: Number((Number(row.err10_count) / totalEvals * 100).toFixed(1)),
          },
          err11: {
            count: Number(row.err11_count) || 0,
            rate: Number((Number(row.err11_count) / totalEvals * 100).toFixed(1)),
          },
        },
      };
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getServiceWeeklyStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 상담사별 상세 통계 조회 (항목별 오류, 일별 트렌드)
// ============================================

export interface AgentDetailStats {
  agentId: string;
  agentName: string;
  dailyTrend: Array<{
    date: string;
    errorRate: number;
  }>;
  itemErrors: Array<{
    itemId: string;
    itemName: string;
    errorCount: number;
    category: '상담태도' | '오상담/오처리';
  }>;
}

export async function getAgentDetailStats(
  agentId: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; data?: AgentDetailStats; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      startDate = start.toISOString().split('T')[0];
    }
    
    // 일별 트렌드
    const trendQuery = `
      SELECT
        evaluation_date as date,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count + business_error_count), COUNT(*) * 16) * 100, 2) as error_rate
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId
        AND evaluation_date BETWEEN @startDate AND @endDate
      GROUP BY evaluation_date
      ORDER BY evaluation_date ASC
    `;
    
    // 항목별 오류 통계
    const itemQuery = `
      SELECT
        '첫인사끝인사누락' as item_name,
        'att1' as item_id,
        '상담태도' as category,
        SUM(CAST(greeting_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '공감표현누락', 'att2', '상담태도', SUM(CAST(empathy_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '사과표현누락', 'att3', '상담태도', SUM(CAST(apology_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '추가문의누락', 'att4', '상담태도', SUM(CAST(additional_inquiry_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '불친절', 'att5', '상담태도', SUM(CAST(unkind_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '상담유형오설정', 'err1', '오상담/오처리', SUM(CAST(consult_type_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '가이드미준수', 'err2', '오상담/오처리', SUM(CAST(guide_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '본인확인누락', 'err3', '오상담/오처리', SUM(CAST(identity_check_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '필수탐색누락', 'err4', '오상담/오처리', SUM(CAST(required_search_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '오안내', 'err5', '오상담/오처리', SUM(CAST(wrong_guide_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '전산처리누락', 'err6', '오상담/오처리', SUM(CAST(process_missing_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '전산처리미흡정정', 'err7', '오상담/오처리', SUM(CAST(process_incomplete_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '전산조작미흡오류', 'err8', '오상담/오처리', SUM(CAST(system_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '콜픽트립ID매핑누락오기재', 'err9', '오상담/오처리', SUM(CAST(id_mapping_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '플래그키워드누락오기재', 'err10', '오상담/오처리', SUM(CAST(flag_keyword_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
      UNION ALL
      SELECT '상담이력기재미흡', 'err11', '오상담/오처리', SUM(CAST(history_error AS INT64))
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId AND evaluation_date BETWEEN @startDate AND @endDate
    `;
    
    // 상담사 이름 조회
    const nameQuery = `
      SELECT DISTINCT agent_name
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId
      LIMIT 1
    `;
    
    const params = { agentId, startDate, endDate };
    
    const [trendRows] = await bigquery.query({
      query: trendQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [itemRows] = await bigquery.query({
      query: itemQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [nameRows] = await bigquery.query({
      query: nameQuery,
      params: { agentId },
      location: 'asia-northeast3',
    });
    
    const agentName = nameRows[0]?.agent_name || '';
    
    const result: AgentDetailStats = {
      agentId,
      agentName,
      dailyTrend: trendRows.map((row: any) => ({
        date: row.date.value || row.date,
        errorRate: Number(row.error_rate) || 0,
      })),
      itemErrors: itemRows.map((row: any) => ({
        itemId: row.item_id,
        itemName: row.item_name,
        errorCount: Number(row.error_count) || 0,
        category: row.category as '상담태도' | '오상담/오처리',
      })),
    };
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getAgentDetailStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 목표별 현재 실적 계산
// ============================================

export interface GoalCurrentRate {
  goalId: string;
  currentRate: number;
  progress: number; // 기간 경과율 (0-100)
}

export async function getGoalCurrentRate(
  goalId: string,
  goalType: 'attitude' | 'ops' | 'total',
  center: string | null,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; data?: GoalCurrentRate; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const today = new Date();
    const goalStart = new Date(startDate);
    const goalEnd = new Date(endDate);
    const totalDays = Math.ceil((goalEnd.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24));
    const passedDays = Math.ceil((today.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24));
    const progress = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)));
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate';
    const params: any = { startDate, endDate };
    
    if (center) {
      whereClause += ' AND center = @center';
      params.center = center;
    }
    
    let rateQuery = '';
    if (goalType === 'attitude') {
      rateQuery = `
        SELECT
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as current_rate
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
      `;
    } else if (goalType === 'ops') {
      rateQuery = `
        SELECT
          ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as current_rate
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
      `;
    } else {
      rateQuery = `
        SELECT
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count + business_error_count), COUNT(*) * 16) * 100, 2) as current_rate
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
      `;
    }
    
    const options = {
      query: rateQuery,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const currentRate = rows[0] ? Number(rows[0].current_rate) || 0 : 0;
    
    return {
      success: true,
      data: {
        goalId,
        currentRate,
        progress,
      },
    };
  } catch (error) {
    console.error('[BigQuery] getGoalCurrentRate error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 리포트 생성용 통계 데이터 조회
// ============================================

export interface ReportData {
  summary: {
    totalEvaluations: number;
    totalAgents: number;
    overallErrorRate: number;
    attitudeErrorRate: number;
    processErrorRate: number;
    errorRateTrend: number;
  };
  topIssues: Array<{
    name: string;
    count: number;
    rate: number;
  }>;
  centerComparison: Array<{
    name: string;
    errorRate: number;
    agents: number;
  }>;
  dailyTrend: Array<{
    date: string;
    errorRate: number;
    target: number;
  }>;
  groupRanking: Array<{
    group: string;
    center: string;
    errorRate: number;
    trend: number;
  }>;
}

export async function getReportData(
  reportType: 'weekly' | 'monthly' | 'quarterly' | 'halfYear' | 'yearly' | 'custom',
  period: string,
  filters?: {
    center?: string;
    service?: string;
    channel?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ success: boolean; data?: ReportData; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기간 계산
    let startDate = filters?.startDate;
    let endDate = filters?.endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      switch (reportType) {
        case 'weekly':
          endDate = now.toISOString().split('T')[0];
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
          break;
        case 'quarterly':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().split('T')[0];
          break;
        case 'halfYear':
          const half = Math.floor(now.getMonth() / 6);
          startDate = new Date(now.getFullYear(), half * 6, 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), (half + 1) * 6, 0).toISOString().split('T')[0];
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
          break;
        default:
          endDate = now.toISOString().split('T')[0];
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
    }
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate';
    const params: any = { startDate, endDate };
    
    if (filters?.center) {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.service) {
      whereClause += ' AND service = @service';
      params.service = filters.service;
    }
    if (filters?.channel) {
      whereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    
    // 요약 통계
    const summaryQuery = `
      SELECT
        COUNT(*) as total_evaluations,
        COUNT(DISTINCT agent_id) as total_agents,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_error_rate,
        ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as process_error_rate
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
    `;
    
    // 이전 기간과 비교 (트렌드 계산)
    const prevPeriodDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - prevPeriodDays);
    const prevEndDate = startDate;
    
    const prevSummaryQuery = `
      SELECT
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count + business_error_count), COUNT(*) * 16) * 100, 2) as prev_error_rate
      FROM \`${DATASET_ID}.evaluations\`
      WHERE evaluation_date BETWEEN @prevStartDate AND @prevEndDate
        ${filters?.center ? 'AND center = @center' : ''}
        ${filters?.service ? 'AND service = @service' : ''}
        ${filters?.channel ? 'AND channel = @channel' : ''}
    `;
    
    // 상위 오류 항목
    const topIssuesQuery = `
      WITH item_errors AS (
        SELECT '첫인사끝인사누락' as item_name, SUM(CAST(greeting_error AS INT64)) as error_count, COUNT(*) as total
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '공감표현누락', SUM(CAST(empathy_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '사과표현누락', SUM(CAST(apology_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '추가문의누락', SUM(CAST(additional_inquiry_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '불친절', SUM(CAST(unkind_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '상담유형오설정', SUM(CAST(consult_type_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '가이드미준수', SUM(CAST(guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '본인확인누락', SUM(CAST(identity_check_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '필수탐색누락', SUM(CAST(required_search_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '오안내', SUM(CAST(wrong_guide_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '전산처리누락', SUM(CAST(process_missing_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '전산처리미흡정정', SUM(CAST(process_incomplete_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '전산조작미흡오류', SUM(CAST(system_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '콜픽트립ID매핑누락오기재', SUM(CAST(id_mapping_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '플래그키워드누락오기재', SUM(CAST(flag_keyword_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        UNION ALL
        SELECT '상담이력기재미흡', SUM(CAST(history_error AS INT64)), COUNT(*)
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
      )
      SELECT
        item_name,
        error_count,
        ROUND(SAFE_DIVIDE(error_count, total) * 100, 2) as error_rate
      FROM item_errors
      WHERE error_count > 0
      ORDER BY error_count DESC
      LIMIT 5
    `;
    
    // 센터별 비교
    const centerComparisonQuery = `
      SELECT
        center as name,
        COUNT(DISTINCT agent_id) as agents,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count + business_error_count), COUNT(*) * 16) * 100, 2) as error_rate
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY center
    `;
    
    // 일별 트렌드
    const dailyTrendQuery = `
      SELECT
        evaluation_date as date,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count + business_error_count), COUNT(*) * 16) * 100, 2) as error_rate
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      ORDER BY evaluation_date ASC
    `;
    
    // 그룹별 순위
    const groupRankingQuery = `
      SELECT
        CONCAT(service, '/', channel) as group,
        center,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count + business_error_count), COUNT(*) * 16) * 100, 2) as error_rate
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY center, service, channel
      ORDER BY error_rate ASC
      LIMIT 20
    `;
    
    const [summaryRows] = await bigquery.query({
      query: summaryQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [prevSummaryRows] = await bigquery.query({
      query: prevSummaryQuery,
      params: { ...params, prevStartDate, prevEndDate },
      location: 'asia-northeast3',
    });
    
    const [topIssuesRows] = await bigquery.query({
      query: topIssuesQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [centerRows] = await bigquery.query({
      query: centerComparisonQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [dailyRows] = await bigquery.query({
      query: dailyTrendQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const [groupRows] = await bigquery.query({
      query: groupRankingQuery,
      params,
      location: 'asia-northeast3',
    });
    
    const summary = summaryRows[0];
    const prevSummary = prevSummaryRows[0];
    const attRate = Number(summary?.attitude_error_rate) || 0;
    const procRate = Number(summary?.process_error_rate) || 0;
    const overallRate = Number((attRate + procRate).toFixed(2));
    const prevRate = Number(prevSummary?.prev_error_rate) || 0;
    
    const result: ReportData = {
      summary: {
        totalEvaluations: Number(summary?.total_evaluations) || 0,
        totalAgents: Number(summary?.total_agents) || 0,
        overallErrorRate: overallRate,
        attitudeErrorRate: attRate,
        processErrorRate: procRate,
        errorRateTrend: Number((overallRate - prevRate).toFixed(2)),
      },
      topIssues: topIssuesRows.map((row: any) => ({
        name: row.item_name,
        count: Number(row.error_count) || 0,
        rate: Number(row.error_rate) || 0,
      })),
      centerComparison: centerRows.map((row: any) => ({
        name: row.name,
        errorRate: Number(row.error_rate) || 0,
        agents: Number(row.agents) || 0,
      })),
      dailyTrend: dailyRows.map((row: any) => ({
        date: row.date.value || row.date,
        errorRate: Number(row.error_rate) || 0,
        target: 3.0,
      })),
      groupRanking: groupRows.map((row: any) => ({
        group: row.group,
        center: row.center,
        errorRate: Number(row.error_rate) || 0,
        trend: 0, // TODO: 이전 기간과 비교
      })),
    };
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getReportData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  getDashboardStats,
  getCenterStats,
  getDailyTrend,
  getAgents,
  getEvaluations,
  getWatchList,
  getGoals,
  saveEvaluationsToBigQuery,
  getAgentAnalysisData,
  getGroupAnalysisData,
  getDailyErrorBreakdown,
  getWeeklyErrorBreakdown,
  getItemErrorStats,
  getTenureErrorStats,
  getServiceWeeklyStats,
  getAgentDetailStats,
  getGoalCurrentRate,
  getReportData,
  checkAgentExists,
  saveGoalToBigQuery,
};

// ============================================
// 상담사 존재 여부 확인 (임시 디버깅용)
// ============================================

export async function checkAgentExists(
  agentName?: string,
  agentId?: string
): Promise<{ success: boolean; found?: boolean; agents?: Array<{ agent_id: string; agent_name: string }>; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    
    if (agentName) {
      whereClause += ' AND agent_name = @agentName';
      params.agentName = agentName;
    }
    
    if (agentId) {
      whereClause += ' AND agent_id = @agentId';
      params.agentId = agentId;
    }
    
    const query = `
      SELECT DISTINCT
        agent_id,
        agent_name
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      ORDER BY agent_name, agent_id
      LIMIT 20
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    return {
      success: true,
      found: rows.length > 0,
      agents: rows.map((row: any) => ({
        agent_id: row.agent_id,
        agent_name: row.agent_name,
      })),
    };
  } catch (error) {
    console.error('[BigQuery] checkAgentExists error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
