import type { User } from "../types"

interface DashboardProps {
  user: User | null
}

export function Dashboard({ user }: DashboardProps) {
  if (!user || user.role !== "instructor") {
    return <div className="dashboard-container"><p>Access denied</p></div>
  }

  return (
    <div className="dashboard-container">
      <h1>Painel do Instrutor</h1>

      <div className="dashboard-section">
        <h2>Bem-vindo, {user.email}</h2>
        <p>Recursos do painel em breve:</p>
        <ul>
          <li>Ver aulas agendadas</li>
          <li>Confirmar códigos de aula</li>
          <li>Ver ganhos</li>
          <li>Gerenciar disponibilidade</li>
          <li>Ver avaliações de alunos</li>
        </ul>
      </div>
    </div>
  )
}
