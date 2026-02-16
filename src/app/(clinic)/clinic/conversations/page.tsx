'use client'

import { useEffect, useState } from 'react'
import {
  MessageCircle,
  Search,
  X,
  User,
  Clock,
  CheckCircle,
  Bell,
  Send,
  AlertCircle,
  Calendar,
  RefreshCw
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
  status: string
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

interface Reminder {
  id: string
  type: '24h' | '3h' | 'confirmation' | 'followup'
  status: 'pending' | 'sent' | 'failed'
  scheduled_for: string
  sent_at: string | null
  error_message: string | null
  created_at: string
  appointment: {
    id: string
    appointment_date: string
    start_time: string
    patient: { id: string; name: string; phone: string } | null
    doctor: { id: string; name: string } | null
  }
}

interface ReminderStats {
  total: number
  sent: number
  pending: number
  failed: number
  by24h: number
  by3h: number
}

type TabType = 'conversations' | 'reminders'

export default function ClinicConversations() {
  const [activeTab, setActiveTab] = useState<TabType>('conversations')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [reminderStats, setReminderStats] = useState<ReminderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [reminderFilter, setReminderFilter] = useState<'all' | 'sent' | 'pending' | 'failed'>('all')

  useEffect(() => {
    if (activeTab === 'conversations') {
      fetchConversations()
    } else {
      fetchReminders()
    }
  }, [activeTab])

  async function fetchConversations() {
    setLoading(true)
    try {
      const response = await fetch('/api/clinic/conversations')
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchReminders() {
    setLoading(true)
    try {
      const response = await fetch('/api/clinic/reminders')
      if (response.ok) {
        const data = await response.json()
        setReminders(data.reminders || [])
        setReminderStats(data.stats || null)
      }
    } catch (error) {
      console.error('Error fetching reminders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredConversations = conversations.filter(conv =>
    conv.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    conv.patient_phone?.includes(search)
  )

  const filteredReminders = reminders.filter(reminder => {
    if (reminderFilter === 'all') return true
    return reminder.status === reminderFilter
  })

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('bg-BG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    return timeStr.substring(0, 5)
  }

  const getReminderTypeLabel = (type: string) => {
    switch (type) {
      case '24h': return '24 часа преди'
      case '3h': return '3 часа преди'
      case 'confirmation': return 'Потвърждение'
      case 'followup': return 'Последващо'
      default: return type
    }
  }

  const getReminderStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-700'
      case 'pending': return 'bg-yellow-100 text-yellow-700'
      case 'failed': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getReminderStatusLabel = (status: string) => {
    switch (status) {
      case 'sent': return 'Изпратено'
      case 'pending': return 'Чакащо'
      case 'failed': return 'Неуспешно'
      default: return status
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp комуникация</h1>
        <p className="text-gray-500">Разговори и напомняния с пациенти</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-1 inline-flex">
        <button
          onClick={() => setActiveTab('conversations')}
          className={cn(
            'px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            activeTab === 'conversations'
              ? 'bg-teal-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <MessageCircle className="w-4 h-4" />
          Разговори
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={cn(
            'px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            activeTab === 'reminders'
              ? 'bg-teal-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Bell className="w-4 h-4" />
          Напомняния
        </button>
      </div>

      {activeTab === 'conversations' ? (
        <>
          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Търсене по име или телефон..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
              />
            </div>
          </div>

          {/* Conversations list */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Няма намерени разговори</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm divide-y">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">
                          {conv.patient?.name || conv.patient_phone}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {new Date(conv.updated_at).toLocaleDateString('bg-BG')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {conv.lastMessage?.content || 'Няма съобщения'}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {conv.messagesCount} съобщения
                        </span>
                        {conv.status === 'booking_complete' && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Записан час
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Reminders Stats */}
          {reminderStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Bell className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{reminderStats.total}</p>
                    <p className="text-xs text-gray-500">Общо</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Send className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{reminderStats.sent}</p>
                    <p className="text-xs text-gray-500">Изпратени</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{reminderStats.pending}</p>
                    <p className="text-xs text-gray-500">Чакащи</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{reminderStats.failed}</p>
                    <p className="text-xs text-gray-500">Неуспешни</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter and Refresh */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Филтър:</span>
              <select
                value={reminderFilter}
                onChange={(e) => setReminderFilter(e.target.value as typeof reminderFilter)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
              >
                <option value="all">Всички</option>
                <option value="sent">Изпратени</option>
                <option value="pending">Чакащи</option>
                <option value="failed">Неуспешни</option>
              </select>
            </div>
            <button
              onClick={fetchReminders}
              className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Обнови
            </button>
          </div>

          {/* Reminders list */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : filteredReminders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Няма намерени напомняния</p>
              <p className="text-sm text-gray-400 mt-2">
                Напомнянията се изпращат автоматично 24ч и 3ч преди записан час
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Пациент
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Час
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Тип
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Изпратено
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredReminders.map((reminder) => (
                    <tr key={reminder.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {reminder.appointment?.patient?.name || 'Неизвестен'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {reminder.appointment?.patient?.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-900">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formatDate(reminder.appointment?.appointment_date)}</span>
                          <span className="text-gray-400">|</span>
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>{formatTime(reminder.appointment?.start_time)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {reminder.appointment?.doctor?.name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Bell className="w-3 h-3" />
                          {getReminderTypeLabel(reminder.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                          getReminderStatusColor(reminder.status)
                        )}>
                          {reminder.status === 'sent' && <CheckCircle className="w-3 h-3" />}
                          {reminder.status === 'pending' && <Clock className="w-3 h-3" />}
                          {reminder.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                          {getReminderStatusLabel(reminder.status)}
                        </span>
                        {reminder.error_message && (
                          <p className="text-xs text-red-500 mt-1">{reminder.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {reminder.sent_at ? (
                          <div>
                            <p>{formatDate(reminder.sent_at)}</p>
                            <p className="text-xs">
                              {new Date(reminder.sent_at).toLocaleTimeString('bg-BG', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Conversation detail modal */}
      {selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedConversation.patient?.name || 'Пациент'}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedConversation.patient_phone}</p>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.recentMessages.slice().reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      msg.direction === 'outbound'
                        ? 'bg-teal-500 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.direction === 'outbound' ? 'text-teal-100' : 'text-gray-400'
                    }`}>
                      {new Date(msg.sent_at).toLocaleTimeString('bg-BG', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
              <p className="text-sm text-gray-500 text-center">
                Това е само преглед на разговора. Отговорите се изпращат автоматично от чатбота.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
