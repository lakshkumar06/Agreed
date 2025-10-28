export function DiffViewer({ diff, fromVersion, toVersion }) {
  if (!diff || diff.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center py-4">No changes detected</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Diff: v{fromVersion.version_number} → v{toVersion.version_number}
        </h3>
      </div>
      <div className="p-6">
        <div className="space-y-1 font-mono text-sm">
          {diff.map((change, idx) => (
            <div
              key={idx}
              className={`px-3 py-1 ${
                change.type === 'add'
                  ? 'bg-green-50 text-green-800'
                  : change.type === 'remove'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-gray-50'
              }`}
            >
              <span className="font-bold">
                {change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' '}
              </span>
              {change.line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

