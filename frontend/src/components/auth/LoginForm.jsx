import { useState } from 'react'

export function LoginForm({ onLogin, onSwitch }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(email, password) }}>
      <div className="space-y-4">
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
        Login
      </button>
      <button
        type="button"
        onClick={onSwitch}
        className="w-full text-sm text-blue-600 hover:text-blue-500"
      >
        Need an account? Register
      </button>
    </form>
  )
}

