import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, SITE_ID, type Membership } from './lib/supabase'
import LoginPage from './pages/Login'
import EditorPage from './pages/Editor'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  // undefined = not checked yet, null = checked & not a member, object = member
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
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

  // Whenever the user changes, resolve their membership on this site.
  // current_membership() returns the caller's {role, can_edit_advanced} for
  // SITE_ID, or no row if they aren't a member. The RLS policies are the real
  // enforcement — this drives a clean UI and the text/advanced capability gate.
  useEffect(() => {
    let cancelled = false
    if (!user) {
      setMembership(undefined)
      return
    }
    setMembership(undefined)
    supabase.rpc('current_membership', { p_site: SITE_ID }).then(({ data, error }) => {
      if (cancelled) return
      const row = !error && Array.isArray(data) && data.length > 0 ? data[0] : null
      setMembership(row as Membership | null)
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

  if (membership === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Jogosultság ellenőrzése…
      </div>
    )
  }

  if (membership === null) {
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

  return <EditorPage user={user} membership={membership} />
}
