import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../services/api"
import type { User } from "../types"
import "./BecomeInstructor.css"
import { useAuth } from "../context/AuthContext"

interface InstructorRegisterProps {
  user: User | null
}

export function BecomeInstructor({ user }: InstructorRegisterProps) {
  const { updateUser } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    detran_license: "",
    price_per_hour: "",
    city: "",
    state: "",
    bio: ""
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!user) {
    return (
      <div className="instructor-container">
        <div className="instructor-card">
          <p>Por favor, faça login primeiro para se registrar como instrutor.</p>
        </div>
      </div>
    )
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const payload = {
        ...formData,
        price_per_hour: parseFloat(formData.price_per_hour)
      }
      await api.instructors.become(payload)
      await updateUser()
      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="instructor-container">
      <div className="instructor-card">
        <h1>Registre-se como Instrutor</h1>

        {error && <div className="instructor-error">{error}</div>}

        <form onSubmit={handleSubmit} className="instructor-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Nome Completo *</label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="João Silva"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cpf">CPF *</label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                value={formData.cpf}
                onChange={handleChange}
                required
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="detran_license">Licença DETRAN *</label>
              <input
                id="detran_license"
                name="detran_license"
                type="text"
                value={formData.detran_license}
                onChange={handleChange}
                required
                placeholder="ABC123456D"
              />
            </div>

            <div className="form-group">
              <label htmlFor="price_per_hour">Preço por Hora (R$) *</label>
              <input
                id="price_per_hour"
                name="price_per_hour"
                type="number"
                step="0.01"
                value={formData.price_per_hour}
                onChange={handleChange}
                required
                placeholder="100.00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">Cidade *</label>
              <input
                id="city"
                name="city"
                type="text"
                value={formData.city}
                onChange={handleChange}
                required
                placeholder="São Paulo"
              />
            </div>

            <div className="form-group">
              <label htmlFor="state">Estado *</label>
              <input
                id="state"
                name="state"
                type="text"
                value={formData.state}
                onChange={handleChange}
                required
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Conte aos alunos sobre sua experiência..."
              rows={4}
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? "Registrando..." : "Registrar"}
          </button>
        </form>
      </div>
    </div>
  )
}
