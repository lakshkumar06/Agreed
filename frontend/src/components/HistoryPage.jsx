export function HistoryPage({ contractId, history }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Commit History</h3>
        <p className="text-sm text-gray-600 mt-1">Merged and finalized versions</p>
      </div>
      <div className="p-6">
        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No history yet</p>
        ) : (
          <div className="space-y-4">
            {history.map((commit, idx) => (
              <div key={commit.id} className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    v{commit.version_number}
                  </span>
                  {commit.merged && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                      merged
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900 mt-1">{commit.commit_message}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {commit.author_name} • {new Date(commit.created_at).toLocaleString()}
                </p>
                {commit.diff_summary && (
                  <p className="text-xs text-gray-500 mt-1">{commit.diff_summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

