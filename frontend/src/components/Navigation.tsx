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
            Home
          </Link>

          {!user ? (
            <>
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="nav-link">
                Register
              </Link>
            </>
          ) : (
            <>
              <span className="nav-user">
                {user.email} ({user.role})
              </span>
              {user.role === "instructor" && (
                <Link to="/instructor" className="nav-link">
                  Dashboard
                </Link>
              )}
              <button onClick={handleLogout} className="nav-logout">
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
