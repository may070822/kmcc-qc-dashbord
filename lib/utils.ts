import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface StatusColors {
  bg: string
  text: string
  border: string
  badge: string
  level: 'achieved' | 'onTrack' | 'caution' | 'warning' | 'risk'
  label: string
}

/**
 * 확률에 따른 상태 색상 반환
 * 80% 이상 = 녹색 (달성 예상)
 * 60-80% = 파랑 (순항)
 * 40-60% = 노랑 (주의)
 * 20-40% = 주황 (경고)
 * 20% 미만 = 레드 (위험)
 */
export function getStatusColorsByProbability(probability: number): StatusColors {
  if (probability >= 80) {
    return {
      bg: 'bg-green-500',
      text: 'text-green-600',
      border: 'border-green-400',
      badge: 'bg-green-50 text-green-700 border-green-200',
      level: 'achieved',
      label: '달성'
    }
  }
  if (probability >= 60) {
    return {
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      border: 'border-blue-400',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      level: 'onTrack',
      label: '순항'
    }
  }
  if (probability >= 40) {
    return {
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      border: 'border-yellow-400',
      badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      level: 'caution',
      label: '주의'
    }
  }
  if (probability >= 20) {
    return {
      bg: 'bg-orange-500',
      text: 'text-orange-600',
      border: 'border-orange-400',
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      level: 'warning',
      label: '경고'
    }
  }
  return {
    bg: 'bg-red-500',
    text: 'text-red-600',
    border: 'border-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200',
    level: 'risk',
    label: '위험'
  }
}
