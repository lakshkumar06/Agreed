export function ApprovalProgressBar({ approvalCount, totalMembers }) {
  const total = totalMembers || 1;
  const percentage = Math.min((approvalCount / total) * 100, 100);
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">Approval Progress</span>
        <span className="text-gray-900 font-medium">{approvalCount} / {total}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            percentage >= 100 ? 'bg-green-600' : 'bg-blue-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

