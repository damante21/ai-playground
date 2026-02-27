import { useState, useEffect } from 'react'
import { isAuthenticated } from '../lib/api'
import SecretKeyGate from '../components/SecretKeyGate'
import ChatInterface from '../components/ChatInterface'

export default function AIEngineeringPage() {
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    setAuthed(isAuthenticated())
  }, [])

  useEffect(() => {
    document.body.style.backgroundColor = '#030712'
    document.body.style.color = '#f9fafb'
    return () => {
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [])

  if (!authed) {
    return <SecretKeyGate onAuthenticated={() => setAuthed(true)} />
  }

  return <ChatInterface onLogout={() => setAuthed(false)} />
}
