import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function WalletPrompt({ onSkip }) {
  return (
    <div className="max-w-md mx-auto pt-20">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Complete Your Setup</h3>
          <p className="text-gray-600">Connect your wallet to enable full functionality</p>
        </div>
        
        <div className="space-y-4">
          <WalletMultiButton className="w-full" />
          
          <div className="text-center">
            <button
              onClick={onSkip}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

