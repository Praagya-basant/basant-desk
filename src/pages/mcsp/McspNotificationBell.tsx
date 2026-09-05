import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface McspNotification {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

const mcsp = () => supabase.schema('mcsp')

/** Same UI shape as the platform's core-management NotificationBell, pointed
 * at mcsp.notifications instead — kept separate rather than generalizing
 * that component, since it's tightly coupled to core_management's schema
 * and dbTypes today. */
export default function McspNotificationBell() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<McspNotification[]>([])
  const [open, setOpen] = useState(false)

  async function load() {
    if (!profile) return
    const { data } = await mcsp()
      .from('notifications')
      .select('id, title, message, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((data as McspNotification[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [profile?.id])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await mcsp().from('notifications').update({ is_read: true }).eq('id', id)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-1.5 transition-colors"
        title="Notifications"
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-accent text-white text-[10px] font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-border bg-bg shadow-sm z-50">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-sm font-medium text-text">Notifications</p>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-text-secondary text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-border/40 active:bg-border/60 transition-colors ${
                    n.is_read ? '' : 'bg-surface-2'
                  }`}
                >
                  <p className="text-sm text-text">{n.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
