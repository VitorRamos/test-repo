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
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({})
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

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

  const handleValidateCode = async (lessonId: string) => {
    setValidatingId(lessonId)
    setConfirmError(null)
    try {
      const code = codeInputs[lessonId] || ""
      await api.lessons.confirmCode(lessonId, code)
      setCodeInputs((prev) => ({ ...prev, [lessonId]: "" }))
      await fetchData()
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Falha ao validar código")
    } finally {
      setValidatingId(null)
    }
  }

  const handleCancel = async (lessonId: string) => {
    setCancelingId(lessonId)
    setConfirmError(null)
    try {
      await api.lessons.cancelLesson(lessonId)
      await fetchData()
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Falha ao cancelar aula")
    } finally {
      setCancelingId(null)
    }
  }

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
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
        <div className="dashboard-card welcome-card span-2">
          <h2>Bem-vindo, {stats?.name}!</h2>
          <p className="location">📍 {stats?.city}, {stats?.state}</p>
          <p className="price">R$ {stats?.price_per_hour.toFixed(2)}/hora</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid span-2">
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
        <div className="dashboard-card earnings-card" id="ganhos">
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
        <div className="dashboard-card actions-card" id="solicitacoes">
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
                    <div>
                      <strong>Aluno:</strong> {lesson.student_email || "Não informado"}
                    </div>
                    <div className="booking-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleConfirm(lesson.id)}
                        disabled={confirmingId === lesson.id}
                      >
                        {confirmingId === lesson.id ? "Confirmando..." : "Confirmar"}
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancel(lesson.id)}
                        disabled={cancelingId === lesson.id}
                      >
                        {cancelingId === lesson.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Confirmed Lessons */}
        <div className="dashboard-card actions-card" id="confirmadas">
          <h3>✅ Aulas Confirmadas</h3>
          {lessons.filter((lesson) => lesson.status === "confirmed").length === 0 ? (
            <p>Nenhuma aula confirmada.</p>
          ) : (
            <div className="booking-list">
              {lessons
                .filter((lesson) => lesson.status === "confirmed")
                .map((lesson) => (
                  <div key={lesson.id} className="booking-item">
                    <div>
                      <strong>Data:</strong>{" "}
                      {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
                    </div>
                    <div>
                      <strong>Aluno:</strong> {lesson.student_email || "Não informado"}
                    </div>
                    <div className="code-row">
                      <input
                        type="text"
                        placeholder="Código do aluno"
                        value={codeInputs[lesson.id] || ""}
                        onChange={(e) =>
                          setCodeInputs((prev) => ({
                            ...prev,
                            [lesson.id]: e.target.value
                          }))
                        }
                      />
                      <button
                        className="action-btn"
                        onClick={() => handleValidateCode(lesson.id)}
                        disabled={validatingId === lesson.id}
                      >
                        {validatingId === lesson.id ? "Validando..." : "Validar Código"}
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancel(lesson.id)}
                        disabled={cancelingId === lesson.id}
                      >
                        {cancelingId === lesson.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Completed Lessons */}
        <div className="dashboard-card actions-card" id="concluidas">
          <h3>🏁 Aulas Concluídas</h3>
          {lessons.filter((lesson) => lesson.status === "completed").length === 0 ? (
            <p>Nenhuma aula concluída.</p>
          ) : (
            <div className="booking-list">
              {lessons
                .filter((lesson) => lesson.status === "completed")
                .map((lesson) => (
                  <div key={lesson.id} className="booking-item">
                    <div>
                      <strong>Data:</strong>{" "}
                      {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
                    </div>
                    <div>
                      <strong>Aluno:</strong> {lesson.student_email || "Não informado"}
                    </div>
                    <div>
                      <strong>Total:</strong> R$ {lesson.total_price.toFixed(2)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card actions-card span-2">
          <h3>⚡ Ações Rápidas</h3>
          <div className="actions-list">
            <button className="action-btn" onClick={() => scrollToSection("solicitacoes")}>
              📅 Solicitações
            </button>
            <button className="action-btn" onClick={() => scrollToSection("confirmadas")}>
              ✅ Confirmar Códigos
            </button>
            <button className="action-btn" onClick={() => scrollToSection("concluidas")}>
              🏁 Aulas Concluídas
            </button>
            <button className="action-btn" onClick={() => scrollToSection("ganhos")}>
              💰 Ganhos
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
