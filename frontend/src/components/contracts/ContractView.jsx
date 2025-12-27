import { useState, useEffect } from 'react'
import axios from 'axios'
import { ContractEditor } from '../ContractEditor'
import { ClausesView } from './ClausesView'
import { ChatbotView } from './ChatbotView'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

export function ContractView({ contractId, contractViewMode, setContractViewMode, onCreateVersion, history }) {
  const [displayContent, setDisplayContent] = useState('')
  const [contentSource, setContentSource] = useState('loading') // 'ipfs', 'loading', 'error'
  const [ipfsHash, setIpfsHash] = useState(null)

  const latestVersion = history?.[0]
  const latestVersionId = latestVersion?.id
  const latestHash = latestVersion?.ipfs_hash

  useEffect(() => {
    let active = true
    const loadContent = async () => {
      setDisplayContent('')
      setIpfsHash(latestHash || null)
      if (latestVersionId) {
        if (latestHash) {
          setContentSource('loading')
          
          try {
            const res = await axios.get(`${API_BASE}/contracts/${contractId}/versions/${latestVersionId}/ipfs`)
            if (!active) return
            setDisplayContent(res.data.content)
            setContentSource(res.data.source)
          } catch (error) {
            if (!active) return
            console.error('[IPFS] Error loading content from IPFS:', error)
            setContentSource('error')
          }
        } else {
          setContentSource('error')
        }
      } else {
        setContentSource('empty')
      }
    }

    loadContent()
    return () => { active = false }
  }, [contractId, latestVersionId, latestHash])

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
          <>
            {/* Web3/IPFS Status Indicator */}
            {(ipfsHash || contentSource === 'error') && (
              <div className="px-6 pt-4 pb-2 flex items-center space-x-2">
                <div className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${
                  contentSource === 'ipfs' ? 'bg-green-100 text-green-800' :
                  contentSource === 'loading' ? 'bg-yellow-100 text-yellow-800' :
                  contentSource === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {contentSource === 'ipfs' && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {contentSource === 'loading' && (
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {contentSource === 'error' && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {contentSource === 'ipfs' && <span>✓ Stored on IPFS</span>}
                  {contentSource === 'loading' && <span>Loading from IPFS...</span>}
                  {contentSource === 'error' && <span>⚠ IPFS unavailable</span>}
                </div>
                {ipfsHash && (
                  <div className="text-xs text-gray-500 font-mono truncate max-w-xs">
                    {ipfsHash}
                  </div>
                )}
              </div>
            )}
          {contentSource === 'error' && <p role="alert" className="px-6 text-sm text-red-700">Contract content is unavailable. Editing is paused to prevent overwriting it.</p>}
          <ContractEditor
            contractId={contractId}
            initialContent={displayContent}
            onSave={onCreateVersion}
            readOnly={contentSource === 'loading' || contentSource === 'error'}
          />
          </>
        ) : contractViewMode === 'clauses' ? (
          <ClausesView contractId={contractId} />
        ) : (
          <ChatbotView contractId={contractId} />
        )}
      </div>
    </div>
  )
}
