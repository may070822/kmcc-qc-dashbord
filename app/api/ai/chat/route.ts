import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/lib/vertex-ai';
import { getAgentAnalysisData, getGroupAnalysisData } from '@/lib/bigquery';
import {
  createAgentAnalysisPrompt,
  createGroupAnalysisPrompt,
  createGeneralPrompt,
  createCoachingPrompt,
  createAutoAnalysisPrompt,
} from '@/lib/ai-prompts';
import { AIChatRequest } from '@/lib/types';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/ai/chat
export async function POST(request: NextRequest) {
  try {
    const body: AIChatRequest = await request.json();
    const { message, agentId, group, context } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '메시지가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    let prompt: string;
    let systemInstruction: string | undefined;

    // 상담사 분석 요청
    if (agentId) {
      console.log('[AI Chat] Agent analysis request:', { agentId, message });
      
      const month = context?.month as string || new Date().toISOString().slice(0, 7);
      const agentData = await getAgentAnalysisData(agentId, month);

      if (!agentData.success || !agentData.data) {
        return NextResponse.json(
          { success: false, error: agentData.error || '상담사 데이터를 가져올 수 없습니다.' },
          { status: 500, headers: corsHeaders }
        );
      }

      // 자동 분석 요청인지 확인 (최근 1개월간 추이, 강점, 약점 등 포함)
      const isAutoAnalysis = 
        message.includes('최근 1개월간') || 
        message.includes('추이') || 
        message.includes('강점') || 
        message.includes('약점') ||
        message.includes('종합적으로 분석');

      // 코칭 제안 질문인지 확인
      const isCoachingRequest = 
        message.includes('코칭') || 
        message.includes('어떤 코칭') || 
        message.includes('코칭 계획') ||
        message.includes('개선 방안');

      if (isAutoAnalysis) {
        prompt = createAutoAnalysisPrompt(agentData.data, false);
      } else if (isCoachingRequest) {
        prompt = createCoachingPrompt(agentData.data, false);
      } else {
        prompt = createAgentAnalysisPrompt(message, agentData.data);
      }

      systemInstruction = `당신은 카카오모빌리티 고객센터 QC 품질관리 전문가입니다.
상담사의 품질 평가 데이터를 분석하고 구체적이고 실행 가능한 코칭 제안을 제공해주세요.`;

    } 
    // 그룹 분석 요청
    else if (group?.center && group?.service && group?.channel) {
      console.log('[AI Chat] Group analysis request:', { group, message });
      
      const month = context?.month as string || new Date().toISOString().slice(0, 7);
      const groupData = await getGroupAnalysisData(
        group.center,
        group.service,
        group.channel,
        month
      );

      if (!groupData.success || !groupData.data) {
        return NextResponse.json(
          { success: false, error: groupData.error || '그룹 데이터를 가져올 수 없습니다.' },
          { status: 500, headers: corsHeaders }
        );
      }

      // 자동 분석 요청인지 확인
      const isAutoAnalysis = 
        message.includes('최근 1개월간') || 
        message.includes('추이') || 
        message.includes('강점') || 
        message.includes('약점') ||
        message.includes('종합적으로 분석');

      // 코칭 제안 질문인지 확인
      const isCoachingRequest = 
        message.includes('코칭') || 
        message.includes('어떤 코칭') || 
        message.includes('코칭 계획') ||
        message.includes('개선 방안');

      if (isAutoAnalysis) {
        prompt = createAutoAnalysisPrompt(groupData.data, true);
      } else if (isCoachingRequest) {
        prompt = createCoachingPrompt(groupData.data, true);
      } else {
        prompt = createGroupAnalysisPrompt(message, groupData.data);
      }

      systemInstruction = `당신은 카카오모빌리티 고객센터 QC 품질관리 전문가입니다.
그룹의 품질 평가 데이터를 분석하고 그룹 단위 코칭 전략을 제안해주세요.`;

    } 
    // 일반 질문
    else {
      console.log('[AI Chat] General question:', { message });
      prompt = createGeneralPrompt(message);
      systemInstruction = `당신은 카카오모빌리티 고객센터 QC 품질관리 전문가입니다.
QC 평가 체계, 상담 품질 관리, 코칭 방법 등에 대해 전문적인 답변을 제공해주세요.`;
    }

    // Vertex AI 호출
    const aiResponse = await callGemini(prompt, systemInstruction);

    return NextResponse.json(
      {
        success: true,
        message: aiResponse,
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI 응답 생성 중 오류가 발생했습니다.',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
