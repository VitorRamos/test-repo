import { Link, useNavigate } from "react-router-dom"
import type { User } from "../types"
import "./Navigation.css"

interface NavigationProps {
  user: User | null
  onLogout: () => void
}

export function Navigation({ user, onLogout }: NavigationProps) {
  const navigate = useNavigate()

  const handleLogout = () => {
    onLogout()
    navigate("/")
  }

  const username = user?.email.split("@")[0]

  return (
    <nav className="navbar">
      <div className="nav-container">
        
        {/* LEFT SIDE */}
        <div className="nav-left">
          <Link to="/" className="nav-brand">
            🚗 DriveHub
          </Link>

          {user && (
            <span className="nav-user">
              👋 Bem-Vindo {username}
            </span>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="nav-menu">
          {!user ? (
            <>
              <Link to="/" className="nav-link">Início</Link>
              <Link to="/login" className="nav-link">Entrar</Link>
              <Link to="/register" className="nav-link">Cadastrar</Link>
            </>
          ) : (
            <>
              <Link to="/" className="nav-link">Início</Link>

              {user.role === "instructor" && (
                <Link to="/instructor" className="nav-link">
                  Painel
                </Link>
              )}

              {user.role === "student" && (
                <Link
                  to="/become-instructor"
                  className="nav-link nav-link-subtle"
                >
                  Tornar-se instrutor
                </Link>
              )}

              <button onClick={handleLogout} className="nav-logout">
                Sair
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}