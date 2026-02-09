'use client'

import { useState } from 'react'
import { Users, Plus, Search, Shield, User, MoreVertical } from 'lucide-react'

const users = [
  { id: '1', name: 'Администратор', phone: '+359888000000', role: 'admin', clinic: null, lastLogin: '2026-02-04 09:30' },
  { id: '2', name: 'д-р Иванов', phone: '+359888111111', role: 'doctor', clinic: 'Дентална Клиника София', lastLogin: '2026-02-04 08:45' },
  { id: '3', name: 'д-р Стефанов', phone: '+359888222222', role: 'doctor', clinic: 'Дентална Клиника София', lastLogin: '2026-02-03 17:20' },
  { id: '4', name: 'д-р Недялков', phone: '+359888333333', role: 'doctor', clinic: 'Дентална Клиника София', lastLogin: '2026-02-04 10:15' },
  { id: '5', name: 'д-р Чакъров', phone: '+359888444444', role: 'doctor', clinic: 'Дентална Клиника София', lastLogin: '2026-02-02 14:30' },
]

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Търси потребител..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" />
          Добави потребител
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Потребител</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Телефон</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Роля</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Клиника</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Последен вход</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        {user.role === 'admin' ? (
                          <Shield className="w-5 h-5 text-purple-600" />
                        ) : (
                          <User className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{user.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {user.role === 'admin' ? 'Администратор' : 'Лекар'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {user.clinic || <span className="text-gray-400">Всички</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">{user.lastLogin}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">1</p>
              <p className="text-sm text-gray-500">Администратори</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">4</p>
              <p className="text-sm text-gray-500">Лекари</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">5</p>
              <p className="text-sm text-gray-500">Общо потребители</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-yellow-600 font-bold">3</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">3</p>
              <p className="text-sm text-gray-500">Активни днес</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
