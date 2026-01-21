"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface CenterBreakdown {
  yongsan: string | number
  gwangju: string | number
}

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  variant?: "default" | "success" | "warning" | "destructive"
  onClick?: () => void
  clickable?: boolean
  centerBreakdown?: CenterBreakdown
}

export function StatsCard({ title, value, subtitle, trend, variant = "default", onClick, clickable, centerBreakdown }: StatsCardProps) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <Minus className="h-3 w-3" />
    return trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
  }

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return "text-muted-foreground"
    return trend < 0 ? "text-emerald-600" : "text-red-600"
  }

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "border-emerald-500/40 bg-emerald-50"
      case "warning":
        return "border-amber-500/40 bg-amber-50"
      case "destructive":
        return "border-red-500/40 bg-red-50"
      default:
        return "border-border bg-card"
    }
  }

  return (
    <Card
      className={cn(
        "border shadow-sm transition-colors",
        getVariantStyles(),
        clickable && "cursor-pointer hover:shadow-md hover:border-primary/50",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {trend !== undefined && (
              <div className={cn("flex items-center gap-0.5 text-xs font-medium", getTrendColor())}>
                {getTrendIcon()}
                <span>{Math.abs(trend).toFixed(2)}%</span>
              </div>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {centerBreakdown && (
            <p className="text-xs text-muted-foreground mt-1">
              용산 {centerBreakdown.yongsan} / 광주 {centerBreakdown.gwangju}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
