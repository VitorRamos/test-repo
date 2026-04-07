import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { Instructor, Review } from "../types"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import "./InstructorCard.css"

interface InstructorCardProps {
  instructor: Instructor
  hasRequested?: boolean
}

export function InstructorCard({
  instructor,
  hasRequested = false
}: InstructorCardProps) {
  const rating = instructor.rating.toFixed(1)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [showReviews, setShowReviews] = useState(false)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [hasRequestedBooking, setHasRequestedBooking] = useState(hasRequested)

  useEffect(() => {
    setHasRequestedBooking(hasRequested)
  }, [hasRequested])

  const handleOpenBooking = () => {
    setError(null)

    if (!user) {
      navigate("/login")
      return
    }

    if (user.role !== "student") {
      setError("Apenas alunos podem agendar aulas.")
      return
    }
    navigate(`/instructors/${instructor.id}/book`)
  }

  const toggleReviews = async () => {
    if (showReviews) {
      setShowReviews(false)
      return
    }
    setLoadingReviews(true)
    try {
      const data = await api.reviews.getPublicByInstructor(instructor.id)
      setReviews(data || [])
      setShowReviews(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar avaliações.")
    } finally {
      setLoadingReviews(false)
    }
  }

  return (
    <div className="instructor-card">
      <div className="instructor-header">
        <h3>{instructor.name}</h3>
        <div className="instructor-rating">
          <span className="stars">⭐</span>
          <span className="rating-value">{rating}</span>
          <span className="lesson-count">({instructor.total_lessons} aulas)</span>
        </div>
      </div>

      <div className="instructor-location">
        📍 {instructor.city}, {instructor.state}
      </div>

      {hasRequestedBooking && (
        <div className="instructor-requested-badge">Ja solicitei aulas com este instrutor</div>
      )}

      <div className="instructor-license">
        <span className="license-label">Licença:</span>
        <span className="license-value">{instructor.detran_license}</span>
      </div>

      <div className="instructor-bio">
        {instructor.bio || "Sem bio disponível"}
      </div>

      <div className="instructor-footer">
        <div className="price">
          <span className="price-label">Preço por hora:</span>
          <span className="price-value">R$ {instructor.price_per_hour.toFixed(2)}</span>
        </div>
        <div className="card-actions">
          <button className="book-btn" onClick={handleOpenBooking}>
            Agendar Aula
          </button>
          <button className="secondary-btn" onClick={toggleReviews} disabled={loadingReviews}>
            {loadingReviews ? "Carregando..." : showReviews ? "Ocultar Avaliações" : "Ver Avaliações"}
          </button>
        </div>
      </div>

      {error && <div className="booking-error">{error}</div>}

      {showReviews && (
        <div className="reviews-panel">
          <h4>Avaliações Públicas</h4>
          {reviews.length === 0 ? (
            <p>Nenhuma avaliação pública ainda.</p>
          ) : (
            <div className="reviews-list">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <span>⭐ {review.rating.toFixed(1)}</span>
                    <span>{new Date(review.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {review.comment && <p>{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
