export function VersionHistoryView({ contractId, history, onSelectVersion }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Version History</h2>
        {history.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No version history</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((version) => (
              <div 
                key={version.id} 
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                onClick={() => onSelectVersion(version)}
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <div className="flex justify-between items-center space-x-2 ">
                      <p className="text-gray-900 font-medium">{version.commit_message || 'No commit message'}</p>
                      <p className="text-base font-semibold text-gray-900">v{version.version_number}</p>   
                    </div>
                   
                    <div className="flex justify-between items-center ">
                      <p className="text-sm text-gray-500">{version.author_name}</p>
                      <p className="text-sm text-gray-500">{new Date(version.created_at).toLocaleDateString()}</p>
                    </div>
                    
                    {/* On-chain proof section */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {version.onchain_tx_hash ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Verified on-chain</span>
                          </div>
                          <a
                            href={`https://explorer.solana.com/tx/${version.onchain_tx_hash}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-700 text-sm font-medium underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Proof
                          </a>
                        </div>
                      ) : version.contract_hash ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Hash generated, on-chain storage pending</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-sm text-gray-500">Not yet verified</span>
                        </div>
                      )}
                    </div>
                
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

