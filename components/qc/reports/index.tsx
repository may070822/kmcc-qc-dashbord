"use client"

import { useState } from "react"
import { ReportGenerator, type ReportConfig } from "./report-generator"
import { ReportPreview } from "./report-preview"
import { useReports } from "@/hooks/use-reports"

export function AnalyticsReports() {
  const [currentReport, setCurrentReport] = useState<any>(null)
  const { generateReport, loading: isGenerating, error } = useReports()

  const handleGenerate = async (config: ReportConfig) => {
    const reportData = await generateReport(config)
    
    if (reportData) {
      setCurrentReport(reportData)
    }
  }

  const handleDownload = () => {
    alert("PDF 다운로드 기능 (실제 구현 시 PDF 라이브러리 사용)")
  }

  return (
    <div className="space-y-6">
      <ReportGenerator onGenerate={handleGenerate} isGenerating={isGenerating} />
      <ReportPreview report={currentReport} onDownload={handleDownload} />
    </div>
  )
}
