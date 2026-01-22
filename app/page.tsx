"use client"

import { useState, useCallback, useEffect } from "react"
import { Sidebar } from "@/components/qc/sidebar"
import { Header } from "@/components/qc/header"
import { Dashboard } from "@/components/qc/dashboard"
import { AgentAnalysis } from "@/components/qc/agents"
import { FocusManagement } from "@/components/qc/focus"
import { Predictions } from "@/components/qc/predictions"
import { AnalyticsReports } from "@/components/qc/reports"
import { GoalManagement } from "@/components/qc/goals"
import { SettingsPage } from "@/components/qc/settings"
import { AIAssistant } from "@/components/qc/ai-assistant"
import { cn } from "@/lib/utils"

export default function QCManagementApp() {
  const [currentTab, setCurrentTab] = useState("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  // Hydration 오류 방지: 초기값은 빈 문자열로 설정하고 클라이언트에서만 업데이트
  const [lastUpdated, setLastUpdated] = useState("")
  const [isMounted, setIsMounted] = useState(false)

  // 클라이언트 마운트 후에만 시간 설정 (Hydration 오류 방지)
  useEffect(() => {
    setIsMounted(true)
    setLastUpdated(new Date().toLocaleTimeString("ko-KR"))
    
    // 1초마다 시간 업데이트
    const interval = setInterval(() => {
      setLastUpdated(new Date().toLocaleTimeString("ko-KR"))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = useCallback(() => {
    if (isMounted) {
      setLastUpdated(new Date().toLocaleTimeString("ko-KR"))
    }
  }, [isMounted])

  const handleNavigateToFocus = useCallback(() => {
    setCurrentTab("focus")
  }, [])

  const renderContent = () => {
    switch (currentTab) {
      case "dashboard":
        return <Dashboard onNavigateToFocus={handleNavigateToFocus} />
      case "agents":
        return <AgentAnalysis />
      case "focus":
        return <FocusManagement />
      case "predictions":
        return <Predictions onNavigateToFocus={handleNavigateToFocus} />
      case "reports":
        return <AnalyticsReports />
      case "ai-assistant":
        return <AIAssistant />
      case "goals":
        return <GoalManagement />
      case "settings":
        return <SettingsPage />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        alertCount={12}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-60")}>
        <Header
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onRefresh={handleRefresh}
          lastUpdated={lastUpdated}
        />

        <main className="p-6">{renderContent()}</main>
      </div>
    </div>
  )
}
