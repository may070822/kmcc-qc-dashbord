"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { useDailyErrors } from "@/hooks/use-daily-errors"
import { Loader2 } from "lucide-react"

const NAVY = "#1e3a5f"
const KAKAO = "#f9e000"

interface DailyErrorTableProps {
  startDate?: string
  endDate?: string
}

export function DailyErrorTable({ startDate: propStartDate, endDate: propEndDate }: DailyErrorTableProps = {}) {
  const [category, setCategory] = useState<"all" | "상담태도" | "오상담/오처리">("all")
  
  // 실제 데이터 조회 (기본값: 최근 30일)
  const endDate = propEndDate || new Date().toISOString().split('T')[0]
  const startDate = propStartDate || (() => {
    const date = new Date()
    date.setDate(date.getDate() - 29)
    return date.toISOString().split('T')[0]
  })()
  
  const { data: dailyErrorsData, loading, error } = useDailyErrors({
    startDate,
    endDate,
  })
  
  // 데이터 변환
  const dailyData = useMemo(() => {
    if (!dailyErrorsData || dailyErrorsData.length === 0) {
      return []
    }
    
    const dataMap = new Map<string, Record<string, number | string>>()
    
    dailyErrorsData.forEach((dayData) => {
      const dayRecord: Record<string, number | string> = {
        date: new Date(dayData.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
        fullDate: dayData.date,
        total: 0,
      }
      
      evaluationItems.forEach((item) => {
        const itemData = dayData.items.find(i => i.itemId === item.id)
        dayRecord[item.id] = itemData?.errorCount || 0
        dayRecord.total = (dayRecord.total as number) + (itemData?.errorCount || 0)
      })
      
      dataMap.set(dayData.date, dayRecord)
    })
    
    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(a.fullDate as string).getTime() - new Date(b.fullDate as string).getTime()
    )
  }, [dailyErrorsData])

  const filteredItems =
    category === "all" ? evaluationItems : evaluationItems.filter((item) => item.category === category)

  // 최근 14일만 표시
  const recentData = dailyData.slice(-14)

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800">일자별 오류 현황</CardTitle>
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
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>데이터 로딩 중...</span>
          </div>
        )}
        
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
            <strong>데이터 로드 오류:</strong> {error}
          </div>
        )}
        
        {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#1e3a5f]/5">
                <th className="sticky left-0 bg-[#1e3a5f]/5 text-left p-2 font-medium text-slate-700 min-w-[120px]">
                  항목
                </th>
                {recentData.map((d) => (
                  <th key={d.fullDate as string} className="p-2 font-medium text-slate-600 text-center min-w-[50px]">
                    {d.date}
                  </th>
                ))}
                <th className="p-2 font-semibold text-slate-800 text-center bg-[#1e3a5f]/10 min-w-[50px]">합계</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 bg-[#1e3a5f]/5">
                <td className="sticky left-0 bg-[#1e3a5f]/5 p-2 font-semibold text-slate-700">일별 QC 모니터링건</td>
                {recentData.map((d) => (
                  <td key={`total-${d.fullDate}`} className="p-2 text-center font-semibold text-slate-700">
                    {d.total as number}
                  </td>
                ))}
                <td className="p-2 text-center font-bold text-slate-800 bg-[#1e3a5f]/10">
                  {recentData.reduce((sum, d) => sum + (d.total as number), 0)}
                </td>
              </tr>
              {filteredItems.map((item, idx) => {
                const rowTotal = recentData.reduce((sum, d) => sum + (d[item.id] as number), 0)
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
                    {recentData.map((d) => {
                      const count = d[item.id] as number
                      return (
                        <td
                          key={`${item.id}-${d.fullDate}`}
                          className={cn(
                            "p-2 text-center",
                            count > 10 ? "text-red-600 font-semibold" : count > 5 ? "text-amber-600" : "text-slate-600",
                          )}
                        >
                          {count > 0 ? count : "-"}
                        </td>
                      )
                    })}
                    <td
                      className={cn(
                        "p-2 text-center font-semibold bg-slate-100",
                        rowTotal > 100 ? "text-red-600" : "text-slate-800",
                      )}
                    >
                      {rowTotal}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-slate-300 bg-[#f9e000]/20">
                <td className="sticky left-0 bg-[#f9e000]/20 p-2 font-semibold text-slate-800">태도+업무 미흡 건수</td>
                {recentData.map((d) => (
                  <td key={`att-proc-${d.fullDate}`} className="p-2 text-center font-semibold text-slate-700">
                    {d.total as number}
                  </td>
                ))}
                <td className="p-2 text-center font-bold text-slate-800 bg-[#f9e000]/30">
                  {recentData.reduce((sum, d) => sum + (d.total as number), 0)}
                </td>
              </tr>
          </tbody>
        </table>
      </div>
        )}
    </CardContent>
  </Card>
)
}
