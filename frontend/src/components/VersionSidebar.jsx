export function VersionSidebar({ contractId, versions, onSelectVersion, currentVersionId, compareMode, onCompareClick, selectedVersions }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Version History</h3>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No versions yet</p>
        ) : (
          <div className="space-y-2">
            {versions.map(version => {
              const isSelected = selectedVersions?.some(v => v.id === version.id);
              return (
                <div
                  key={version.id}
                  onClick={() => compareMode ? onCompareClick(version) : onSelectVersion(version)}
                  className={`p-3 border rounded-lg cursor-pointer transition ${
                    version.id === currentVersionId
                      ? 'border-blue-500 bg-blue-50'
                      : isSelected && compareMode
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          v{version.version_number}
                        </span>
                        {isSelected && compareMode && (
                          <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full">
                            selected
                          </span>
                        )}
                        {version.merged && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                            merged
                          </span>
                        )}
                        {version.approval_status === 'approved' && !version.merged && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                            approved
                          </span>
                        )}
                        {version.approval_status === 'rejected' && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-full">
                            rejected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {version.commit_message || 'No commit message'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {version.author_name} • {new Date(version.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

