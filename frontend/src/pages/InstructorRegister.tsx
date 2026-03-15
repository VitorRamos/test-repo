import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../services/api"
import type { User } from "../types"
import "./InstructorRegister.css"

interface InstructorRegisterProps {
  user: User | null
}

export function InstructorRegister({ user }: InstructorRegisterProps) {
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
          <p>Please login first to register as an instructor.</p>
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
      await api.instructors.create(payload)
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
        <h1>Register as Instructor</h1>

        {error && <div className="instructor-error">{error}</div>}

        <form onSubmit={handleSubmit} className="instructor-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="John Doe"
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
              <label htmlFor="detran_license">DETRAN License *</label>
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
              <label htmlFor="price_per_hour">Price per Hour (R$) *</label>
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
              <label htmlFor="city">City *</label>
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
              <label htmlFor="state">State *</label>
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
              placeholder="Tell students about your experience..."
              rows={4}
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
      </div>
    </div>
  )
}
