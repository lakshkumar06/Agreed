import { useState, useEffect } from 'react';
import axios from 'axios';
import { DiffViewer } from './DiffViewer';

const API_BASE = 'http://localhost:3001/api';

export function VersionCompareModal({ contractId, version1, version2, onClose }) {
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiff = async () => {
      try {
        const res = await axios.get(`${API_BASE}/contracts/${contractId}/diff`, {
          params: { from: version1.id, to: version2.id }
        });
        setDiff(res.data.diff);
      } catch (error) {
        console.error('Error fetching diff:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDiff();
  }, [contractId, version1.id, version2.id]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Compare Versions</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <p className="text-gray-500 text-center py-4">Loading diff...</p>
          ) : (
            <DiffViewer diff={diff} fromVersion={version1} toVersion={version2} />
          )}
        </div>
      </div>
    </div>
  );
}

