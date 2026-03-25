import { useEffect, useState } from "react"
import { api } from "../services/api"
import type { Lesson, User } from "../types"
import "./Dashboard.css"

interface InstructorStats {
  total_lessons: number
  rating: number
  students_taught: number
  name: string
  city: string
  state: string
  price_per_hour: number
}

interface Earnings {
  total_earnings: number
  pending_earnings: number
  completed_lessons: number
  total_lessons: number
}

interface DashboardProps {
  user: User | null
}

export function Dashboard({ user }: DashboardProps) {
  const [stats, setStats] = useState<InstructorStats | null>(null)
  const [earnings, setEarnings] = useState<Earnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsData, earningsData, lessonsData] = await Promise.all([
        api.instructors.getStats(),
        api.instructors.getEarnings(),
        api.instructors.getLessons()
      ])
      setStats(statsData)
      setEarnings(earningsData)
      setLessons(lessonsData || [])
    } catch (error) {
      console.error("Falha ao carregar dados do instrutor:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (lessonId: string) => {
    setConfirmingId(lessonId)
    setConfirmError(null)
    try {
      await api.lessons.confirmBooking(lessonId)
      await fetchData()
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Falha ao confirmar agendamento")
    } finally {
      setConfirmingId(null)
    }
  }

  if (!user || user.role !== "instructor") {
    return <div className="dashboard-container"><p>Acesso negado</p></div>
  }

  if (loading) {
    return <div className="dashboard-container"><p>Carregando...</p></div>
  }

  return (
    <div className="dashboard-container">
      <h1>📊 Painel do Instrutor</h1>

      <div className="dashboard-grid">
        {/* Welcome Section */}
        <div className="dashboard-card welcome-card">
          <h2>Bem-vindo, {stats?.name}!</h2>
          <p className="location">📍 {stats?.city}, {stats?.state}</p>
          <p className="price">R$ {stats?.price_per_hour.toFixed(2)}/hora</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats?.total_lessons}</div>
            <div className="stat-label">Aulas Totais</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{stats?.students_taught}</div>
            <div className="stat-label">Alunos Ensinados</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">⭐ {stats?.rating.toFixed(1)}</div>
            <div className="stat-label">Avaliação</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">R$ {earnings?.total_earnings.toFixed(2)}</div>
            <div className="stat-label">Ganhos Totais</div>
          </div>
        </div>

        {/* Earnings Section */}
        <div className="dashboard-card earnings-card">
          <h3>💰 Ganhos</h3>
          <div className="earnings-item">
            <span>Ganhos Completos:</span>
            <strong>R$ {earnings?.total_earnings.toFixed(2)}</strong>
          </div>
          <div className="earnings-item">
            <span>Ganhos Pendentes:</span>
            <strong>R$ {earnings?.pending_earnings.toFixed(2)}</strong>
          </div>
          <div className="earnings-item">
            <span>Aulas Concluídas:</span>
            <strong>{earnings?.completed_lessons}</strong>
          </div>
        </div>

        {/* Booking Requests */}
        <div className="dashboard-card actions-card">
          <h3>📅 Solicitações de Agendamento</h3>
          {confirmError && <p className="confirm-error">{confirmError}</p>}
          {lessons.filter((lesson) => lesson.status === "pending_instructor").length === 0 ? (
            <p>Nenhuma solicitação pendente.</p>
          ) : (
            <div className="booking-list">
              {lessons
                .filter((lesson) => lesson.status === "pending_instructor")
                .map((lesson) => (
                  <div key={lesson.id} className="booking-item">
                    <div>
                      <strong>Aula</strong> em {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
                    </div>
                    <button
                      className="action-btn"
                      onClick={() => handleConfirm(lesson.id)}
                      disabled={confirmingId === lesson.id}
                    >
                      {confirmingId === lesson.id ? "Confirmando..." : "Confirmar"}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card actions-card">
          <h3>⚡ Ações Rápidas</h3>
          <div className="actions-list">
            <button className="action-btn">📅 Minhas Aulas</button>
            <button className="action-btn">✅ Confirmar Códigos</button>
            <button className="action-btn">⭐ Avaliações</button>
            <button className="action-btn">⚙️ Disponibilidade</button>
          </div>
        </div>
      </div>
    </div>
  )
}
