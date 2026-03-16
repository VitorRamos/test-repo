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

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          🚗 DriveHub
        </Link>

        <div className="nav-menu">
          <Link to="/" className="nav-link">
            Início
          </Link>

          {!user ? (
            <>
              <Link to="/login" className="nav-link">
                Entrar
              </Link>
              <Link to="/register" className="nav-link">
                Cadastrar
              </Link>
            </>
          ) : (
            <>
              <span className="nav-user">
                👋 Bem-vindo, {user.email.split("@")[0]}!
              </span>
              {user.role === "instructor" ? (
                <>
                  <Link to="/instructor" className="nav-link">
                    📊 Painel
                  </Link>
                </>
              ) : (
                <>
                </>
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
