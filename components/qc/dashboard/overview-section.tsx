"use client"

import { StatsCard } from "../stats-card"

interface OverviewSectionProps {
  totalAgentsYongsan: number
  totalAgentsGwangju: number
  totalEvaluations: number
  watchlistYongsan: number
  watchlistGwangju: number
  attitudeErrorRate: number
  attitudeErrorTrend: number
  consultErrorRate: number
  consultErrorTrend: number
  overallErrorRate: number
  overallErrorTrend: number
  centerStats?: Array<{
    name: string
    attitudeErrorRate: number
    businessErrorRate: number
    overallErrorRate: number
  }>
  onWatchlistClick: () => void
}

export function OverviewSection({
  totalAgentsYongsan,
  totalAgentsGwangju,
  totalEvaluations,
  watchlistYongsan,
  watchlistGwangju,
  attitudeErrorRate,
  attitudeErrorTrend,
  consultErrorRate,
  consultErrorTrend,
  overallErrorRate,
  overallErrorTrend,
  centerStats,
  onWatchlistClick,
}: OverviewSectionProps) {
  const totalWatchlist = watchlistYongsan + watchlistGwangju
  
  // 센터별 오류율 추출
  const yongsanCenter = centerStats?.find(c => c.name === '용산')
  const gwangjuCenter = centerStats?.find(c => c.name === '광주')
  
  const yongsanAttitudeRate = yongsanCenter?.attitudeErrorRate || 0
  const gwangjuAttitudeRate = gwangjuCenter?.attitudeErrorRate || 0
  const yongsanBusinessRate = yongsanCenter?.businessErrorRate || 0
  const gwangjuBusinessRate = gwangjuCenter?.businessErrorRate || 0
  const yongsanOverallRate = yongsanCenter?.overallErrorRate || 0
  const gwangjuOverallRate = gwangjuCenter?.overallErrorRate || 0

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <StatsCard
        title="총 상담사"
        value={totalAgentsYongsan + totalAgentsGwangju}
        subtitle={`용산 ${totalAgentsYongsan}명 / 광주 ${totalAgentsGwangju}명`}
      />
      <StatsCard title="전일 평가건수" value={totalEvaluations.toLocaleString()} subtitle="전일 기준" />
      <StatsCard
        title="유의상담사"
        value={totalWatchlist}
        subtitle={`용산 ${watchlistYongsan}명 / 광주 ${watchlistGwangju}명`}
        variant={totalWatchlist > 10 ? "destructive" : totalWatchlist > 5 ? "warning" : "default"}
        onClick={onWatchlistClick}
        clickable
      />
      <StatsCard
        title="상담태도 오류율"
        value={`${attitudeErrorRate.toFixed(2)}%`}
        subtitle={`용산 ${yongsanAttitudeRate.toFixed(2)}% / 광주 ${gwangjuAttitudeRate.toFixed(2)}%`}
        trend={attitudeErrorTrend}
        variant={attitudeErrorRate > 3 ? "warning" : "success"}
      />
      <StatsCard
        title="오상담/오처리 오류율"
        value={`${consultErrorRate.toFixed(2)}%`}
        subtitle={`용산 ${yongsanBusinessRate.toFixed(2)}% / 광주 ${gwangjuBusinessRate.toFixed(2)}%`}
        trend={consultErrorTrend}
        variant={consultErrorRate > 3 ? "warning" : "success"}
      />
      <StatsCard
        title="전체 오류율"
        value={`${overallErrorRate.toFixed(2)}%`}
        subtitle={`용산 ${yongsanOverallRate.toFixed(2)}% / 광주 ${gwangjuOverallRate.toFixed(2)}%`}
        trend={overallErrorTrend}
        variant={overallErrorRate > 5 ? "destructive" : overallErrorRate > 3 ? "warning" : "success"}
      />
    </div>
  )
}
