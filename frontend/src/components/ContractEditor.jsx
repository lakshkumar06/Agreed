import { useState, useEffect } from 'react';

export function ContractEditor({ contractId, initialContent, onSave, currentUser }) {
  const [content, setContent] = useState(initialContent || '');
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCommitForm, setShowCommitForm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setContent(initialContent || '');
    setHasChanges(false);
  }, [initialContent]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasChanges(newContent !== (initialContent || ''));
  };

  const handleSave = async () => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }
    setSaving(true);
    try {
      await onSave(content, commitMessage);
      setCommitMessage('');
      setShowCommitForm(false);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving version:', error);
      alert('Failed to save version');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white  rounded-lg p-6">

      <div className="">
        <textarea
          value={content}
          onChange={handleContentChange}
          className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
          placeholder="Enter contract content here..."
        />
        <div className="flex justify-end space-x-3 mt-4">
          {showCommitForm ? (
            <>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Commit Changes'}
              </button>
              <button
                onClick={() => {
                  setShowCommitForm(false);
                  setCommitMessage('');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowCommitForm(true)}
              disabled={!hasChanges}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

