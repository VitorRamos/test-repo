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
        <h1>Find Your Perfect Driving Instructor</h1>
        <p>Book practical driving lessons with experienced instructors</p>
      </header>

      <div className="home-content">
        <aside className="home-sidebar">
          <form className="search-form" onSubmit={handleSearch}>
            <h3>Search Filters</h3>

            <div className="form-group">
              <label htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                placeholder="Enter city"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Max Price per Hour</label>
              <input
                id="price"
                type="number"
                placeholder="Enter max price"
                value={filters.price_max}
                onChange={(e) =>
                  setFilters({ ...filters, price_max: e.target.value })
                }
              />
            </div>

            <button type="submit" className="search-btn">
              Search
            </button>
          </form>
        </aside>

        <main className="home-main">
          {loading ? (
            <p className="loading">Loading instructors...</p>
          ) : instructors.length === 0 ? (
            <p className="no-results">No instructors found. Try adjusting your filters.</p>
          ) : (
            <div className="instructors-list">
              <h2>Available Instructors ({instructors.length})</h2>
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
