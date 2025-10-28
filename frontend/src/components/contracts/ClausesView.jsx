import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:3001/api'

export function ClausesView({ contractId }) {
  const [clauses, setClauses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClauses()
  }, [contractId])

  const loadClauses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/contracts/${contractId}/clauses`)
      setClauses(res.data.clauses)
    } catch (error) {
      console.error('Error loading clauses:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (clauses.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-12 text-center">
        <p className="text-gray-500 text-lg">No clauses found</p>
        <p className="text-gray-400 text-sm mt-2">Upload a contract file to extract clauses</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6 ">
      {clauses.map((clause, index) => (
        <div key={clause.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900">
              {index + 1}. {clause.title}
            </h3>
            {clause.category && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {clause.category}
              </span>
            )}
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{clause.content}</p>
        </div>
      ))}
    </div>
  )
}

