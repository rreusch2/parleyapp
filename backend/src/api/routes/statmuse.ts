import express from 'express';
import axios from 'axios';

const router = express.Router();

// Base URL for the StatMuse service (Railway)
const STATMUSE_BASE_URL = process.env.STATMUSE_API_URL || 'https://web-production-f090e.up.railway.app';

// Helper to forward requests
async function forwardPost(path: string, body: any) {
  const url = `${STATMUSE_BASE_URL}${path}`;
  const response = await axios.post(url, body, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    // Do NOT forward Authorization from mobile to StatMuse directly
  });
  return response.data;
}

async function forwardGet(path: string) {
  const url = `${STATMUSE_BASE_URL}${path}`;
  const response = await axios.get(url, { timeout: 10000 });
  return response.data;
}

router.get('/health', async (req, res) => {
  try {
    const data = await forwardGet('/health');
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Upstream health check failed', details: err?.message || String(err) });
  }
});

router.get('/cache-stats', async (req, res) => {
  try {
    const data = await forwardGet('/cache-stats');
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Upstream cache stats failed', details: err?.message || String(err) });
  }
});

router.post('/query', async (req, res) => {
  try {
    const data = await forwardPost('/query', req.body);
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Instant Intel upstream failure', details: err?.message || String(err) });
  }
});

router.post('/head-to-head', async (req, res) => {
  try {
    const data = await forwardPost('/head-to-head', req.body);
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Head-to-head upstream failure', details: err?.message || String(err) });
  }
});

router.post('/team-record', async (req, res) => {
  try {
    const data = await forwardPost('/team-record', req.body);
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Team record upstream failure', details: err?.message || String(err) });
  }
});

router.post('/player-stats', async (req, res) => {
  try {
    const data = await forwardPost('/player-stats', req.body);
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Player stats upstream failure', details: err?.message || String(err) });
  }
});

export default router;
