import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:3001/api'

export function DeadlinesView({ contractId }) {
  const [deadlines, setDeadlines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDeadlines()
  }, [contractId])

  const loadDeadlines = async () => {
    try {
      const res = await axios.get(`${API_BASE}/contracts/${contractId}/deadlines`)
      setDeadlines(res.data.deadlines)
    } catch (error) {
      console.error('Error loading deadlines:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Deadlines</h2>
        {loading ? (
          <p className="text-gray-500 text-center py-4">Loading...</p>
        ) : deadlines.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No deadlines found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deadlines.map(deadline => (
              <div key={deadline.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">{deadline.description}</p>
                    {deadline.clause_reference && (
                      <p className="text-sm text-gray-600 mt-1">
                        Clause: {deadline.clause_reference}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      deadline.date === 'TBD' ? 'text-gray-500' : 'text-blue-600'
                    }`}>
                      {deadline.date}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

