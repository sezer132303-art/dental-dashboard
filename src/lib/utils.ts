import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('bg-BG', {
    timeZone: 'Europe/Sofia',
    ...options
  }).format(d)
}

export function formatDateTime(date: Date | string) {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('bg-BG', {
    style: 'currency',
    currency: 'BGN'
  }).format(amount)
}

export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Number(((current - previous) / previous * 100).toFixed(1))
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Добро утро'
  if (hour < 18) return 'Добър ден'
  return 'Добър вечер'
}
