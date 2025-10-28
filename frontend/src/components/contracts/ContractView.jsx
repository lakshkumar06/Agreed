import { ContractEditor } from '../ContractEditor'
import { ClausesView } from './ClausesView'
import { ChatbotView } from './ChatbotView'

export function ContractView({ contractId, contract, contractViewMode, setContractViewMode, onCreateVersion, currentUserId, versions, history }) {
  // Determine the content to show in raw view
  const getContentToShow = () => {
    // Check if there are any pending approval requests
    const hasPendingApprovals = versions && versions.some(v => v.approval_status !== 'merged')
    
    if (hasPendingApprovals && history && history.length > 0) {
      // Show the last merged version content
      return history[0].content
    }
    
    // Otherwise show current contract content
    return contract.content || ''
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-full">
      {/* Sub-tabs - Sticky */}
      <div className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10 rounded-t-lg">
        <nav className="flex px-6" aria-label="Contract Tabs">
          <button
            onClick={() => setContractViewMode('raw')}
            className={`py-3 px-4 text-sm font-medium border-b-2 ${
              contractViewMode === 'raw'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Raw Contract
          </button>
          <button
            onClick={() => setContractViewMode('clauses')}
            className={`py-3 px-4 text-sm font-medium border-b-2 ${
              contractViewMode === 'clauses'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Interactive Clauses
          </button>
          <button
            onClick={() => setContractViewMode('chat')}
            className={`py-3 px-4 text-sm font-medium border-b-2 ${
              contractViewMode === 'chat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            AI Chat
          </button>
        </nav>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto   hide-scrollbar">
        {contractViewMode === 'raw' ? (
          <ContractEditor
            contractId={contractId}
            initialContent={getContentToShow()}
            onSave={onCreateVersion}
            currentUser={currentUserId}
          />
        ) : contractViewMode === 'clauses' ? (
          <ClausesView contractId={contractId} />
        ) : (
          <ChatbotView contractId={contractId} />
        )}
      </div>
    </div>
  )
}

