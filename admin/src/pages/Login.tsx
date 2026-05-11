import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null)

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    })

    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({
        type: 'info',
        text: 'Bejelentkezési linket küldtünk! Nézd meg a postafiókod.',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Loricatus Admin</h1>
        <p className="text-sm text-gray-400 mb-6">
          Add meg az engedélyezett e-mail címed. Küldünk egy bejelentkezési linket.
        </p>
        <form onSubmit={handleSignIn} className="space-y-4">
          <input
            type="email"
            placeholder="email@pelda.hu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:cursor-not-allowed py-2 rounded font-medium transition"
          >
            {loading ? 'Küldés…' : 'Bejelentkezési link küldése'}
          </button>
        </form>
        {message && (
          <p
            className={`mt-4 text-sm p-3 rounded ${
              message.type === 'error' ? 'bg-red-900/50 text-red-200' : 'bg-blue-900/50 text-blue-200'
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
