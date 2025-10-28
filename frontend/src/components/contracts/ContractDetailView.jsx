import { useState } from 'react'
import { CommitView } from '../CommitView'
import { ContractView } from './ContractView'
import { MembersView } from './MembersView'
import { ApprovalRequestsView } from './ApprovalRequestsView'
import { VersionHistoryView } from './VersionHistoryView'
import { DeadlinesView } from './DeadlinesView'
import { InviteMemberForm } from './InviteMemberForm'

export function ContractDetailView({ contract, members, invitations, currentUserId, versions, history, selectedVersion, onBack, onInvite, onResend, onRefresh, onCreateVersion, onSelectVersion, onCompareVersions }) {
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [sidebarMode, setSidebarMode] = useState('home') // 'home', 'members', 'approvalRequests', 'versionHistory', 'deadlines'
  const [contentMode, setContentMode] = useState('editor') // 'editor', 'commit'
  const [contractViewMode, setContractViewMode] = useState('raw') // 'raw', 'clauses', 'chat'
  
  const isCreator = currentUserId === contract.created_by
  const currentContent = selectedVersion ? selectedVersion.content : contract.content || ''
  
  const handleVersionSelect = (version) => {
    onSelectVersion(version)
    setContentMode('commit')
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header & Tabs - Fixed at top */}
      <div className="bg-white fixed top-16 left-0 right-0 z-20 border-b border-gray-200">
        {/* Navigation Bar */}
        <div className="border-b border-gray-200">
          <div className="px-[5vw] md:px-[10vw]">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center space-x-2">
                <button onClick={onBack} className="text-gray-600 hover:text-gray-900">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600 hover:text-blue-600 cursor-pointer">{contract.title}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button className="text-gray-600 hover:text-gray-900 text-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <button className="text-gray-600 hover:text-gray-900 text-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                {isCreator && (
                  <button
                    onClick={() => setShowInviteForm(true)}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Invite</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="bg-white">
          <div className="px-[5vw] md:px-[10vw]">
            <nav className="flex -mb-px space-x-8">
              <button
                onClick={() => { setSidebarMode('home'); setContentMode('editor') }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  sidebarMode === 'home'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Contract
              </button>
              <button
                onClick={() => { setSidebarMode('members'); setContentMode('editor') }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  sidebarMode === 'members'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                People
                <span className="ml-2 text-xs text-gray-500">({members.length})</span>
              </button>
              <button
                onClick={() => { setSidebarMode('approvalRequests'); setContentMode('editor') }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  sidebarMode === 'approvalRequests'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Approval Requests
                <span className="ml-2 text-xs text-gray-500">({versions.filter(v => v.approval_status !== 'merged').length})</span>
              </button>
              <button
                onClick={() => { setSidebarMode('versionHistory'); setContentMode('editor') }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  sidebarMode === 'versionHistory'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                History
                <span className="ml-2 text-xs text-gray-500">({history.length})</span>
              </button>
              <button
                onClick={() => { setSidebarMode('deadlines'); setContentMode('editor') }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  sidebarMode === 'deadlines'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Deadlines
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden pt-44">
        <div className="px-[5vw] md:px-[10vw] py-6 h-full flex gap-6">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {contentMode === 'commit' && selectedVersion ? (
              <CommitView 
                contractId={contract.id}
                version={selectedVersion}
                currentUserId={currentUserId}
                onRefresh={onRefresh}
                isCreator={isCreator}
                totalMembers={members.length}
                onBack={() => {
                  setSelectedVersion(null)
                  setContentMode('editor')
                }}
              />
            ) : sidebarMode === 'home' ? (
              <ContractView 
                contractId={contract.id}
                contract={contract}
                contractViewMode={contractViewMode}
                setContractViewMode={setContractViewMode}
                onCreateVersion={onCreateVersion}
                currentUserId={currentUserId}
                versions={versions}
                history={history}
              />
            ) : sidebarMode === 'members' ? (
              <MembersView 
                contract={contract}
                members={members}
                invitations={invitations}
                isCreator={isCreator}
                onInvite={() => setShowInviteForm(true)}
                onCreateVersion={onCreateVersion}
              />
            ) : sidebarMode === 'approvalRequests' ? (
              <ApprovalRequestsView
                contractId={contract.id}
                versions={versions.filter(v => v.approval_status !== 'merged')}
                onSelectVersion={handleVersionSelect}
                currentUserId={currentUserId}
                isCreator={isCreator}
              />
            ) : sidebarMode === 'deadlines' ? (
              <DeadlinesView contractId={contract.id} />
            ) : (
              <VersionHistoryView
                contractId={contract.id}
                history={history}
                onSelectVersion={handleVersionSelect}
              />
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-80 space-y-4 h-fit sticky top-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">About</h3>
              <p className="text-sm text-gray-600 mb-3">{contract.description || 'No description'}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-600">Created {new Date(contract.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-gray-600">{members.length} members</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-gray-600">{history.length} versions</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Contributors</h3>
              <div className="flex flex-wrap gap-2">
                {members.slice(0, 8).map(member => (
                  <div key={member.id} className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-700">
                      {member.name.charAt(0)}
                    </div>
                  </div>
                ))}
                {members.length > 8 && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    +{members.length - 8}
                  </div>
                )}
              </div>
            </div>

            {versions.filter(v => v.approval_status !== 'merged').length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
                <div className="space-y-2 text-sm">
                  {versions.filter(v => v.approval_status !== 'merged').slice(0, 3).map(version => (
                    <div key={version.id} className="flex items-center space-x-2 text-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="truncate">{version.commit_message || 'Updated contract'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showInviteForm && (
        <InviteMemberForm 
          contractId={contract.id}
          onInvite={onInvite}
          onClose={() => setShowInviteForm(false)}
        />
      )}
    </div>
  )
}

