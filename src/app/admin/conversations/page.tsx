'use client'

import { useEffect, useState } from 'react'
import {
  MessageCircle,
  Phone,
  User,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
  X,
  Filter,
  Building2,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ChannelBadge from '@/components/ChannelBadge'

type MessagingChannel = 'whatsapp' | 'messenger' | 'instagram' | 'viber'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  parsed_intent: string | null
  sent_at: string
}

interface Conversation {
  id: string
  channel: MessagingChannel
  channel_user_id: string
  patient_phone: string | null
  patient_id: string | null
  clinic_id: string
  status: 'active' | 'resolved' | 'booking_complete'
  started_at: string
  updated_at: string
  patient: {
    id: string | null
    name: string
    phone: string
  } | null
  messagesCount: number
  lastMessage: Message | null
  recentMessages: Message[]
}

interface Clinic {
  id: string
  name: string
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

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [clinicFilter, setClinicFilter] = useState<string>('all')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ text: string; success: boolean } | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchClinics()
    fetchConversations()
    const interval = setInterval(fetchConversations, 30000)
    return () => clearInterval(interval)
  }, [statusFilter, channelFilter, clinicFilter])

  async function fetchClinics() {
    try {
      const response = await fetch('/api/clinics')
      if (response.ok) {
        const data = await response.json()
        setClinics(data)
      }
    } catch (error) {
      console.error('Error fetching clinics:', error)
    }
  }

  async function fetchConversations() {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (channelFilter !== 'all') {
        params.append('channel', channelFilter)
      }
      if (clinicFilter !== 'all') {
        params.append('clinicId', clinicFilter)
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

  async function syncAllWhatsApp() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const body = clinicFilter !== 'all' ? { clinicId: clinicFilter } : {}
      const response = await fetch('/api/admin/sync-evolution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer cleanup-demo-2026'
        },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (response.ok) {
        setSyncMessage({ text: data.message, success: true })
        fetchConversations()
      } else {
        setSyncMessage({ text: data.error || 'Грешка при синхронизация', success: false })
      }
    } catch (error) {
      setSyncMessage({ text: 'Грешка при свързване', success: false })
    } finally {
      setSyncing(false)
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
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60))
      return `преди ${minutes} мин`
    }
    if (hours < 24) {
      return `преди ${hours} ч`
    }
    return date.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })
  }

  const getClinicName = (clinicId: string) => {
    const clinic = clinics.find(c => c.id === clinicId)
    return clinic?.name || 'Неизвестна клиника'
  }

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    let normalizedSearch = search.replace(/[\s\-\+]/g, '')
    if (normalizedSearch.startsWith('0') && normalizedSearch.length >= 2) {
      normalizedSearch = '359' + normalizedSearch.slice(1)
    }
    return (
      conv.patient?.name?.toLowerCase().includes(searchLower) ||
      conv.patient_phone?.includes(normalizedSearch) ||
      conv.patient_phone?.includes(search)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Всички WhatsApp разговори</h2>
          <p className="text-sm text-gray-500 mt-1">
            Преглед на разговорите от всички клиники
          </p>
        </div>
        <button
          onClick={syncAllWhatsApp}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизиране...' : 'Синхронизирай WhatsApp'}
        </button>
      </div>

      {/* Sync message */}
      {syncMessage && (
        <div className={cn(
          'p-4 rounded-lg flex items-center justify-between',
          syncMessage.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        )}>
          <span>{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Търсене по име или телефон..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Clinic Filter */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-500" />
          <select
            value={clinicFilter}
            onChange={(e) => setClinicFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="all">Всички клиники</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
        </div>

        {/* Channel Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Канал:</span>
          <div className="flex gap-1">
            {['all', 'whatsapp', 'messenger', 'instagram', 'viber'].map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition',
                  channelFilter === ch
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                )}
              >
                {ch === 'all' ? 'Всички' : ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Статус:</span>
          <div className="flex gap-1">
            {['all', 'active', 'booking_complete', 'resolved'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition',
                  statusFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                )}
              >
                {f === 'all' ? 'Всички' : statusLabels[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
              <p className="text-sm text-gray-500">Разговори</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {conversations.filter(c => c.status === 'active').length}
              </p>
              <p className="text-sm text-gray-500">Активни</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {conversations.filter(c => c.status === 'booking_complete').length}
              </p>
              <p className="text-sm text-gray-500">Запазени часове</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{clinics.length}</p>
              <p className="text-sm text-gray-500">Клиники</p>
            </div>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Няма намерени разговори</p>
            {conversations.length === 0 && (
              <button
                onClick={syncAllWhatsApp}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Синхронизирай с Evolution API
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className="p-4 hover:bg-gray-50 cursor-pointer transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      <ChannelBadge channel={conversation.channel} size="sm" showLabel={false} />
                    </div>
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
                      {conversation.patient_phone ? (
                        <>
                          <Phone className="w-3 h-3" />
                          {formatPhone(conversation.patient_phone)}
                        </>
                      ) : (
                        <span className="text-gray-400">{conversation.channel_user_id.substring(0, 15)}...</span>
                      )}
                      <span className="text-gray-300">|</span>
                      <Building2 className="w-3 h-3" />
                      <span className="text-gray-500">{getClinicName(conversation.clinic_id)}</span>
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
                  <div className="text-sm text-gray-400">
                    {formatTime(conversation.updated_at)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {conversation.messagesCount} съобщения
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">
                      {selectedConversation.patient?.name || 'Непознат'}
                    </h2>
                    <ChannelBadge channel={selectedConversation.channel} size="sm" />
                  </div>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.patient_phone
                      ? formatPhone(selectedConversation.patient_phone)
                      : selectedConversation.channel_user_id}
                    <span className="mx-2">•</span>
                    {getClinicName(selectedConversation.clinic_id)}
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh]">
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
