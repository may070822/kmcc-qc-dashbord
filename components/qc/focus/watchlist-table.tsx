"use client"
import * as React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { FileEdit, TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle } from "lucide-react"

export interface WatchlistAgent {
  id: string
  agentId: string
  name: string
  center: string
  group: string
  channel: string
  tenure: string
  errorRate: number
  attitudeRate: number
  counselingRate: number
  trend: number
  daysOnList: number
  weeksOnList?: number
  consecutiveDeclineWeeks?: number
  consecutiveDeclineDays?: number
  mainIssue: string
  reason?: string  // 등록 사유 코드 (threshold_exceeded, consecutive_decline, etc.)
  targetRate?: number  // 기준 오류율
  actionPlanStatus: "none" | "pending" | "in-progress" | "completed"
  lastActionDate?: string
}

interface WatchlistTableProps {
  agents: WatchlistAgent[]
  selectedAgents: string[]
  onSelectAgent: (id: string) => void
  onSelectAll: () => void
  onCreatePlan: (agent: WatchlistAgent) => void
}

export function WatchlistTable({
  agents,
  selectedAgents,
  onSelectAgent,
  onSelectAll,
  onCreatePlan,
}: WatchlistTableProps) {
  const getStatusBadge = (status: WatchlistAgent["actionPlanStatus"]) => {
    switch (status) {
      case "none":
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-300">
            <AlertTriangle className="mr-1 h-3 w-3" />
            미등록
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="mr-1 h-3 w-3" />
            대기
          </Badge>
        )
      case "in-progress":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-300">
            <Clock className="mr-1 h-3 w-3" />
            진행중
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            완료
          </Badge>
        )
    }
  }

  // 등록 사유 뱃지 생성
  const getReasonBadges = (agent: WatchlistAgent) => {
    const badges: React.ReactNode[] = []
    const targetRate = agent.targetRate || 3.0  // 기본 목표 3%

    // 기준대비 초과 (오류율이 목표를 초과한 경우)
    if (agent.errorRate > targetRate) {
      const exceededPercent = Number((agent.errorRate - targetRate).toFixed(1))
      badges.push(
        <Badge key="exceed" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5">
          기준대비 {exceededPercent}%p 초과
        </Badge>
      )
    }

    // 연속 하락 주차
    if (agent.consecutiveDeclineWeeks && agent.consecutiveDeclineWeeks > 0) {
      badges.push(
        <Badge key="week-decline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5">
          {agent.consecutiveDeclineWeeks}주 연속 하락
        </Badge>
      )
    }

    // 연속 하락 일수
    if (agent.consecutiveDeclineDays && agent.consecutiveDeclineDays > 0) {
      badges.push(
        <Badge key="day-decline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5">
          {agent.consecutiveDeclineDays}일 연속 하락
        </Badge>
      )
    }

    // 연속 집중관리 (주 단위)
    if (agent.weeksOnList && agent.weeksOnList > 0) {
      badges.push(
        <Badge key="weeks-list" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1.5">
          {agent.weeksOnList}주 연속 집중관리
        </Badge>
      )
    }

    // 뱃지가 없으면 mainIssue 표시
    if (badges.length === 0 && agent.mainIssue) {
      return <span className="text-sm text-slate-600">{agent.mainIssue}</span>
    }

    return (
      <div className="flex flex-col gap-1">
        {badges}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedAgents.length === agents.length && agents.length > 0}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead>상담사</TableHead>
            <TableHead>센터</TableHead>
            <TableHead>그룹</TableHead>
            <TableHead>채널</TableHead>
            <TableHead>근속기간</TableHead>
            <TableHead className="text-right">태도 오류율</TableHead>
            <TableHead className="text-right">업무 오류율</TableHead>
            <TableHead className="text-right">전체 오류율</TableHead>
            <TableHead className="text-right">전일대비</TableHead>
            <TableHead className="text-center">등재일수</TableHead>
            <TableHead>주요이슈</TableHead>
            <TableHead>액션플랜</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent, idx) => (
            <TableRow key={`${agent.id}_${idx}`} className="hover:bg-slate-50">
              <TableCell>
                <Checkbox checked={selectedAgents.includes(agent.id)} onCheckedChange={() => onSelectAgent(agent.id)} />
              </TableCell>
              <TableCell className="font-medium text-slate-900">
                {agent.name} ({agent.agentId})
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    agent.center === "용산"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-yellow-50 text-yellow-700 border-yellow-200",
                  )}
                >
                  {agent.center}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-600">{agent.group}</TableCell>
              <TableCell className="text-slate-600">{agent.channel}</TableCell>
              <TableCell className="text-slate-600">{agent.tenure}</TableCell>
              <TableCell className="text-right">
                <span className={cn("font-mono", agent.attitudeRate > 3 ? "text-red-600 font-bold" : "text-slate-600")}>
                  {agent.attitudeRate.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn("font-mono", agent.counselingRate > 4 ? "text-red-600 font-bold" : "text-slate-600")}
                >
                  {agent.counselingRate.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-mono font-bold",
                    agent.errorRate > 7 ? "text-red-600" : agent.errorRate > 5 ? "text-amber-600" : "text-orange-500",
                  )}
                >
                  {agent.errorRate.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "flex items-center justify-end gap-1 text-sm font-medium",
                    agent.trend > 0 ? "text-red-600" : "text-green-600",
                  )}
                >
                  {agent.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {agent.trend > 0 ? "+" : ""}
                  {agent.trend.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={cn(agent.daysOnList > 7 ? "bg-red-50 border-red-300 text-red-600" : "bg-slate-50")}
                >
                  {agent.daysOnList}일
                </Badge>
              </TableCell>
              <TableCell>
                {getReasonBadges(agent)}
              </TableCell>
              <TableCell>{getStatusBadge(agent.actionPlanStatus)}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 hover:bg-slate-50 bg-transparent"
                  onClick={() => onCreatePlan(agent)}
                >
                  <FileEdit className="mr-1 h-3 w-3" />
                  {agent.actionPlanStatus === "none" ? "등록" : "수정"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
