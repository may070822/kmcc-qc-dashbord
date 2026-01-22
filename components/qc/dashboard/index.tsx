"use client"

import { useState, useEffect } from "react"
import { OverviewSection } from "./overview-section"
import { CenterComparison } from "./center-comparison"
import { ErrorTrendChart } from "./error-trend-chart"
import { ItemAnalysis } from "./item-analysis"
import { DashboardFilters } from "./dashboard-filters"
import { GoalStatusBoard } from "./goal-status-board"
import { DailyErrorTable } from "./daily-error-table"
import { WeeklyErrorTable } from "./weekly-error-table"
import { TenureErrorTable } from "./tenure-error-table"
import { ServiceWeeklyTable } from "./service-weekly-table"
import { useDashboardData, defaultStats } from "@/lib/use-dashboard-data"
import { generateTrendData } from "@/lib/mock-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"

interface DashboardProps {
  onNavigateToFocus: () => void
}

export function Dashboard({ onNavigateToFocus }: DashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [isMounted, setIsMounted] = useState(false)
  
  // 날짜 상태 (기본값: 전날)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const defaultDate = yesterday.toISOString().split('T')[0]
  const [dateRange, setDateRange] = useState({
    startDate: defaultDate,
    endDate: defaultDate,
  })

  // 클라이언트 마운트 확인 (hydration 안전)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Firebase에서 실제 데이터 가져오기 (선택된 날짜 기준)
  const { stats, centerStats, trendData, loading, error, refresh } = useDashboardData(
    dateRange.startDate,
    dateRange.startDate,
    dateRange.endDate
  )

  // 로딩 중이거나 데이터가 없으면 기본값 사용
  const dashboardStats = stats || defaultStats

  // 트렌드 차트 데이터 (실제 데이터 사용)
  const chartTrendData = trendData.length > 0
    ? trendData.map(t => ({
        date: new Date(t.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
        용산_태도: t.yongsanAttitude ?? t.yongsan,
        용산_오상담: t.yongsanOps ?? t.yongsan,
        용산_합계: t.yongsanTotal ?? t.yongsan,
        광주_태도: t.gwangjuAttitude ?? t.gwangju,
        광주_오상담: t.gwangjuOps ?? t.gwangju,
        광주_합계: t.gwangjuTotal ?? t.gwangju,
        목표: 3.0,
      }))
    : []

  // 전일 대비 트렌드 계산 (useState로 관리)
  const [trends, setTrends] = useState({
    attitudeTrend: 0,
    consultTrend: 0,
    overallTrend: 0,
  })

  useEffect(() => {
    const calculateTrends = async () => {
      if (!stats) return
      
      try {
        // 현재 선택된 날짜의 전일 계산
        const currentDate = new Date(dateRange.startDate || dateRange.endDate)
        const previousDate = new Date(currentDate)
        previousDate.setDate(previousDate.getDate() - 1)
        const previousDateStr = previousDate.toISOString().split('T')[0]
        
        // 전일 데이터 조회
        const response = await fetch(`/api/data?type=dashboard&date=${previousDateStr}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          const previousStats = result.data
          
          // 전일 대비 변화율 계산 (percentage point)
          const attitudeTrend = Number((stats.attitudeErrorRate - previousStats.attitudeErrorRate).toFixed(2))
          const consultTrend = Number((stats.businessErrorRate - previousStats.businessErrorRate).toFixed(2))
          const overallTrend = Number((stats.overallErrorRate - previousStats.overallErrorRate).toFixed(2))
          
          setTrends({
            attitudeTrend,
            consultTrend,
            overallTrend,
          })
        } else {
          // 전일 데이터가 없으면 0으로 설정 (화살표 표시 안 함)
          setTrends({
            attitudeTrend: 0,
            consultTrend: 0,
            overallTrend: 0,
          })
        }
      } catch (err) {
        console.error('Failed to calculate trends:', err)
        // 에러 발생 시에도 0으로 설정
        setTrends({
          attitudeTrend: 0,
          consultTrend: 0,
          overallTrend: 0,
        })
      }
    }
    
    calculateTrends()
  }, [stats, dateRange.startDate, dateRange.endDate])

  // 센터 데이터 변환 (CenterComparison 컴포넌트용)
  const centerData = centerStats.length > 0
    ? centerStats.map(center => ({
        name: center.name,
        errorRate: center.errorRate,
        trend: center.trend || 0, // BigQuery에서 계산한 트렌드 사용
        targetRate: 3.0,
        groups: center.services.map(svc => ({
          name: svc.name,
          errorRate: svc.errorRate,
          agentCount: svc.agentCount || 0,
          trend: svc.trend || 0, // 서비스별 트렌드 사용
        })),
      }))
    : [
        {
          name: "용산",
          errorRate: 0,
          trend: 0,
          targetRate: 3.0,
          groups: [],
        },
        {
          name: "광주",
          errorRate: 0,
          trend: 0,
          targetRate: 3.0,
          groups: [],
        },
      ]

  const filteredCenters = selectedCenter === "all"
    ? centerData
    : centerData.filter((c) => c.name === selectedCenter)

  // 서버 렌더링 시에는 로딩 표시를 하지 않음 (hydration 안전)
  const showLoading = isMounted && loading

  return (
    <div className="space-y-6">
      {/* 로딩 표시 (클라이언트에서만) */}
      {showLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}

      {/* 에러 표시 (클라이언트에서만) */}
      {isMounted && error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
          <strong>데이터 로드 오류:</strong> {error}
          <button onClick={refresh} className="ml-2 underline">
            다시 시도
          </button>
        </div>
      )}
      
      {/* 디버깅 정보 (개발 모드) */}
      {isMounted && process.env.NODE_ENV === 'development' && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-md text-xs mb-4">
          <strong>디버그:</strong> 로딩={loading ? 'true' : 'false'}, 
          에러={error || '없음'}, 
          통계={stats ? '있음' : '없음'}, 
          센터={centerStats.length}개
        </div>
      )}

      {/* 상단 통계 요약 */}
      <OverviewSection
        totalAgentsYongsan={dashboardStats.totalAgentsYongsan}
        totalAgentsGwangju={dashboardStats.totalAgentsGwangju}
        totalEvaluations={dashboardStats.totalEvaluations}
        watchlistYongsan={dashboardStats.watchlistYongsan}
        watchlistGwangju={dashboardStats.watchlistGwangju}
        attitudeErrorRate={dashboardStats.attitudeErrorRate}
        attitudeErrorTrend={trends.attitudeTrend}
        consultErrorRate={dashboardStats.businessErrorRate}
        consultErrorTrend={trends.consultTrend}
        overallErrorRate={dashboardStats.overallErrorRate}
        overallErrorTrend={trends.overallTrend}
        centerStats={centerStats.map(c => ({
          name: c.name,
          attitudeErrorRate: c.attitudeErrorRate,
          businessErrorRate: c.businessErrorRate,
          overallErrorRate: c.errorRate,
        }))}
        onWatchlistClick={onNavigateToFocus}
      />

      {/* 목표 달성 현황 전광판 */}
      <GoalStatusBoard />

      {/* 필터 */}
      <DashboardFilters
        selectedCenter={selectedCenter}
        setSelectedCenter={setSelectedCenter}
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        selectedTenure={selectedTenure}
        setSelectedTenure={setSelectedTenure}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        onDateChange={(start, end) => {
          setDateRange({ startDate: start, endDate: end })
        }}
        onSearch={() => {
          // 조회 버튼 클릭 시 모든 필터 적용하여 데이터 새로고침
          // 날짜 범위는 onDateChange에서 이미 업데이트됨
          // 센터, 서비스, 채널, 근속기간 필터는 각 하위 컴포넌트에서 자동으로 반영됨
          refresh()
        }}
      />

      {/* 센터별 오류율 추이 */}
      <ErrorTrendChart 
        data={chartTrendData} 
        targetRate={3.0}
        dateRange={dateRange}
      />

      {/* 서비스별 현황 */}
      <CenterComparison centers={filteredCenters} />

      {/* 상세 분석 탭 */}
      <Tabs defaultValue="item" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="item" className="text-xs py-2">
            항목별 현황
          </TabsTrigger>
          <TabsTrigger value="daily" className="text-xs py-2">
            일자별 현황
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs py-2">
            주차별 현황
          </TabsTrigger>
          <TabsTrigger value="tenure" className="text-xs py-2">
            근속기간별
          </TabsTrigger>
          <TabsTrigger value="service" className="text-xs py-2">
            서비스별 주간
          </TabsTrigger>
        </TabsList>

        <TabsContent value="item" className="mt-4">
          <ItemAnalysis
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
            selectedTenure={selectedTenure}
          />
        </TabsContent>

        <TabsContent value="daily" className="mt-4">
          <DailyErrorTable startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <WeeklyErrorTable startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </TabsContent>

        <TabsContent value="tenure" className="mt-4">
          <TenureErrorTable />
        </TabsContent>

        <TabsContent value="service" className="mt-4">
          <ServiceWeeklyTable
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
