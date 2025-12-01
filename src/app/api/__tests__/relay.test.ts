// src/app/api/__tests__/relay.test.ts
import { POST } from '../relay/route'
import { NextRequest } from 'next/server'
import { getNextNonce } from '@/lib/services/nonce.service'
import { trackTransactionConfirmation } from '@/lib/services/confirmation.service'
import { ethers } from 'ethers'

// Mock dependencies
jest.mock('@/lib/services/nonce.service')
jest.mock('@/lib/services/confirmation.service')
jest.mock('ethers')

describe('Relay API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.RELAYER_PRIVATE_KEY =
      '0x1234567890123456789012345678901234567890123456789012345678901234'
    process.env.INFURA_URL = 'https://sepolia.infura.io/v3/test'
  })

  const validRelayData = {
    to: '0x1234567890123456789012345678901234567890',
    data: '0xabcdef',
    pollId: 'test-poll-id',
    chainId: 11155111,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  }

  it('should relay transaction successfully', async () => {
    ;(getNextNonce as jest.Mock).mockResolvedValue(1)

    const mockTx = {
      hash: '0xtxhash123',
      nonce: 1,
    }

    const mockWallet = {
      sendTransaction: jest.fn().mockResolvedValue(mockTx),
    }

    ;(ethers.JsonRpcProvider as unknown as jest.Mock).mockImplementation(
      () => ({})
    )
    ;(ethers.Wallet as unknown as jest.Mock).mockImplementation(
      () => mockWallet
    )
    ;(trackTransactionConfirmation as jest.Mock).mockResolvedValue(undefined)

    const req = new NextRequest('http://localhost:3000/api/relay', {
      method: 'POST',
      body: JSON.stringify(validRelayData),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.txHash).toBe('0xtxhash123')
    expect(getNextNonce).toHaveBeenCalled()
    expect(mockWallet.sendTransaction).toHaveBeenCalled()
  })

  it('should return 400 for invalid data', async () => {
    const req = new NextRequest('http://localhost:3000/api/relay', {
      method: 'POST',
      body: JSON.stringify({ to: 'invalid' }), // Invalid: missing required fields
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Failed')
  })

  it('should return 500 when environment variables are missing', async () => {
    delete process.env.RELAYER_PRIVATE_KEY

    const req = new NextRequest('http://localhost:3000/api/relay', {
      method: 'POST',
      body: JSON.stringify(validRelayData),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.message).toContain('설정 오류')
  })
})
