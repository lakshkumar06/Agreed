import { useState } from 'react'

export function WalletRegisterForm({ onRegister, onSwitch, walletAddress }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); onRegister(name, email, password) }}>
      <div className="space-y-4">
        <div className="text-sm text-gray-600 bg-gray-100 p-3 rounded-md">
          Wallet: {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
        </div>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>
      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
      >
        Complete Registration
      </button>
      <button
        type="button"
        onClick={onSwitch}
        className="w-full text-sm text-blue-600 hover:text-blue-500"
      >
        Cancel
      </button>
    </form>
  )
}

