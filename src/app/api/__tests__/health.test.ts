// src/app/api/__tests__/health.test.ts
import { GET } from '../health/route';
import dbConnect from '@/lib/dbConnect';

// Mock dbConnect
jest.mock('@/lib/dbConnect', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('Health API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return 200 when DB is connected', async () => {
      (dbConnect as jest.Mock).mockResolvedValue({ connection: { db: {} } });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.db).toBe('connected');
    });

    it('should return 500 when DB connection fails', async () => {
      (dbConnect as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Connection failed');
    });
  });
});

