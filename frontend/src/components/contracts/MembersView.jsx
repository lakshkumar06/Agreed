import { useState } from 'react'

export function MembersView({ contract, members, invitations, isCreator, onInvite, onCreateVersion }) {
  const [activeTab, setActiveTab] = useState('members')
  
  // Filter out accepted invitations
  const pendingInvitations = invitations.filter(inv => inv.status !== 'accepted')
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <nav className="flex px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-4 text-sm font-medium border-b-2 ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Members ({members.length})
          </button>
          {isCreator && (
            <button
              onClick={() => setActiveTab('invitations')}
              className={`py-4 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'invitations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Invitations ({pendingInvitations.length})
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'members' ? (
          <div>
            {members.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No members yet</p>
            ) : (
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="flex justify-between items-center py-4 px-8 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-left text-sm text-gray-600 mt-1">{member.role_in_contract}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">Weight: {member.weight}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {pendingInvitations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending invitations</p>
            ) : (
              <div className="space-y-3">
                {pendingInvitations.map(invitation => (
                  <div key={invitation.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {invitation.email || invitation.wallet_address?.slice(0, 8) + '...'}
                        </p>
                        <p className="text-sm text-gray-600">{invitation.role_in_contract}</p>
                        <p className="text-xs text-gray-500">Weight: {invitation.weight}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        invitation.status === 'declined' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invitation.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

