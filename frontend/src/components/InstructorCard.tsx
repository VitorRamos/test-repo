import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { Instructor } from "../types"
import { useAuth } from "../context/AuthContext"
import "./InstructorCard.css"

interface InstructorCardProps {
  instructor: Instructor
  hasRequested?: boolean
  isHighlighted?: boolean
}

export function InstructorCard({
  instructor,
  hasRequested = false,
  isHighlighted = false
}: InstructorCardProps) {
  const rating = instructor.rating.toFixed(1)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
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

  return (
    <div
      id={`instructor-card-${instructor.id}`}
      className={`instructor-card${isHighlighted ? " instructor-card-highlighted" : ""}`}
    >
      <div className="instructor-header">
        <h3>
          <Link className="instructor-profile-link" to={`/instructors/${instructor.id}`}>
            {instructor.name}
          </Link>
        </h3>
        <div className="instructor-rating">
          <span className="stars">⭐</span>
          <span className="rating-value">{rating}</span>
          <span className="lesson-count">({instructor.total_lessons} aulas)</span>
        </div>
      </div>

      <div className="instructor-meta-row">
        <div className="instructor-location">
          <span className="instructor-location-pin" aria-hidden="true">📍</span>
          <span>{instructor.city}, {instructor.state}</span>
        </div>

        {hasRequestedBooking && (
          <div className="instructor-requested-badge">Ja solicitei aulas com este instrutor</div>
        )}
      </div>

      <div className="instructor-footer">
        <div className="price">
          <span className="price-label">Preço por hora:</span>
          <span className="price-value">R$ {instructor.price_per_hour.toFixed(2)}</span>
        </div>
        <div className="card-actions">
          <Link className="secondary-btn secondary-link-btn" to={`/instructors/${instructor.id}`}>
            Ver Perfil
          </Link>
          <button className="book-btn" onClick={handleOpenBooking}>
            Agendar Aula
          </button>
        </div>
      </div>

      {error && <div className="booking-error">{error}</div>}
    </div>
  )
}
