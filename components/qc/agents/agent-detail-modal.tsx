"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { User, Building2, Calendar, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts"
import { evaluationItems } from "@/lib/mock-data"

interface AgentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: {
    id: string
    name: string
    center: string
    group: string
    tenure: string
    errorRate: number
    trend: number
    totalCalls: number
    status: "양호" | "위험"
  } | null
}

export function AgentDetailModal({ open, onOpenChange, agent }: AgentDetailModalProps) {
  if (!agent) return null

  const trendData = Array.from({ length: 14 }, (_, i) => ({
    date: `12/${i + 1}`,
    오류율: Number((Math.random() * 3 + 1).toFixed(2)),
    목표: 3.0,
  }))

  const itemErrorData = evaluationItems.map((item) => ({
    name: item.shortName,
    fullName: item.name,
    count: Math.floor(Math.random() * 10),
    category: item.category,
  }))

  const weakItems = [...itemErrorData].sort((a, b) => b.count - a.count).slice(0, 3)
  const strongItems = [...itemErrorData].sort((a, b) => a.count - b.count).slice(0, 3)

  const COLORS = {
    attitude: "#1e3a5f",
    consult: "#f59e0b",
    weak: "#ef4444",
    strong: "#22c55e",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{agent.name}</span>
              <Badge
                className={cn(
                  agent.status === "양호"
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-red-100 text-red-700 border-red-300",
                )}
              >
                {agent.status}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  소속
                </div>
                <p className="mt-1 font-medium">
                  {agent.center} {agent.group}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  근속기간
                </div>
                <p className="mt-1 font-medium">{agent.tenure}</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">금일 오류율</div>
                <p
                  className={cn(
                    "mt-1 text-2xl font-bold",
                    agent.errorRate > 5 ? "text-red-600" : agent.errorRate > 3 ? "text-amber-600" : "text-green-600",
                  )}
                >
                  {agent.errorRate.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">전일 대비</div>
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1 text-2xl font-bold",
                    agent.trend > 0 ? "text-red-600" : "text-green-600",
                  )}
                >
                  {agent.trend > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {agent.trend > 0 ? "+" : ""}
                  {agent.trend.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="trend" className="w-full">
            <TabsList className="w-full justify-start bg-muted/50">
              <TabsTrigger value="trend">오류율 추이</TabsTrigger>
              <TabsTrigger value="items">항목별 분석</TabsTrigger>
              <TabsTrigger value="summary">취약/우수 항목</TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">최근 14일 오류율 추이</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} domain={[0, 6]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
                        />
                        <ReferenceLine
                          y={3}
                          stroke="#ef4444"
                          strokeDasharray="5 5"
                          label={{ value: "목표", fill: "#ef4444", fontSize: 11 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="오류율"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "#3b82f6" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">항목별 오류 현황</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={itemErrorData} layout="vertical" margin={{ left: 100, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: "#374151", fontSize: 11 }} width={100} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
                          formatter={(value, name, props) => [value, props.payload.fullName]}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {itemErrorData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.category === "상담태도" ? COLORS.attitude : COLORS.consult}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded" style={{ backgroundColor: COLORS.attitude }} />
                      <span>상담태도</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded" style={{ backgroundColor: COLORS.consult }} />
                      <span>오상담/오처리</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-red-700">
                      <AlertTriangle className="h-5 w-5" />
                      취약 항목 TOP 3
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {weakItems.map((item, i) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">
                            {i + 1}. {item.fullName}
                          </span>
                          <span className="font-mono text-red-600 font-semibold">{item.count}건</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-red-100">
                          <div
                            className="h-2 rounded-full bg-red-500 transition-all"
                            style={{ width: `${(item.count / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      우수 항목 TOP 3
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {strongItems.map((item, i) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">
                            {i + 1}. {item.fullName}
                          </span>
                          <span className="font-mono text-green-600 font-semibold">{item.count}건</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-green-100">
                          <div
                            className="h-2 rounded-full bg-green-500 transition-all"
                            style={{ width: `${100 - (item.count / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
