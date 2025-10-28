import { useState } from 'react'
import { CreateContractForm } from './CreateContractForm'

export function Dashboard({ contracts, onCreateContract, onRefresh, onSelectContract }) {
  const [showCreateContract, setShowCreateContract] = useState(false)

  return (
    <div className="space-y-6 pt-20 pb-6 px-[5vw] md:px-[10vw] ">


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900">Total Contracts</h3>
          <p className="text-3xl font-bold text-blue-600">{contracts.length}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900">Active</h3>
          <p className="text-3xl font-bold text-green-600">
            {contracts.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900">Draft</h3>
          <p className="text-3xl font-bold text-yellow-600">
            {contracts.filter(c => c.status === 'draft').length}
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Contracts</h3>
            <button
              onClick={() => setShowCreateContract(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              New Contract
            </button>
          </div>
        </div>
        <div className="p-6">
          {contracts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No contracts yet</p>
          ) : (
            <div className="space-y-4">
              {contracts.map(contract => (
                <div key={contract.id} className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => onSelectContract(contract)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">{contract.title}</h4>
                      <p className="text-sm text-gray-600">{contract.description}</p>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-2 ${
                        contract.status === 'active' ? 'bg-green-100 text-green-800' :
                        contract.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        contract.status === 'review' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {contract.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {contract.member_count} members
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateContract && (
        <CreateContractForm 
          onCreate={onCreateContract} 
          onClose={() => setShowCreateContract(false)}
        />
      )}
    </div>
  )
}

