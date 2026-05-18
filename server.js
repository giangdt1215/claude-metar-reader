import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));

app.get('/api/metar/:icao', async (req, res) => {
  const icao = req.params.icao.toUpperCase();

  if (!/^[A-Z0-9]{3,5}$/.test(icao)) {
    return res.status(400).json({ error: 'Invalid airport code. Use a 3–5 character ICAO code (e.g. KJFK, EGLL).' });
  }

  try {
    const url = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({ error: 'Could not reach the aviation weather service. Try again shortly.' });
    }

    if (response.status === 204) {
      return res.status(404).json({
        error: `No METAR found for "${icao}". Check the ICAO code — it's usually 4 letters (e.g. KJFK, EGLL, YSSY).`,
      });
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return res.status(404).json({
        error: `No METAR found for "${icao}". Check the ICAO code — it's usually 4 letters (e.g. KJFK, EGLL, YSSY).`,
      });
    }
    const data = JSON.parse(text);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({
        error: `No METAR found for "${icao}". Check the ICAO code — it's usually 4 letters (e.g. KJFK, EGLL, YSSY).`,
      });
    }

    res.json(data[0]);
  } catch (err) {
    console.error('METAR fetch error:', err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`METAR server running on http://localhost:${PORT}`);
  });
}
