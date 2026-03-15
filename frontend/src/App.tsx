import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useAuth } from "./hooks/useAuth"
import { Navigation } from "./components/Navigation"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Home } from "./pages/Home"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { InstructorRegister } from "./pages/InstructorRegister"
import { Dashboard } from "./pages/Dashboard"
import "./App.css"

function App() {
  const { user, logout } = useAuth()

  return (
    <BrowserRouter>
      <Navigation user={user} onLogout={logout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/become-instructor"
          element={
            <ProtectedRoute user={user}>
              <InstructorRegister user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor"
          element={
            <ProtectedRoute user={user} requiredRole="instructor">
              <Dashboard user={user} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
