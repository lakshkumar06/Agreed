import { useState } from 'react'

export function CreateContractForm({ onCreate, onClose }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [processing, setProcessing] = useState(false)

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setProcessing(true)
    
    try {
      let fileContent = ''
      if (file) {
        fileContent = await file.text()
      }
      
      await onCreate(title, description, fileContent)
      onClose()
    } catch (error) {
      alert('Failed to create contract')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create Contract</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Contract Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-20"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Contract File (TXT)
              </label>
              <input
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              {file && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {file.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex space-x-3 mt-6">
            <button
              type="submit"
              disabled={processing}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

