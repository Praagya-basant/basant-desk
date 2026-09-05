import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchNotifications, markNotificationRead } from '../lib/coreManagement/db'
import type { CoreManagementNotification } from '../lib/coreManagement/dbTypes'

export default function NotificationBell() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<CoreManagementNotification[]>([])
  const [open, setOpen] = useState(false)

  async function load() {
    if (!profile) return
    const rows = await fetchNotifications(profile.id)
    setNotifications(rows)
  }

  useEffect(() => {
    load()
  }, [profile?.id])

  // Live-updates so a fresh reminder shows up without a refresh — the same
  // postgres_changes pattern used by the task list/detail views.
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('core-management-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'core_management', table: 'notifications', filter: `recipient_user_id=eq.${profile.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as CoreManagementNotification, ...prev])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await markNotificationRead(id)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors"
        title="Notifications"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-accent text-white text-[10px] font-medium">
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
                  <p className="text-xs text-text-secondary mt-0.5">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
