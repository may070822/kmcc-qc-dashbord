"use client"

import { useState, useEffect, useCallback } from "react"

interface ItemErrorStats {
  itemId: string
  itemName: string
  category: "상담태도" | "오상담/오처리"
  errorCount: number
  errorRate: number
  trend: number
}

interface UseItemStatsOptions {
  center?: string
  service?: string
  channel?: string
  startDate?: string
  endDate?: string
}

export function useItemStats(options: UseItemStatsOptions = {}) {
  const [data, setData] = useState<ItemErrorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.center) params.append("center", options.center)
      if (options.service) params.append("service", options.service)
      if (options.channel) params.append("channel", options.channel)
      if (options.startDate) params.append("startDate", options.startDate)
      if (options.endDate) params.append("endDate", options.endDate)
      params.append("type", "item-stats")

      const response = await fetch(`/api/data?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data || [])
      } else {
        setError(result.error || "데이터를 불러올 수 없습니다.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패")
    } finally {
      setLoading(false)
    }
  }, [options.center, options.service, options.channel, options.startDate, options.endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
