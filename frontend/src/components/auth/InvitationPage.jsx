import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function InvitationPage({ invitation, user, onLogin, onRegister, onAccept }) {
  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h2>
          <p className="text-gray-600">This invitation link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contract Invitation</h2>
          <p className="text-gray-600">You've been invited to join a contract</p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">{invitation.contract_title}</h3>
            <p className="text-sm text-gray-600 mb-2">{invitation.contract_description}</p>
            <div className="flex justify-between text-sm">
              <span><strong>Role:</strong> {invitation.role_in_contract}</span>
              <span><strong>Weight:</strong> {invitation.weight}</span>
            </div>
            <div className="mt-2 text-sm">
              <span><strong>Invited by:</strong> {invitation.invited_by_name}</span>
            </div>
          </div>

          {invitation.email && (
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <p><strong>Invited email:</strong> {invitation.email}</p>
              <p className="text-xs mt-1">You must login with this email address to accept the invitation.</p>
            </div>
          )}
        </div>

        {!user ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-center text-gray-600">Choose how to proceed:</p>
              <WalletMultiButton className="w-full" />
              <div className="text-center text-sm text-gray-500">or</div>
              <button
                onClick={onLogin}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Login with Email
              </button>
              <button
                onClick={onRegister}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Register with Email
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-gray-600 mb-4">Welcome, {user.name}!</p>
              {invitation.email && user.email !== invitation.email && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800">
                    <strong>Email mismatch:</strong> You're logged in as {user.email}, but this invitation is for {invitation.email}.
                    Please login with the correct email address.
                  </p>
                </div>
              )}
            </div>
            
            {(!invitation.email || user.email === invitation.email) ? (
              <button
                onClick={onAccept}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                Accept Invitation
              </button>
            ) : (
              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  window.location.reload()
                }}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Login with Correct Email
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

