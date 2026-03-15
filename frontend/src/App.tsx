import { useEffect, useState } from "react"

function App() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(setData)
  }, [])

  return (
    <div>
      <h1>Driving Instructor Platform</h1>
      <pre>{JSON.stringify(data)}</pre>
    </div>
  )
}

export default App
