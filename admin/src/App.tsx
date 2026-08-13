import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, SITE_ID, type Membership } from './lib/supabase'
import LoginPage from './pages/Login'
import EditorPage from './pages/Editor'

// Same person as before? Then keep the object we already have.
//
// Supabase re-reads the stored session every time the tab regains focus
// (auth-js listens on `visibilitychange`) and notifies every subscriber with
// SIGNED_IN — or TOKEN_REFRESHED once the hour-long access token is due for
// renewal. The session is deserialized from storage, so `session.user` is a
// brand-new object each time even though nothing about the user changed.
// Storing it blindly would change React's idea of `user`, re-run the
// membership lookup below, unmount the editor and throw away every unsaved
// edit — which is exactly what happened when someone switched tabs and came
// back. Comparing by id keeps the identity stable across those re-emits.
function sameUser(prev: User | null, next: User | null): User | null {
  if (prev && next && prev.id === next.id && prev.email === next.email) return prev
  return next
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  // undefined = not checked yet, null = checked & not a member, object = member
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser((prev) => sameUser(prev, data.user))
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((prev) => sameUser(prev, session?.user ?? null))
    })

    return () => subscription.unsubscribe()
  }, [])

  // Whenever the user changes, resolve their membership on this site.
  // current_membership() returns the caller's {role, can_edit_advanced} for
  // SITE_ID, or no row if they aren't a member. The RLS policies are the real
  // enforcement — this drives a clean UI and the text/advanced capability gate.
  // Keyed on the user id, not the user object: only a genuinely different
  // person needs a fresh membership lookup. Anything else (a token refresh, a
  // profile field changing) must leave the mounted editor alone.
  const userId = user?.id ?? null
  useEffect(() => {
    let cancelled = false
    if (!userId) {
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
  }, [userId])

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
