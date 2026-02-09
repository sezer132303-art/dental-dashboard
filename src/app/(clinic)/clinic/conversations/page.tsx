'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Search, X, User, Clock, CheckCircle } from 'lucide-react'

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

export default function ClinicConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  async function fetchConversations() {
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

  const filteredConversations = conversations.filter(conv =>
    conv.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    conv.patient_phone?.includes(search)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp разговори</h1>
        <p className="text-gray-500">Преглед на чат историята с пациенти</p>
      </div>

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
