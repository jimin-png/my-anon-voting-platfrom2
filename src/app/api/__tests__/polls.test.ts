// src/app/api/__tests__/polls.test.ts
import { POST, GET } from '../polls/route'
import { NextRequest } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import Poll from '@/models/Poll'

// Mock dependencies
jest.mock('@/lib/dbConnect')
jest.mock('@/models/Poll')
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-poll-id-123'),
}))

describe('Polls API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/polls', () => {
    const validPollData = {
      creatorWallet: '0x1234567890123456789012345678901234567890',
      title: 'Test Poll',
      description: 'Test Description',
      candidates: [
        { id: '1', label: 'Candidate 1' },
        { id: '2', label: 'Candidate 2' },
      ],
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
    }

    it('should create a poll successfully', async () => {
      ;(dbConnect as jest.Mock).mockResolvedValue({})
      ;(Poll.create as jest.Mock).mockResolvedValue({
        pollId: 'test-poll-id-123',
        ...validPollData,
      })

      const req = new NextRequest('http://localhost:3000/api/polls', {
        method: 'POST',
        body: JSON.stringify(validPollData),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.pollId).toBe('test-poll-id-123')
    })

    it('should return 400 for invalid data', async () => {
      ;(dbConnect as jest.Mock).mockResolvedValue({})

      const req = new NextRequest('http://localhost:3000/api/polls', {
        method: 'POST',
        body: JSON.stringify({ title: '' }), // Invalid: missing required fields
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return 400 when endTime is before startTime', async () => {
      ;(dbConnect as jest.Mock).mockResolvedValue({})

      const invalidData = {
        ...validPollData,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() - 3600000).toISOString(), // Before startTime
      }

      const req = new NextRequest('http://localhost:3000/api/polls', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.message).toContain('마감 시간')
    })
  })

  describe('GET /api/polls', () => {
    it('should return polls for a creator', async () => {
      ;(dbConnect as jest.Mock).mockResolvedValue({})
      ;(Poll.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { pollId: '1', title: 'Poll 1' },
            { pollId: '2', title: 'Poll 2' },
          ]),
        }),
      })

      const req = new NextRequest(
        'http://localhost:3000/api/polls?creator=0x1234...'
      )

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data.length).toBe(2)
    })

    it('should return all polls when no creator specified', async () => {
      ;(dbConnect as jest.Mock).mockResolvedValue({})
      ;(Poll.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest
              .fn()
              .mockResolvedValue([{ pollId: '1', title: 'Poll 1' }]),
          }),
        }),
      })

      const req = new NextRequest('http://localhost:3000/api/polls')

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
