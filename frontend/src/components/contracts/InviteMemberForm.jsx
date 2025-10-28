import { useState } from 'react'

export function InviteMemberForm({ contractId, onInvite, onClose }) {
  const [email, setEmail] = useState('')
  const [wallet_address, setWalletAddress] = useState('')
  const [role_in_contract, setRole] = useState('Legal')
  const [weight, setWeight] = useState(0.5)
  const [invitationLink, setInvitationLink] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const invitation = await onInvite(contractId, email, wallet_address, role_in_contract, weight)
      setInvitationLink(invitation.invitation_link)
      setIsSubmitted(true)
    } catch (error) {
      // Error handled in parent
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(invitationLink)
    alert('Invitation link copied to clipboard!')
  }

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Invitation Created!</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invitation Link:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={invitationLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <p>Send this link to: <strong>{email || wallet_address}</strong></p>
              <p>Role: <strong>{role_in_contract}</strong> (Weight: {weight})</p>
              <p className="text-xs text-yellow-600 mt-2">
                Note: Email sent in development mode. Check console for invitation details.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#292929a0] flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Member</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="text"
              placeholder="Wallet Address (optional)"
              value={wallet_address}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={role_in_contract}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="CEO">CEO</option>
              <option value="Legal">Legal</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              placeholder="Weight (0.0 - 1.0)"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div className="flex space-x-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Send Invitation
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

