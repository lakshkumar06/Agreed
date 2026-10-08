import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui'
import axios from 'axios'
import { VersionCompareModal } from './components/VersionCompareModal'
import { WalletPrompt } from './components/WalletPrompt'
import { Dashboard } from './components/Dashboard'
import { CreateContractForm } from './components/CreateContractForm'
import { LoginForm } from './components/auth/LoginForm'
import { EmailRegisterForm } from './components/auth/EmailRegisterForm'
import { WalletRegisterForm } from './components/auth/WalletRegisterForm'
import { InvitationPage } from './components/auth/InvitationPage'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
const ContractDetailView = lazy(() => import('./components/contracts/ContractDetailView').then(module => ({ default: module.ContractDetailView })))

function App() {
  const { publicKey, connected, disconnect, signMessage } = useWallet()
  const [user, setUser] = useState(null)
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [showWalletRegister, setShowWalletRegister] = useState(false)
  const [showEmailRegister, setShowEmailRegister] = useState(false)
  const [showWalletPrompt, setShowWalletPrompt] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [contractMembers, setContractMembers] = useState([])
  const [contractInvitations, setContractInvitations] = useState([])
  const [invitationData, setInvitationData] = useState(null)
  const [showInvitationPage, setShowInvitationPage] = useState(false)
  const [contractVersions, setContractVersions] = useState([])
  const [contractHistory, setContractHistory] = useState([])
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [compareVersions, setCompareVersions] = useState([])
  const walletAttempt = useRef(null)
  const suppressWalletAuth = useRef(null)
  const detailsRequest = useRef(0)
  const sessionRequest = useRef(0)
  const authIntent = useRef(0)

  const beginExplicitAuth = () => {
    const intent = ++authIntent.current
    walletAttempt.current = null
    suppressWalletAuth.current = publicKey?.toBase58() || null
    return intent
  }

  const walletProof = useCallback(async (intent) => {
    if (!signMessage) throw new Error('Wallet does not support message signing')
    const wallet_address = publicKey.toBase58()
    const { data } = await axios.post(`${API_BASE}/auth/wallet/challenge`, { wallet_address })
    if (intent !== authIntent.current) return null
    const bytes = await signMessage(new TextEncoder().encode(data.message))
    if (intent !== authIntent.current) return null
    const signature = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    return { wallet_address, message: data.message, signature }
  }, [publicKey, signMessage])

  const loadDashboard = useCallback(async () => {
    const request = ++sessionRequest.current
    const intent = authIntent.current
    try {
      setDashboardError('')
      const [userRes, contractsRes] = await Promise.all([
        axios.get(`${API_BASE}/auth/me`),
        axios.get(`${API_BASE}/contracts`)
      ])
      if (request !== sessionRequest.current || intent !== authIntent.current) return
      setUser(userRes.data.user)
      setContracts(contractsRes.data.contracts || [])
    } catch (error) {
      if (request !== sessionRequest.current || intent !== authIntent.current) return
      console.error('Failed to load dashboard:', error)
      if (error.response?.status === 401) {
        localStorage.removeItem('token')
        delete axios.defaults.headers.common['Authorization']
        setUser(null)
        setContracts([])
      } else {
        setDashboardError('Could not load your dashboard. Check your connection and retry.')
      }
    }
  }, [])

  const loadInvitationData = useCallback(async (token, signal) => {
    try {
      const res = await axios.get(`${API_BASE}/contracts/invite/${token}`, { signal })
      if (signal.aborted) return
      setInvitationData(res.data.invitation)
      setShowInvitationPage(true)
    } catch (error) {
      if (signal.aborted) return
      console.error('Failed to load invitation:', error)
      alert('Invalid or expired invitation link')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const token = localStorage.getItem('token')
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    else delete axios.defaults.headers.common['Authorization']

    // Restore the session even when the user opens an invitation link.
    const path = window.location.pathname
    if (path.startsWith('/invite/')) {
      const invitationToken = path.slice('/invite/'.length)
      Promise.all([loadInvitationData(invitationToken, controller.signal), token ? loadDashboard() : Promise.resolve()])
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    } else if (token) {
      loadDashboard().finally(() => { if (!controller.signal.aborted) setLoading(false) })
    } else {
      setLoading(false)
    }
    return () => controller.abort()
  }, [loadDashboard, loadInvitationData])

  const handleWalletAuth = useCallback(async () => {
    const intent = authIntent.current
    try {
      const proof = await walletProof(intent)
      if (!proof || walletAttempt.current !== proof.wallet_address || intent !== authIntent.current) return
      const res = await axios.post(`${API_BASE}/auth/wallet/login`, proof)
      if (walletAttempt.current !== proof.wallet_address || intent !== authIntent.current) return
      localStorage.setItem('token', res.data.token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
      setUser(res.data.user)
      await loadDashboard()
    } catch (error) {
      console.error('Wallet auth failed:', error)
      if (error.response?.status === 404 && intent === authIntent.current && walletAttempt.current === publicKey?.toBase58()) {
        setShowWalletRegister(true)
      }
    }
  }, [walletProof, loadDashboard, publicKey])

  const handleLogin = async (email, password) => {
    const intent = beginExplicitAuth()
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password })
      if (intent !== authIntent.current) return
      localStorage.setItem('token', res.data.token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
      suppressWalletAuth.current = null
      setUser(res.data.user)
      await loadDashboard()
      if (intent !== authIntent.current) return
      setShowLogin(false)
    } catch {
      if (intent === authIntent.current) alert('Login failed')
    }
  }

  const handleRegister = async (name, email, password) => {
    const intent = beginExplicitAuth()
    try {
      const res = await axios.post(`${API_BASE}/auth/register`, { name, email, password })
      if (intent !== authIntent.current) return
      localStorage.setItem('token', res.data.token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
      suppressWalletAuth.current = null
      setUser(res.data.user)
      setShowLogin(false)
      setShowEmailRegister(false)
      // After email registration, if wallet not connected, show wallet prompt
      if (!connected) {
        setShowWalletPrompt(true)
      }
    } catch {
      if (intent === authIntent.current) alert('Registration failed')
    }
  }

  const handleWalletRegister = async (name, email, password) => {
    const intent = beginExplicitAuth()
    let registeredUser = null
    try {
      const res = await axios.post(`${API_BASE}/auth/register`, { name, email, password })
      if (intent !== authIntent.current) return
      registeredUser = res.data.user
      localStorage.setItem('token', res.data.token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
      const proof = await walletProof(intent)
      if (!proof || intent !== authIntent.current) return
      await axios.patch(`${API_BASE}/auth/wallet`, proof, {
        headers: { Authorization: `Bearer ${res.data.token}` }
      })
      if (intent !== authIntent.current) return
      suppressWalletAuth.current = null
      setUser({ ...res.data.user, wallet_address: publicKey.toBase58() })
      setShowWalletRegister(false)
      await loadDashboard()
    } catch {
      if (intent !== authIntent.current) return
      if (registeredUser) {
        setUser(registeredUser)
        setShowWalletRegister(false)
        await loadDashboard()
        if (intent !== authIntent.current) return
        alert('Account created, but the wallet could not be linked. You can sign in with email and retry after reconnecting the wallet.')
      } else {
        alert('Registration failed')
      }
    }
  }

  const updateUserWallet = useCallback(async () => {
    const intent = authIntent.current
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const proof = await walletProof(intent)
      if (!proof || walletAttempt.current !== proof.wallet_address || intent !== authIntent.current || token !== localStorage.getItem('token')) return
      await axios.patch(`${API_BASE}/auth/wallet`, proof, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (walletAttempt.current !== proof.wallet_address || intent !== authIntent.current || token !== localStorage.getItem('token')) return
      await loadDashboard()
    } catch (error) {
      console.error('Failed to update wallet:', error)
    }
  }, [walletProof, loadDashboard])

  useEffect(() => {
    if (loading) return
    if (!connected || !publicKey) {
      walletAttempt.current = null
      suppressWalletAuth.current = null
      return
    }
    const address = publicKey.toBase58()
    if (suppressWalletAuth.current === address) return
    if (walletAttempt.current === address) return
    if (user && !user.wallet_address) {
      walletAttempt.current = address
      updateUserWallet()
      setShowWalletPrompt(false)
    } else if (!user) {
      walletAttempt.current = address
      handleWalletAuth()
    }
  }, [connected, publicKey, user, loading, updateUserWallet, handleWalletAuth])

  const createContract = async (title, description, fileContent) => {
    let created = false
    try {
      // First create contract in database
      const res = await axios.post(`${API_BASE}/contracts`, { title, description })
      created = true
      const contract = res.data.contract
      const contractId = contract.id
      
      // Process file with AI if provided
      if (fileContent) {
        await axios.post(`${API_BASE}/contracts/${contractId}/process`, { fileContent })
      }
      
      await loadDashboard()
    } catch (error) {
      console.error('Failed to create contract:', error);
      if (created) {
        await loadDashboard()
        alert('Contract created, but file processing failed. You can open the contract and retry later.')
        return
      }
      throw error
    }
  }

  const loadContractDetails = async (contractId) => {
    const request = ++detailsRequest.current
    try {
      const [membersRes, invitationsRes, versionsRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE}/contracts/${contractId}/members`),
        axios.get(`${API_BASE}/contracts/${contractId}/invitations`),
        axios.get(`${API_BASE}/contracts/${contractId}/versions`),
        axios.get(`${API_BASE}/contracts/${contractId}/history`)
      ])
      if (request !== detailsRequest.current) return
      setContractMembers(membersRes.data.members || [])
      setContractInvitations(invitationsRes.data.invitations || [])
      setContractVersions(versionsRes.data.versions || [])
      setContractHistory(historyRes.data.history || [])
    } catch (error) {
      console.error('Failed to load contract details:', error)
      if (request !== detailsRequest.current) return
      // Set empty arrays on error to prevent stale data
      setContractMembers([])
      setContractInvitations([])
      setContractVersions([])
      setContractHistory([])
    }
  }

  const createInvitation = async (contractId, email, wallet_address, role_in_contract, weight) => {
    try {
      const res = await axios.post(`${API_BASE}/contracts/${contractId}/invite`, {
        email,
        wallet_address,
        role_in_contract,
        weight
      })
      await loadContractDetails(contractId)
      return res.data.invitation
    } catch (error) {
      alert('Failed to create invitation')
      throw error
    }
  }

  const resendInvitation = async (invitationId) => {
    try {
      const res = await axios.post(`${API_BASE}/contracts/invite/${invitationId}/resend`)
      const link = res.data.invitation?.invitation_link
      if (link && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link)
          alert('Invitation link copied to clipboard.')
        } catch {
          window.prompt('Copy invitation link:', link)
        }
      } else if (link) {
        window.prompt('Copy invitation link:', link)
      }
      await loadContractDetails(selectedContract.id)
      return res.data.invitation
    } catch (error) {
      alert('Failed to resend invitation')
      throw error
    }
  }

  const createVersion = async (contractId, content, commitMessage) => {
    try {
      const res = await axios.post(`${API_BASE}/contracts/${contractId}/versions`, {
        content,
        commit_message: commitMessage
      })
      await loadContractDetails(contractId)
      return res.data.version
    } catch (error) {
      console.error('Error creating version:', error)
      throw error
    }
  }

  const handleSelectVersion = (version) => {
    setSelectedVersion(version)
  }

  const handleCompareVersions = (versions) => {
    setCompareVersions(versions)
    setShowCompareModal(true)
  }

  const acceptInvitation = async () => {
    if (!user) {
      alert('Please login first to accept the invitation')
      return
    }

    try {
      const token = window.location.pathname.split('/invite/')[1]
      await axios.post(`${API_BASE}/contracts/invite/${token}/accept`)
      alert('Successfully joined the contract!')
      // Redirect to dashboard
      window.location.href = '/'
    } catch (error) {
      if (error.response?.status === 403) {
        alert('Email address does not match invitation. Please login with the correct email.')
      } else {
        alert('Failed to accept invitation')
      }
    }
  }

  const handleLogout = () => {
    authIntent.current++
    sessionRequest.current++
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
    detailsRequest.current++
    suppressWalletAuth.current = publicKey?.toBase58() || null
    walletAttempt.current = null
    setUser(null)
    setContracts([])
    setSelectedContract(null)
    if (connected) {
      disconnect()
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>

  if (showInvitationPage && (user || (!showLogin && !showEmailRegister && !showWalletRegister))) {
    return (
      <InvitationPage 
        invitation={invitationData}
        user={user}
        onLogin={() => setShowLogin(true)}
        onRegister={() => setShowEmailRegister(true)}
        onAccept={acceptInvitation}
      />
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Agreed.
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Collaborative B2B Contract Workspace
            </p>
          </div>
          
          <div className="space-y-4">
            {dashboardError && (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {dashboardError} <button className="underline" onClick={loadDashboard}>Retry</button>
              </p>
            )}
            <WalletMultiButton className="w-full" />
            
            <div className="text-center text-sm text-gray-500">or</div>
            
            {showLogin ? (
              <LoginForm onLogin={handleLogin} onSwitch={() => setShowLogin(false)} />
            ) : showEmailRegister ? (
              <EmailRegisterForm onRegister={handleRegister} onSwitch={() => setShowEmailRegister(false)} />
            ) : showWalletRegister ? (
              <WalletRegisterForm 
                onRegister={handleWalletRegister} 
                onSwitch={() => setShowWalletRegister(false)}
                walletAddress={publicKey?.toString()}
              />
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setShowLogin(true)}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Email Login
                </button>
                <button
                  onClick={() => setShowEmailRegister(true)}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Email Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow fixed top-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Agreed.</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user.name}</span>
              {connected && (
                <div className="text-xs text-gray-500">
                  {publicKey?.toString().slice(0, 8)}...
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="">
        {dashboardError && (
          <div role="alert" className="mx-[5vw] md:mx-[10vw] pt-20 text-red-700">
            {dashboardError} <button className="underline" onClick={loadDashboard}>Retry</button>
          </div>
        )}
        {showWalletPrompt ? (
          <WalletPrompt onSkip={() => setShowWalletPrompt(false)} />
        ) : selectedContract ? (
          <>
            <Suspense fallback={<div className="pt-24 text-center text-gray-600">Loading contract...</div>}>
            <ContractDetailView
              contract={selectedContract}
              members={contractMembers}
              invitations={contractInvitations}
              currentUserId={user?.id}
              versions={contractVersions}
              history={contractHistory}
              selectedVersion={selectedVersion}
              onBack={() => {
                detailsRequest.current++
                setSelectedContract(null)
                setSelectedVersion(null)
              }}
              onInvite={createInvitation}
              onResend={resendInvitation}
              onRefresh={() => loadContractDetails(selectedContract.id)}
              onCreateVersion={(content, commitMessage) => createVersion(selectedContract.id, content, commitMessage)}
              onSelectVersion={handleSelectVersion}
              onCompareVersions={handleCompareVersions}
            />
            </Suspense>
            {showCompareModal && compareVersions.length === 2 && (
              <VersionCompareModal
                contractId={selectedContract.id}
                version1={compareVersions[0]}
                version2={compareVersions[1]}
                onClose={() => setShowCompareModal(false)}
              />
            )}
          </>
        ) : (
          <Dashboard 
            contracts={contracts} 
            onCreateContract={createContract}
            onRefresh={loadDashboard}
            onSelectContract={(contract) => {
              detailsRequest.current++
              setContractMembers([])
              setContractInvitations([])
              setContractVersions([])
              setContractHistory([])
              setSelectedContract(contract)
              loadContractDetails(contract.id)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default App
