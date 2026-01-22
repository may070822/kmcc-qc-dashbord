"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WatchlistTable, type WatchlistAgent } from "./watchlist-table"
import { ActionPlanModal, type ActionPlanData } from "./action-plan-modal"
import { ActionPlanHistory } from "./action-plan-history"
import { ImprovementStats } from "./improvement-stats"
import { AlertTriangle, FileText, Download, Loader2 } from "lucide-react"
import { groups, tenures } from "@/lib/mock-data"
import { useWatchList } from "@/hooks/use-watchlist"

export function FocusManagement() {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<WatchlistAgent | null>(null)

  // BigQuery에서 집중관리 대상 가져오기
  const { data: watchlistData, loading, error } = useWatchList({
    center: selectedCenter,
    channel: selectedChannel,
    tenure: selectedTenure,
  })

  // WatchlistAgent 형식으로 변환
  const watchlistAgents: WatchlistAgent[] = useMemo(() => {
    return (watchlistData || []).map((agent) => ({
      id: agent.agentId, // 실제 agent_id만 사용
      name: agent.agentName,
      center: agent.center,
      group: `${agent.service}/${agent.channel}`,
      channel: agent.channel,
      tenure: "분석 중", // TODO: tenure 정보 추가 필요
      attitudeRate: agent.attitudeRate,
      counselingRate: agent.opsRate,
      errorRate: agent.totalRate,
      trend: 0, // TODO: 전주 대비 계산
      daysOnList: 1, // TODO: 등록일 기반 계산
      // topErrors는 이미 "공감표현누락(39)" 형식의 문자열 배열
      mainIssue: agent.topErrors?.[0] || agent.reason,
      actionPlanStatus: "none" as const, // TODO: action plan 상태 연동
    }))
  }, [watchlistData])

  const filteredAgents = useMemo(() => {
    return watchlistAgents.filter((a) => {
      if (selectedCenter !== "all" && a.center !== selectedCenter) return false
      if (selectedChannel !== "all" && a.channel !== selectedChannel) return false
      if (selectedTenure !== "all" && a.tenure !== selectedTenure) return false
      return true
    })
  }, [watchlistAgents, selectedCenter, selectedChannel, selectedTenure])

  // 액션 플랜 히스토리 조회
  const [actionPlanHistory, setActionPlanHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  useEffect(() => {
    const fetchActionPlans = async () => {
      setLoadingHistory(true)
      try {
        const response = await fetch("/api/action-plans")
        const result = await response.json()
        
        if (result.success && result.data) {
          setActionPlanHistory(result.data)
        } else {
          // 데이터가 없으면 빈 배열 유지
          setActionPlanHistory([])
        }
      } catch (err) {
        console.error("Failed to fetch action plans:", err)
        setActionPlanHistory([])
      } finally {
        setLoadingHistory(false)
      }
    }
    
    fetchActionPlans()
  }, [])

  const handleSelectAgent = (id: string) => {
    setSelectedAgents((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    if (selectedAgents.length === filteredAgents.length) {
      setSelectedAgents([])
    } else {
      setSelectedAgents(filteredAgents.map((a) => a.id))
    }
  }

  const handleCreatePlan = (agent: WatchlistAgent) => {
    console.log("Creating plan for agent:", agent)
    setSelectedAgent(agent)
    setPlanModalOpen(true)
  }

  const handleSavePlan = async (plan: ActionPlanData) => {
    console.log("Saving plan:", plan)
    try {
      const response = await fetch("/api/action-plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(plan),
      })
      
      const result = await response.json()
      
      if (result.success) {
        // 성공 시 모달 닫기 및 상태 초기화
        setPlanModalOpen(false)
        setSelectedAgent(null)
        // TODO: 목록 새로고침 또는 성공 메시지 표시
      } else {
        console.error("Failed to save action plan:", result.error)
        // TODO: 에러 메시지 표시
      }
    } catch (error) {
      console.error("Error saving action plan:", error)
      // TODO: 에러 메시지 표시
    }
  }
  
  const handleModalClose = (open: boolean) => {
    setPlanModalOpen(open)
    if (!open) {
      setSelectedAgent(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          <strong>데이터 로드 오류:</strong> {error}
        </div>
      )}
      
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}
      
      <ImprovementStats
        totalPlans={45}
        completedPlans={28}
        inProgressPlans={12}
        delayedPlans={5}
        avgImprovement={2.3}
        successRate={62}
      />

      <Tabs defaultValue="watchlist" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="watchlist" className="gap-2 data-[state=active]:bg-white">
              <AlertTriangle className="h-4 w-4" />
              유의상담사
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-white">
              <FileText className="h-4 w-4" />
              액션플랜 이력
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedCenter} onValueChange={setSelectedCenter}>
              <SelectTrigger className="w-28 bg-white border-slate-200">
                <SelectValue placeholder="센터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 센터</SelectItem>
                <SelectItem value="용산">용산</SelectItem>
                <SelectItem value="광주">광주</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-28 bg-white border-slate-200">
                <SelectValue placeholder="채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 채널</SelectItem>
                <SelectItem value="유선">유선</SelectItem>
                <SelectItem value="채팅">채팅</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedTenure} onValueChange={setSelectedTenure}>
              <SelectTrigger className="w-32 bg-white border-slate-200">
                <SelectValue placeholder="근속기간" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                {tenures.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="border-slate-200 bg-transparent">
              <Download className="mr-2 h-4 w-4" />
              내보내기
            </Button>
          </div>
        </div>

        <TabsContent value="watchlist">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-900">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  유의상담사 목록
                  <span className="text-sm font-normal text-slate-500">({filteredAgents.length}명)</span>
                </span>
                {selectedAgents.length > 0 && (
                  <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                    선택된 {selectedAgents.length}명 일괄 처리
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WatchlistTable
                agents={filteredAgents}
                selectedAgents={selectedAgents}
                onSelectAgent={handleSelectAgent}
                onSelectAll={handleSelectAll}
                onCreatePlan={handleCreatePlan}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <ActionPlanHistory plans={actionPlanHistory} onViewDetail={(plan) => console.log("View:", plan)} />
        </TabsContent>
      </Tabs>

      <ActionPlanModal
        open={planModalOpen}
        onOpenChange={handleModalClose}
        agent={selectedAgent}
        onSave={handleSavePlan}
      />
    </div>
  )
}
