import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { api } from "../services/api"
import "./Auth.css"

export function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [role, setRole] = useState<"student" | "instructor">("student")

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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

      if (role === "instructor") {
        await api.instructors.create({
          email: form.email,
          password: form.password,
          name: form.name,
          cpf: form.cpf,
          detran_license: form.detran_license,
          price_per_hour: parseFloat(form.price_per_hour),
          city: form.city,
          state: form.state,
          bio: form.bio
        })
      } else {
        await register(form.email, form.password)
      }

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

          {/* ROLE SELECT */}
          <div className="form-group">
            <label>Tipo de conta</label>

            <div className="role-selector">
              <button
                type="button"
                className={`role-btn ${role === "student" ? "active" : ""}`}
                onClick={() => setRole("student")}
              >
                🎓 Aluno
              </button>

              <button
                type="button"
                className={`role-btn ${role === "instructor" ? "active" : ""}`}
                onClick={() => setRole("instructor")}
              >
                🚗 Instrutor
              </button>
            </div>
          </div>

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

          {role === "instructor" && (
            <>
              <div className="form-group">
                <label>Nome completo</label>
                <input
                  name="name"
                  required
                  placeholder="João Silva"
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>CPF</label>
                <input
                  name="cpf"
                  required
                  placeholder="000.000.000-00"
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Licença DETRAN</label>
                <input
                  name="detran_license"
                  required
                  placeholder="ABC123456D"
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Preço por hora (R$)</label>
                <input
                  name="price_per_hour"
                  type="number"
                  step="0.01"
                  required
                  placeholder="100"
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Cidade</label>
                <input
                  name="city"
                  required
                  placeholder="Natal"
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Estado</label>
                <input
                  name="state"
                  maxLength={2}
                  required
                  placeholder="RN"
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Bio</label>
                <textarea
                  name="bio"
                  rows={4}
                  placeholder="Conte aos alunos sobre sua experiência..."
                  onChange={handleChange}
                />
              </div>
            </>
          )}

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