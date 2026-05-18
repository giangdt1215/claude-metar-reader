import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => JSON.stringify(data) };
}

describe('GET /api/metar/:icao', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('input validation', () => {
    it('rejects codes with invalid characters', async () => {
      const res = await request(app).get('/api/metar/!!');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid airport code/i);
    });

    it('rejects codes shorter than 3 characters', async () => {
      const res = await request(app).get('/api/metar/AB');
      expect(res.status).toBe(400);
    });

    it('rejects codes longer than 5 characters', async () => {
      const res = await request(app).get('/api/metar/TOOLONG');
      expect(res.status).toBe(400);
    });

    it('accepts 3-character codes', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([{ icaoId: 'LAX' }]));
      const res = await request(app).get('/api/metar/LAX');
      expect(res.status).toBe(200);
    });

    it('accepts 4-character ICAO codes', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([{ icaoId: 'KJFK' }]));
      const res = await request(app).get('/api/metar/KJFK');
      expect(res.status).toBe(200);
    });
  });

  describe('upstream error handling', () => {
    it('returns 502 when the aviation weather API is unavailable', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      const res = await request(app).get('/api/metar/KJFK');
      expect(res.status).toBe(502);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 404 for empty result array', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([]));
      const res = await request(app).get('/api/metar/XXXX');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/no metar found/i);
    });

    it('returns 404 for 204 No Content response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' });
      const res = await request(app).get('/api/metar/XXXX');
      expect(res.status).toBe(404);
    });

    it('returns 404 for empty body', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '   ' });
      const res = await request(app).get('/api/metar/XXXX');
      expect(res.status).toBe(404);
    });

    it('returns 500 when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      const res = await request(app).get('/api/metar/KJFK');
      expect(res.status).toBe(500);
    });
  });

  describe('successful responses', () => {
    it('returns the first METAR object from the array', async () => {
      const metarData = { icaoId: 'KJFK', temp: 22, wspd: 10 };
      mockFetch.mockResolvedValueOnce(makeResponse([metarData]));
      const res = await request(app).get('/api/metar/KJFK');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(metarData);
    });

    it('uppercases the ICAO code before fetching', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([{ icaoId: 'KJFK' }]));
      await request(app).get('/api/metar/kjfk');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('KJFK'));
    });

    it('calls the aviation weather API with the correct URL', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([{ icaoId: 'EGLL' }]));
      await request(app).get('/api/metar/EGLL');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://aviationweather.gov/api/data/metar?ids=EGLL&format=json'
      );
    });
  });
});
