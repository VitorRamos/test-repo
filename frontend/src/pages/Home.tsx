import { useEffect, useMemo, useState } from "react"
import { InstructorCard } from "../components/InstructorCard"
import { api } from "../services/api"
import type { Instructor } from "../types"
import "./Home.css"

const today = new Date()
const formatDateInput = (value: Date) => value.toISOString().split("T")[0]

export function Home() {
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [availabilityChecking, setAvailabilityChecking] = useState(false)
  const [availableInstructorIds, setAvailableInstructorIds] = useState<string[] | null>(null)
  const [filters, setFilters] = useState({
    query: "",
    city: "",
    price_max: "",
    rating_min: "",
    availability_only: true
  })

  useEffect(() => {
    void loadInstructors()
  }, [])

  const loadInstructors = async () => {
    setLoading(true)
    try {
      const data = await api.instructors.search()
      setAllInstructors(data || [])
    } catch (err) {
      console.error("Failed to load instructors:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleClearFilters = () => {
    setFilters({
      query: "",
      city: "",
      price_max: "",
      rating_min: "",
      availability_only: true
    })
  }

  const citySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          allInstructors
            .map((instructor) => instructor.city.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allInstructors]
  )

  const querySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          allInstructors.flatMap((instructor) => [
            instructor.name.trim(),
            instructor.city.trim(),
            instructor.state.trim()
          ])
        )
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .slice(0, 24),
    [allInstructors]
  )

  const baseFilteredInstructors = useMemo(() => {
    const normalizedQuery = filters.query.trim().toLocaleLowerCase("pt-BR")
    const normalizedCity = filters.city.trim().toLocaleLowerCase("pt-BR")
    const priceMax = filters.price_max ? Number(filters.price_max) : null
    const ratingMin = filters.rating_min ? Number(filters.rating_min) : null

    return allInstructors.filter((instructor) => {
      const matchesQuery =
        normalizedQuery === "" ||
        [instructor.name, instructor.city, instructor.state]
          .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery))

      const matchesCity =
        normalizedCity === "" ||
        instructor.city.toLocaleLowerCase("pt-BR").includes(normalizedCity)

      const matchesPrice = priceMax === null || instructor.price_per_hour <= priceMax
      const matchesRating = ratingMin === null || instructor.rating >= ratingMin

      return matchesQuery && matchesCity && matchesPrice && matchesRating
    })
  }, [allInstructors, filters.city, filters.price_max, filters.query, filters.rating_min])

  useEffect(() => {
    if (!filters.availability_only) {
      setAvailableInstructorIds(null)
      setAvailabilityChecking(false)
      return
    }

    let cancelled = false

    const loadAvailability = async () => {
      setAvailabilityChecking(true)
      try {
        const dateFrom = formatDateInput(today)
        const dateTo = formatDateInput(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 21))
        const entries = await Promise.all(
          baseFilteredInstructors.map(async (instructor) => {
            const slots = await api.instructors.getAvailableSlots(instructor.id, {
              duration_hours: 1,
              date_from: dateFrom,
              date_to: dateTo
            })
            return slots.length > 0 ? instructor.id : null
          })
        )

        if (!cancelled) {
          setAvailableInstructorIds(entries.filter((value): value is string => value !== null))
        }
      } finally {
        if (!cancelled) {
          setAvailabilityChecking(false)
        }
      }
    }

    void loadAvailability()

    return () => {
      cancelled = true
    }
  }, [baseFilteredInstructors, filters.availability_only])

  const instructors = useMemo(() => {
    if (!filters.availability_only || availableInstructorIds === null) {
      return baseFilteredInstructors
    }

    const allowedIds = new Set(availableInstructorIds)
    return baseFilteredInstructors.filter((instructor) => allowedIds.has(instructor.id))
  }, [availableInstructorIds, baseFilteredInstructors, filters.availability_only])

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
              <label htmlFor="query">Busca rápida</label>
              <input
                id="query"
                type="text"
                list="instructor-search-suggestions"
                placeholder="Nome, cidade ou estado"
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              />
              <datalist id="instructor-search-suggestions">
                {querySuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label htmlFor="city">Cidade</label>
              <input
                id="city"
                type="text"
                list="city-suggestions"
                placeholder="Digite a cidade"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
              <datalist id="city-suggestions">
                {citySuggestions.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
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

            <div className="form-group">
              <label htmlFor="rating-min">Avaliação mínima</label>
              <select
                id="rating-min"
                value={filters.rating_min}
                onChange={(e) => setFilters({ ...filters, rating_min: e.target.value })}
              >
                <option value="">Qualquer nota</option>
                <option value="4.5">4.5 ou mais</option>
                <option value="4">4.0 ou mais</option>
                <option value="3.5">3.5 ou mais</option>
              </select>
            </div>

            <label className="search-checkbox">
              <input
                type="checkbox"
                checked={filters.availability_only}
                onChange={(e) =>
                  setFilters({ ...filters, availability_only: e.target.checked })
                }
              />
              <span>Somente com disponibilidade</span>
            </label>

            <div className="search-actions">
              <button type="submit" className="search-btn">
                Aplicar filtros
              </button>
              <button type="button" className="search-reset-btn" onClick={handleClearFilters}>
                Limpar
              </button>
            </div>
          </form>
        </aside>

        <main className="home-main">
          {loading ? (
            <p className="loading">Carregando instrutores...</p>
          ) : instructors.length === 0 ? (
            <p className="no-results">Nenhum instrutor encontrado. Tente ajustar seus filtros.</p>
          ) : (
            <div className="instructors-list">
              <div className="instructors-list-header">
                <h2>Instrutores Disponíveis ({instructors.length})</h2>
                {availabilityChecking && (
                  <span className="instructors-list-status">Atualizando disponibilidade...</span>
                )}
              </div>
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
