'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function VerifyContent() {
  const [status, setStatus] = useState<'loading' | 'needsPassword' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Липсва токен за верификация')
      return
    }

    const checkToken = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, checkOnly: true })
        })

        const data = await response.json()

        if (!response.ok) {
          setStatus('error')
          setError(data.error || 'Грешка при верификация')
          return
        }

        // If user needs to set password
        if (data.needsPassword) {
          setStatus('needsPassword')
        } else {
          // User already has password, complete login
          const loginResponse = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          })

          if (loginResponse.ok) {
            setStatus('success')
            setTimeout(() => router.push('/'), 2000)
          } else {
            const loginData = await loginResponse.json()
            setStatus('error')
            setError(loginData.error || 'Грешка при вход')
          }
        }
      } catch (err) {
        setStatus('error')
        setError('Неочаквана грешка')
      }
    }

    checkToken()
  }, [token, router])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError('Паролите не съвпадат')
      return
    }

    if (password.length < 6) {
      setError('Паролата трябва да е поне 6 символа')
      return
    }

    setSettingPassword(true)
    setError('')

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Грешка при задаване на парола')
        setSettingPassword(false)
        return
      }

      setStatus('success')
      setTimeout(() => router.push('/'), 2000)
    } catch (err) {
      setError('Неочаквана грешка')
      setSettingPassword(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
      {status === 'loading' && (
        <>
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Верификация...</h2>
          <p className="text-gray-600">Моля, изчакайте</p>
        </>
      )}

      {status === 'needsPassword' && (
        <>
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Задайте парола</h2>
          <p className="text-gray-600 mb-6">Създайте парола за бъдещ достъп</p>

          <form onSubmit={handleSetPassword} className="space-y-4 text-left">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Парола
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символа"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Потвърди парола
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повтори паролата"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={settingPassword}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {settingPassword ? 'Запазване...' : 'Запази парола'}
            </button>
          </form>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Успешен вход!</h2>
          <p className="text-gray-600">Пренасочване към dashboard...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Грешка</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Към вход
          </button>
        </>
      )}
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Зареждане...</h2>
      <p className="text-gray-600">Моля, изчакайте</p>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 p-4">
      <Suspense fallback={<LoadingFallback />}>
        <VerifyContent />
      </Suspense>
    </div>
  )
}
