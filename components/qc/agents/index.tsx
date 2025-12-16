"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AgentFilters } from "./agent-filters"
import { AgentTable } from "./agent-table"
import { AgentDetailModal } from "./agent-detail-modal"
import { generateAgents } from "@/lib/mock-data"

export function AgentAnalysis() {
  const [search, setSearch] = useState("")
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedServiceGroup, setSelectedServiceGroup] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  const agents = useMemo(() => generateAgents(), [])

  const agentRows = useMemo(() => {
    return agents.map((agent) => {
      const errorRate = Number((Math.random() * 4 + 1).toFixed(2))
      return {
        id: agent.id,
        name: agent.name,
        center: agent.center,
        group: agent.group,
        tenure: agent.tenure,
        errorRate,
        trend: Number((Math.random() * 2 - 1).toFixed(2)),
        totalCalls: Math.floor(Math.random() * 30) + 20,
        totalErrors: Math.floor(errorRate * 0.5),
        topIssue: ["전산 세팅오류", "본인확인 누락", "가이드 미준수", "불친절", "필수멘트 누락"][
          Math.floor(Math.random() * 5)
        ],
        status: (errorRate > 4 ? "위험" : "양호") as "양호" | "위험",
      }
    })
  }, [agents])

  const filteredAgents = useMemo(() => {
    return agentRows.filter((agent) => {
      if (search && !agent.name.toLowerCase().includes(search.toLowerCase())) return false
      if (selectedCenter !== "all" && agent.center !== selectedCenter) return false
      if (selectedChannel !== "all" && !agent.group.includes(selectedChannel === "유선" ? "유선" : "채팅")) return false
      if (selectedServiceGroup !== "all" && !agent.group.includes(selectedServiceGroup)) return false
      if (selectedTenure !== "all" && agent.tenure !== selectedTenure) return false
      return true
    })
  }, [agentRows, search, selectedCenter, selectedChannel, selectedServiceGroup, selectedTenure])

  const handleSelectAgent = (agent: any) => {
    setSelectedAgent(agent)
    setDetailModalOpen(true)
  }

  const stats = useMemo(() => {
    const avgErrorRate =
      filteredAgents.length > 0 ? filteredAgents.reduce((sum, a) => sum + a.errorRate, 0) / filteredAgents.length : 0
    const riskCount = filteredAgents.filter((a) => a.status === "위험").length
    const safeCount = filteredAgents.filter((a) => a.status === "양호").length
    return { avgErrorRate, riskCount, safeCount }
  }, [filteredAgents])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">필터된 상담사</div>
            <p className="text-2xl font-bold">{filteredAgents.length}명</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">평균 오류율</div>
            <p className="text-2xl font-bold">{stats.avgErrorRate.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">위험</div>
            <p className="text-2xl font-bold text-red-600">{stats.riskCount}명</p>
          </CardContent>
        </Card>
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">양호</div>
            <p className="text-2xl font-bold text-green-600">{stats.safeCount}명</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>상담사 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AgentFilters
            search={search}
            onSearchChange={setSearch}
            selectedCenter={selectedCenter}
            onCenterChange={setSelectedCenter}
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            selectedServiceGroup={selectedServiceGroup}
            onServiceGroupChange={setSelectedServiceGroup}
            selectedTenure={selectedTenure}
            onTenureChange={setSelectedTenure}
          />
          <AgentTable agents={filteredAgents} onSelectAgent={handleSelectAgent} />
        </CardContent>
      </Card>

      <AgentDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} agent={selectedAgent} />
    </div>
  )
}
