import { useState, useEffect } from 'react'
import { isAuthenticated, verifyAuth, autoLogin } from '../lib/api'
import AuthGate from '../components/AuthGate'
import ChatInterface from '../components/ChatInterface'

export default function AIEngineeringPage() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      if (isAuthenticated()) {
        const valid = await verifyAuth()
        if (valid) { setAuthed(true); setChecking(false); return }
      }
      const auto = await autoLogin()
      if (auto) { setAuthed(true) }
      setChecking(false)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    document.body.style.backgroundColor = '#030712'
    document.body.style.color = '#f9fafb'
    return () => {
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [])

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (!authed) {
    return <AuthGate onAuthenticated={() => setAuthed(true)} />
  }

  return <ChatInterface onLogout={() => setAuthed(false)} />
}
