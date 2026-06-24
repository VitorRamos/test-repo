import { useEffect, useState } from "react"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import "./NotificationsBell.css"

interface NotificationItem {
  id: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export function NotificationsBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [count, setCount] = useState(0)

  const load = async () => {
    if (!user) return
    try {
      const [list, unread] = await Promise.all([
        api.notifications.list() as Promise<NotificationItem[]>,
        api.notifications.unreadCount() as Promise<{ count: number }>
      ])
      setItems(list || [])
      setCount(unread?.count || 0)
    } catch {
      // keep prior state on transient failures
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(timer)
  }, [user?.id])

  if (!user) return null

  const markAll = async () => {
    try {
      await api.notifications.markAllRead()
      await load()
    } catch {
      /* ignore */
    }
  }

  const openPanel = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      await load()
    }
  }

  const onItemClick = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await api.notifications.markRead(item.id)
        await load()
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="notifications-bell">
      <button type="button" className="notifications-trigger" onClick={() => void openPanel()} aria-label="Notificações">
        🔔
        {count > 0 && <span className="notifications-badge">{count}</span>}
      </button>
      {open && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <strong>Notificações</strong>
            <button type="button" onClick={() => void markAll()}>Marcar todas</button>
          </div>
          {items.length === 0 ? (
            <p className="notifications-empty">Nenhuma notificação</p>
          ) : (
            <ul>
              {items.slice(0, 12).map((item) => (
                <li
                  key={item.id}
                  className={item.read ? "read" : "unread"}
                  role="button"
                  tabIndex={0}
                  onClick={() => void onItemClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") void onItemClick(item)
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
