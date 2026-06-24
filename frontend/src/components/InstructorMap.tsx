import type { Instructor } from "../types"
import "./InstructorMap.css"

interface InstructorMapProps {
  instructors: Instructor[]
  onSelect?: (id: string) => void
}

/** Lightweight pseudo-map using lat/lng when present, otherwise city hash positions. */
export function InstructorMap({ instructors, onSelect }: InstructorMapProps) {
  const withCoords = instructors.filter((i) => i.latitude != null && i.longitude != null)
  const pins = (withCoords.length ? withCoords : instructors).slice(0, 40)

  const project = (instructor: Instructor, index: number) => {
    if (instructor.latitude != null && instructor.longitude != null) {
      const x = ((instructor.longitude + 75) / 40) * 100
      const y = ((5 - instructor.latitude) / 40) * 100
      return {
        left: `${Math.min(95, Math.max(5, x))}%`,
        top: `${Math.min(90, Math.max(10, y))}%`
      }
    }
    const seed = (instructor.city || instructor.name || String(index)).length + index * 7
    return {
      left: `${10 + (seed * 13) % 80}%`,
      top: `${15 + (seed * 17) % 70}%`
    }
  }

  return (
    <div className="instructor-map-panel">
      <strong>Mapa de instrutores</strong>
      <p className="instructor-map-hint">
        {withCoords.length
          ? `${withCoords.length} com localização precisa`
          : "Posições aproximadas por cidade (cadastre latitude/longitude para precisão)"}
      </p>
      <div className="instructor-map-canvas" aria-label="Mapa simplificado de instrutores">
        {pins.map((instructor, index) => (
          <button
            key={instructor.id}
            type="button"
            className="instructor-map-pin"
            style={project(instructor, index)}
            title={`${instructor.name} — ${instructor.city}/${instructor.state}`}
            onClick={() => onSelect?.(instructor.id)}
          >
            📍
            <span>{instructor.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
