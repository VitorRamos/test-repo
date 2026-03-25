import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import "./Auth.css"

export function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  })

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (form.password !== form.confirmPassword) {
      setError("As senhas não correspondem")
      return
    }

    if (form.password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres")
      return
    }

    try {
      setLoading(true)

      await register(form.email, form.password)

      navigate("/login")

    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Criar Conta</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Senha</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Confirmar senha</label>
            <input
              name="confirmPassword"
              type="password"
              required
              placeholder="••••••••"
              onChange={handleChange}
            />
            <small>Mínimo 8 caracteres</small>
          </div>
          
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? "Criando conta..." : "Cadastrar"}
          </button>
        </form>

        <p className="auth-link">
          Já tem uma conta? <Link to="/login">Entre aqui</Link>
        </p>
      </div>
    </div>
  )
}