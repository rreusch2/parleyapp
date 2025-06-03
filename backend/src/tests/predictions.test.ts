import request from 'supertest';
import app from '../app';
import { supabase } from '../services/supabase/client';

describe('Predictions API', () => {
  const mockPrediction = {
    id: '123',
    user_id: 'test-user-id',
    event_id: 'event-123',
    sport: 'NBA',
    matchup: 'Lakers vs Warriors',
    pick: 'Lakers ML',
    odds: '-110',
    confidence: 75,
    analysis: 'Test analysis',
    status: 'pending',
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/predictions', () => {
    it('should return all predictions for the user', async () => {
      // Mock Supabase response
      jest.spyOn(supabase, 'from').mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockPrediction],
          error: null
        })
      } as any));

      const response = await request(app)
        .get('/api/predictions')
        .expect(200);

      expect(response.body).toEqual([mockPrediction]);
    });

    it('should handle Supabase errors', async () => {
      jest.spyOn(supabase, 'from').mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      } as any));

      await request(app)
        .get('/api/predictions')
        .expect(500);
    });
  });

  describe('POST /api/predictions', () => {
    const mockEvent = {
      id: 'event-123',
      sport: 'NBA',
      home_team: 'Lakers',
      away_team: 'Warriors',
      start_time: new Date().toISOString()
    };

    const mockPreferences = {
      risk_tolerance: 'moderate'
    };

    it('should generate a new prediction', async () => {
      // Mock user preferences query
      jest.spyOn(supabase, 'from').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPreferences,
          error: null
        })
      } as any));

      // Mock event query
      jest.spyOn(supabase, 'from').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockEvent,
          error: null
        })
      } as any));

      // Mock prediction insert
      jest.spyOn(supabase, 'from').mockImplementationOnce(() => ({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPrediction,
          error: null
        })
      } as any));

      const response = await request(app)
        .post('/api/predictions')
        .send({
          event_id: 'event-123',
          sport: 'NBA'
        })
        .expect(201);

      expect(response.body).toEqual(mockPrediction);
    });
  });

  describe('PATCH /api/predictions/:id/status', () => {
    it('should update prediction status', async () => {
      jest.spyOn(supabase, 'from').mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPrediction, status: 'won' },
          error: null
        })
      } as any));

      const response = await request(app)
        .patch('/api/predictions/123/status')
        .send({ status: 'won' })
        .expect(200);

      expect(response.body.status).toBe('won');
    });

    it('should reject invalid status values', async () => {
      await request(app)
        .patch('/api/predictions/123/status')
        .send({ status: 'invalid' })
        .expect(400);
    });
  });
}); 