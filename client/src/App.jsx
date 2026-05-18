import { useState, useCallback } from 'react';
import {
  knotsToMs, feetToMeters, milesToKm, visIsUnlimited, inHgToHpa,
  degreesToCompass, COVER_LABEL, effectiveCover, skySummary,
  decodeWx, tempFeeling, visLabel, weatherEmoji, buildSummary, formatTime,
} from './utils.js';

// ─── Component ─────────────────────────────────────────────────────────────
const EXAMPLES = ['KJFK', 'EGLL', 'YSSY', 'RJTT', 'FAOR', 'KMCI'];

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metar, setMetar] = useState(null);

  const fetchMetar = useCallback(async (code) => {
    const icao = code.trim().toUpperCase();
    if (!icao) return;
    setLoading(true);
    setError(null);
    setMetar(null);

    try {
      const res = await fetch(`/api/metar/${encodeURIComponent(icao)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to fetch METAR data.'); return; }
      setMetar(data);
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => { e.preventDefault(); fetchMetar(input); };

  // Derived display values
  const visKm = metar?.visib != null ? milesToKm(metar.visib) : null;
  const visUnlimited = metar ? visIsUnlimited(metar.visib) || visKm >= 16 : false;
  const windMs = metar?.wspd != null ? knotsToMs(metar.wspd) : null;
  const gustMs = metar?.wgst != null ? knotsToMs(metar.wgst) : null;
  const cloudBaseM = metar?.clouds?.[0]?.base != null ? feetToMeters(metar.clouds[0].base) : null;
  const skycover = metar ? effectiveCover(metar) : null;
  const wxDecoded = metar?.wxString ? decodeWx(metar.wxString) : null;
  const summary = metar ? buildSummary(metar) : null;

  const isWindCalm = metar?.wspd === 0 || metar?.wdir === 0;
  const isVrb = typeof metar?.wdir === 'string' && metar.wdir.toUpperCase() === 'VRB';

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">METAR Reader</h1>
        <p className="subtitle">Plain-English weather reports for any airport worldwide</p>
      </header>

      <main className="main">
        <form className="search-form" onSubmit={handleSubmit}>
          <div className="search-row">
            <input
              type="text"
              className="search-input"
              placeholder="Airport code, e.g. KJFK"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              maxLength={5}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" className="search-btn" disabled={loading || !input.trim()}>
              {loading ? 'Loading…' : 'Get Weather'}
            </button>
          </div>
          <p className="hint">Use the 4-letter ICAO code — e.g. KJFK (New York JFK), EGLL (London Heathrow), YSSY (Sydney)</p>
        </form>

        {error && (
          <div className="error-card">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {metar && (
          <div className="results">
            <div className="airport-header">
              <span className="airport-emoji">{weatherEmoji(metar)}</span>
              <div>
                <h2 className="airport-name">{metar.name || metar.icaoId}</h2>
                <div className="airport-meta">
                  <span className="airport-badge">{metar.icaoId}</span>
                  {metar.obsTime && (
                    <span className="obs-time">Observed {formatTime(metar.obsTime)}</span>
                  )}
                </div>
              </div>
            </div>

            {summary && (
              <div className="summary-card">
                <p className="summary-text">{summary}</p>
              </div>
            )}

            <div className="weather-grid">
              {metar.temp != null && (
                <div className="weather-card">
                  <div className="card-icon">🌡️</div>
                  <div className="card-label">Temperature</div>
                  <div className="card-value">{metar.temp}°C</div>
                  <div className="card-detail">{tempFeeling(metar.temp)}</div>
                  {metar.dewp != null && (
                    <div className="card-sub">Dew point: {metar.dewp}°C</div>
                  )}
                </div>
              )}

              {metar.wspd != null && (
                <div className="weather-card">
                  <div className="card-icon">💨</div>
                  <div className="card-label">Wind</div>
                  {isWindCalm ? (
                    <div className="card-value">Calm</div>
                  ) : (
                    <>
                      <div className="card-value">{windMs} m/s</div>
                      <div className="card-detail">
                        {isVrb ? 'Variable direction' : `from the ${degreesToCompass(metar.wdir) ?? `${metar.wdir}°`}`}
                      </div>
                      {gustMs && <div className="card-sub">Gusts: {gustMs} m/s</div>}
                    </>
                  )}
                </div>
              )}

              {visKm != null && (
                <div className="weather-card">
                  <div className="card-icon">👁️</div>
                  <div className="card-label">Visibility</div>
                  <div className="card-value">
                    {visUnlimited ? '>10 km' : `${visKm} km`}
                  </div>
                  <div className="card-detail">{visLabel(visUnlimited ? Infinity : visKm)}</div>
                </div>
              )}

              {skycover && (
                <div className="weather-card">
                  <div className="card-icon">☁️</div>
                  <div className="card-label">Sky</div>
                  <div className="card-value card-value--sm">
                    {COVER_LABEL[skycover] ?? skycover}
                  </div>
                  {cloudBaseM != null && (
                    <div className="card-detail">Base: {cloudBaseM.toLocaleString()} m</div>
                  )}
                  {metar.clouds && metar.clouds.length > 1 && (
                    <div className="card-sub">{skySummary(metar.clouds.slice(1))}</div>
                  )}
                </div>
              )}

              {metar.altim != null && (
                <div className="weather-card">
                  <div className="card-icon">📊</div>
                  <div className="card-label">Pressure</div>
                  <div className="card-value">{inHgToHpa(metar.altim)} hPa</div>
                  <div className="card-detail">{metar.altim.toFixed(2)} inHg</div>
                </div>
              )}

              {wxDecoded && (
                <div className="weather-card">
                  <div className="card-icon">🌦️</div>
                  <div className="card-label">Phenomena</div>
                  <div className="card-value card-value--sm">{wxDecoded}</div>
                </div>
              )}
            </div>

            <details className="raw-metar">
              <summary>Raw METAR</summary>
              <code className="raw-text">{metar.rawOb}</code>
            </details>
          </div>
        )}

        {!metar && !error && !loading && (
          <div className="examples">
            <p className="examples-label">Try an airport:</p>
            <div className="example-buttons">
              {EXAMPLES.map((code) => (
                <button
                  key={code}
                  className="example-btn"
                  onClick={() => { setInput(code); fetchMetar(code); }}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        Weather data from{' '}
        <a href="https://aviationweather.gov" target="_blank" rel="noopener noreferrer">
          aviationweather.gov
        </a>
      </footer>
    </div>
  );
}
