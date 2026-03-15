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
      <h1>Instructor Dashboard</h1>

      <div className="dashboard-section">
        <h2>Welcome, {user.email}</h2>
        <p>Dashboard features coming soon:</p>
        <ul>
          <li>View booked lessons</li>
          <li>Confirm lesson codes</li>
          <li>View earnings</li>
          <li>Manage availability</li>
          <li>View student reviews</li>
        </ul>
      </div>
    </div>
  )
}
