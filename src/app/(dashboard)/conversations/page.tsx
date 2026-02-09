'use client'

import { useEffect, useState } from 'react'
import {
  MessageCircle,
  Phone,
  User,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Loader2,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  parsed_intent: string | null
  sent_at: string
}

interface Conversation {
  id: string
  patient_phone: string
  patient_id: string | null
  status: 'active' | 'resolved' | 'booking_complete'
  started_at: string
  updated_at: string
  patient: {
    id: string
    name: string
    phone: string
  } | null
  messagesCount: number
  lastMessage: Message | null
  recentMessages: Message[]
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  resolved: 'bg-gray-100 text-gray-800',
  booking_complete: 'bg-blue-100 text-blue-800'
}

const statusLabels: Record<string, string> = {
  active: 'Активен',
  resolved: 'Приключен',
  booking_complete: 'Запазен час'
}

const intentLabels: Record<string, string> = {
  booking_request: 'Заявка за час',
  availability_inquiry: 'Запитване',
  confirmation: 'Потвърждение',
  cancellation: 'Отказ',
  general_inquiry: 'Общо запитване'
}

const intentColors: Record<string, string> = {
  booking_request: 'bg-purple-100 text-purple-800',
  availability_inquiry: 'bg-yellow-100 text-yellow-800',
  confirmation: 'bg-green-100 text-green-800',
  cancellation: 'bg-red-100 text-red-800',
  general_inquiry: 'bg-gray-100 text-gray-800'
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchConversations()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchConversations, 30000)
    return () => clearInterval(interval)
  }, [filter])

  async function fetchConversations() {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('status', filter)
      }
      const response = await fetch(`/api/conversations?${params}`)
      const data = await response.json()
      if (data.conversations) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function resolveConversation(conversationId: string) {
    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          action: 'resolve'
        })
      })
      fetchConversations()
      setSelectedConversation(null)
    } catch (error) {
      console.error('Error resolving conversation:', error)
    }
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith('359')) {
      return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    }
    return phone
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'сега'
    if (diffMins < 60) return `${diffMins} мин`
    if (diffHours < 24) return `${diffHours} ч`
    if (diffDays < 7) return `${diffDays} дни`
    return date.toLocaleDateString('bg-BG')
  }

  const activeCount = conversations.filter(c => c.status === 'active').length
  const bookingCount = conversations.filter(c => c.status === 'booking_complete').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp разговори</h1>
          <p className="text-gray-600">Следене на съобщения и резервации</p>
        </div>
        <button
          onClick={() => fetchConversations()}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Обнови
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100">
              <MessageCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Общо</p>
              <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-100">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Активни</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-100">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Запазени часове</p>
              <p className="text-2xl font-bold text-purple-600">{bookingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gray-100">
              <CheckCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Приключени</p>
              <p className="text-2xl font-bold text-gray-600">
                {conversations.filter(c => c.status === 'resolved').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'active', 'booking_complete', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            )}
          >
            {f === 'all' ? 'Всички' : statusLabels[f]}
          </button>
        ))}
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y">
        {conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Няма намерени разговори</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className="p-4 hover:bg-gray-50 cursor-pointer transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">
                        {conversation.patient?.name || 'Непознат'}
                      </h3>
                      <span className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        statusColors[conversation.status]
                      )}>
                        {statusLabels[conversation.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <Phone className="w-3 h-3" />
                      {formatPhone(conversation.patient_phone)}
                    </div>
                    {conversation.lastMessage && (
                      <p className="text-sm text-gray-500 mt-1 truncate max-w-md">
                        {conversation.lastMessage.direction === 'inbound' ? '← ' : '→ '}
                        {conversation.lastMessage.content.substring(0, 50)}
                        {conversation.lastMessage.content.length > 50 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{formatTime(conversation.updated_at)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-gray-400">{conversation.messagesCount} съобщения</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedConversation.patient?.name || 'Непознат'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {formatPhone(selectedConversation.patient_phone)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedConversation(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
              {selectedConversation.recentMessages
                .slice()
                .reverse()
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.direction === 'inbound' ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-xl px-4 py-2',
                        msg.direction === 'inbound'
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-green-500 text-white'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        {msg.parsed_intent && (
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            msg.direction === 'inbound'
                              ? intentColors[msg.parsed_intent] || 'bg-gray-200'
                              : 'bg-green-600 text-green-100'
                          )}>
                            {intentLabels[msg.parsed_intent] || msg.parsed_intent}
                          </span>
                        )}
                        <span className={cn(
                          'text-xs',
                          msg.direction === 'inbound' ? 'text-gray-400' : 'text-green-200'
                        )}>
                          {new Date(msg.sent_at).toLocaleTimeString('bg-BG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex justify-end gap-3">
              {selectedConversation.status === 'active' && (
                <button
                  onClick={() => resolveConversation(selectedConversation.id)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Маркирай като приключен
                </button>
              )}
              <button
                onClick={() => setSelectedConversation(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Затвори
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
