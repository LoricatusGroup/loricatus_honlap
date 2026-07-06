import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/Login'
import EditorPage from './pages/Editor'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Whenever the user changes, verify they're allowed to use the editor.
  // current_user_allowed() returns true for an exact allowlist entry OR a
  // whole-domain entry (e.g. '@loricatus.hu'). This mirrors the RLS policies,
  // which are the real enforcement — this check just drives a clean UI.
  useEffect(() => {
    let cancelled = false
    if (!user) {
      setAuthorized(null)
      return
    }
    setAuthorized(null)
    supabase.rpc('current_user_allowed').then(({ data, error }) => {
      if (cancelled) return
      setAuthorized(error ? false : Boolean(data))
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Betöltés…
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Jogosultság ellenőrzése…
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
        <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md shadow-xl text-center">
          <h1 className="text-2xl font-bold mb-2">Nincs jogosultság</h1>
          <p className="text-sm text-gray-400 mb-6">
            A(z) <span className="text-white">{user.email}</span> cím nem jogosult a
            szerkesztő használatára. Kérj hozzáférést egy adminisztrátortól.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Kijelentkezés
          </button>
        </div>
      </div>
    )
  }

  return <EditorPage user={user} />
}
