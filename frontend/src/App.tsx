import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { Navigation } from "./components/Navigation"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Home } from "./pages/Home"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { BecomeInstructor } from "./pages/BecomeInstructor"
import { Dashboard } from "./pages/Dashboard"
import "./App.css"

function AppContent() {
  const { user, logout } = useAuth()

  return (
    <>
      <Navigation user={user} onLogout={logout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/become-instructor"
          element={
            <ProtectedRoute user={user}>
              <BecomeInstructor user={user} />
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
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
