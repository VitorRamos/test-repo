import { useState, useEffect } from "react"
import { InstructorCard } from "../components/InstructorCard"
import { api } from "../services/api"
import type { Instructor } from "../types"
import "./Home.css"

export function Home() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    city: "",
    price_max: ""
  })

  useEffect(() => {
    loadInstructors()
  }, [])

  const loadInstructors = async () => {
    setLoading(true)
    try {
      const data = await api.instructors.search(filters)
      setInstructors(data || [])
    } catch (err) {
      console.error("Failed to load instructors:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadInstructors()
  }

  return (
    <div className="home-container">
      <header className="home-hero">
        <h1>Encontre seu Instrutor de Direção Perfeito</h1>
        <p>Reserve aulas práticas de direção com instrutores experientes</p>
      </header>

      <div className="home-content">
        <aside className="home-sidebar">
          <form className="search-form" onSubmit={handleSearch}>
            <h3>Filtros de Busca</h3>

            <div className="form-group">
              <label htmlFor="city">Cidade</label>
              <input
                id="city"
                type="text"
                placeholder="Digite a cidade"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Preço Máximo por Hora</label>
              <input
                id="price"
                type="number"
                placeholder="Digite o preço máximo"
                value={filters.price_max}
                onChange={(e) =>
                  setFilters({ ...filters, price_max: e.target.value })
                }
              />
            </div>

            <button type="submit" className="search-btn">
              Buscar
            </button>
          </form>
        </aside>

        <main className="home-main">
          {loading ? (
            <p className="loading">Carregando instrutores...</p>
          ) : instructors.length === 0 ? (
            <p className="no-results">Nenhum instrutor encontrado. Tente ajustar seus filtros.</p>
          ) : (
            <div className="instructors-list">
              <h2>Instrutores Disponíveis ({instructors.length})</h2>
              {instructors.map((instructor) => (
                <InstructorCard
                  key={instructor.id}
                  instructor={instructor}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
