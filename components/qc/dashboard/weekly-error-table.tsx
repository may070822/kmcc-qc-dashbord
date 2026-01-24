"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react"
import { useWeeklyErrors } from "@/hooks/use-weekly-errors"

export function WeeklyErrorTable() {
  const [category, setCategory] = useState<"all" | "상담태도" | "오상담/오처리">("all")
  
  // 최근 6주 데이터 가져오기
  const endDate = new Date().toISOString().split("T")[0]
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 42) // 6주
  const startDateStr = startDate.toISOString().split("T")[0]
  
  const { data: weeklyErrorsData, loading, error } = useWeeklyErrors({
    startDate: startDateStr,
    endDate,
  })

  // 데이터 변환: API 데이터를 테이블 형식으로 변환
  const { weeks, data } = useMemo(() => {
    if (!weeklyErrorsData || weeklyErrorsData.length === 0) {
      return { weeks: [], data: {} }
    }

    // 주차 정보 생성
    const weeksList = weeklyErrorsData.map((weekData, idx) => ({
      id: `w${idx + 1}`,
      label: weekData.weekLabel,
      shortLabel: weekData.weekLabel,
      dateRange: weekData.dateRange || '',  // 날짜 범위 추가
      week: weekData.week,
    }))

    // 항목별 주차별 데이터 생성
    const itemData: Record<string, Record<string, { count: number; rate: number }>> = {}
    
    evaluationItems.forEach((item) => {
      itemData[item.id] = {}
      weeksList.forEach((week, weekIdx) => {
        const weekData = weeklyErrorsData[weekIdx]
        const itemError = weekData.items.find((i) => i.itemId === item.id)
        itemData[item.id][week.id] = {
          count: itemError?.errorCount || 0,
          rate: itemError?.errorRate || 0,
        }
      })
    })

    return { weeks: weeksList, data: itemData }
  }, [weeklyErrorsData])

  const filteredItems =
    category === "all" ? evaluationItems : evaluationItems.filter((item) => item.category === category)

  // 전주 대비 계산
  const getComparison = (itemId: string) => {
    if (weeks.length < 2 || !data[itemId]) {
      return { countChange: 0, rateChange: 0 }
    }
    const lastWeekId = weeks[weeks.length - 1].id
    const prevWeekId = weeks[weeks.length - 2].id
    const currentWeek = data[itemId][lastWeekId] || { count: 0, rate: 0 }
    const prevWeek = data[itemId][prevWeekId] || { count: 0, rate: 0 }
    const countChange = currentWeek.count - prevWeek.count
    const rateChange = Number((currentWeek.rate - prevWeek.rate).toFixed(1))
    return { countChange, rateChange }
  }

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800">주차별 오류 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-slate-600">데이터 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800">주차별 오류 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            데이터 로딩 실패: {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800">주차별 오류 현황</CardTitle>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="상담태도">상담태도</SelectItem>
              <SelectItem value="오상담/오처리">오상담/오처리</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#1e3a5f]/5">
                <th className="sticky left-0 bg-[#1e3a5f]/5 text-left p-2 font-medium text-slate-700 min-w-[140px]">
                  항목
                </th>
                {weeks.map((week, idx) => (
                  <th key={week.id} className="p-2 font-medium text-slate-600 text-center" colSpan={2}>
                    <div className="text-xs font-semibold">{idx + 1}주차</div>
                    <div className="text-[10px] text-slate-500">{week.dateRange}</div>
                  </th>
                ))}
                <th
                  className="p-2 font-semibold text-slate-800 text-center bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20"
                  colSpan={2}
                >
                  전주비교
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 bg-slate-50 p-1"></th>
                {weeks.map((week) => (
                  <>
                    <th key={`${week.id}-count`} className="p-1 text-[10px] text-slate-500 text-center">
                      건수
                    </th>
                    <th key={`${week.id}-rate`} className="p-1 text-[10px] text-slate-500 text-center">
                      비중
                    </th>
                  </>
                ))}
                <th className="p-1 text-[10px] text-slate-500 text-center bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20">
                  증감
                </th>
                <th className="p-1 text-[10px] text-slate-500 text-center bg-[#1e3a5f]/10">비중</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 bg-[#1e3a5f]/5">
                <td className="sticky left-0 bg-[#1e3a5f]/5 p-2 font-semibold text-slate-700">주간 QC 모니터링건</td>
                {weeks.map((week) => {
                  const totalCount = filteredItems.reduce((sum, item) => sum + data[item.id][week.id].count, 0)
                  return (
                    <>
                      <td key={`total-${week.id}-count`} className="p-2 text-center font-semibold text-slate-700">
                        {totalCount}
                      </td>
                      <td key={`total-${week.id}-rate`} className="p-2 text-center text-slate-500">
                        -
                      </td>
                    </>
                  )
                })}
                <td className="p-2 text-center font-semibold bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20">-</td>
                <td className="p-2 text-center bg-[#1e3a5f]/10">-</td>
              </tr>

              {filteredItems.map((item, idx) => {
                const comparison = getComparison(item.id)
                return (
                  <tr
                    key={item.id}
                    className={cn("border-b border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}
                  >
                    <td
                      className={cn(
                        "sticky left-0 p-2 font-medium text-slate-700",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block w-2 h-2 rounded-full mr-2",
                          item.category === "상담태도" ? "bg-[#1e3a5f]" : "bg-[#f9e000]",
                        )}
                      />
                      {item.shortName}
                    </td>
                    {weeks.map((week) => {
                      const { count, rate } = data[item.id][week.id]
                      return (
                        <>
                          <td key={`${item.id}-${week.id}-count`} className="p-2 text-center text-slate-600">
                            {count}
                          </td>
                          <td key={`${item.id}-${week.id}-rate`} className="p-2 text-center text-slate-500">
                            {rate}%
                          </td>
                        </>
                      )
                    })}
                    <td
                      className={cn(
                        "p-2 text-center font-semibold bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20",
                        comparison.countChange > 0
                          ? "text-red-600"
                          : comparison.countChange < 0
                            ? "text-emerald-600"
                            : "text-slate-500",
                      )}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {comparison.countChange > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : comparison.countChange < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {comparison.countChange > 0 ? "+" : ""}
                        {comparison.countChange}
                      </div>
                    </td>
                    <td
                      className={cn(
                        "p-2 text-center font-semibold bg-[#1e3a5f]/10",
                        comparison.rateChange > 0
                          ? "text-red-600"
                          : comparison.rateChange < 0
                            ? "text-emerald-600"
                            : "text-slate-500",
                      )}
                    >
                      {comparison.rateChange > 0 ? "▲" : comparison.rateChange < 0 ? "▼" : "-"}
                      {Math.abs(comparison.rateChange)}%
                    </td>
                  </tr>
                )
              })}

              <tr className="border-t-2 border-slate-300 bg-[#f9e000]/20">
                <td className="sticky left-0 bg-[#f9e000]/20 p-2 font-semibold text-slate-800">태도+업무 미흡 비중</td>
                {weeks.map((week) => {
                  const totalCount = filteredItems.reduce((sum, item) => sum + data[item.id][week.id].count, 0)
                  const avgRate = Number(
                    (
                      filteredItems.reduce((sum, item) => sum + data[item.id][week.id].rate, 0) / filteredItems.length
                    ).toFixed(1),
                  )
                  return (
                    <>
                      <td key={`sum-${week.id}-count`} className="p-2 text-center font-semibold text-slate-700">
                        {totalCount}
                      </td>
                      <td key={`sum-${week.id}-rate`} className="p-2 text-center font-semibold text-slate-700">
                        {avgRate}%
                      </td>
                    </>
                  )
                })}
                <td className="p-2 text-center font-bold bg-[#f9e000]/30 border-l-2 border-[#1e3a5f]/20 text-slate-700">
                  -
                </td>
                <td className="p-2 text-center font-bold bg-[#f9e000]/30 text-slate-700">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
