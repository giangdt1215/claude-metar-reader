import { useState, useCallback } from 'react';

// ─── Unit conversions ──────────────────────────────────────────────────────
const knotsToMs = (kt) => Math.round(kt * 0.514444 * 10) / 10;
const feetToMeters = (ft) => Math.round(ft * 0.3048);
const milesToKm = (mi) => {
  const v = parseFloat(mi);
  if (isNaN(v)) return null;
  return Math.round(v * 1.60934 * 10) / 10;
};
const visIsUnlimited = (mi) => typeof mi === 'string' && mi.startsWith('10+');
const inHgToHpa = (inHg) => Math.round(inHg * 33.8639);

// ─── Wind direction ────────────────────────────────────────────────────────
function degreesToCompass(deg) {
  if (deg == null || deg === 0) return null;
  const dirs = [
    'north', 'north-northeast', 'northeast', 'east-northeast',
    'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest',
    'west', 'west-northwest', 'northwest', 'north-northwest',
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Sky / cloud descriptions ──────────────────────────────────────────────
const COVER_LABEL = {
  CLR: 'Clear', SKC: 'Clear', CAVOK: 'Clear',
  FEW: 'Few clouds', SCT: 'Scattered clouds',
  BKN: 'Broken clouds', OVC: 'Overcast',
  VV: 'Sky obscured', OVX: 'Sky obscured',
};

// The API sometimes puts cover in top-level `cover` with an empty clouds array
function effectiveCover(data) {
  return data.clouds?.[0]?.cover ?? data.cover ?? null;
}

function skySummary(clouds) {
  if (!clouds || clouds.length === 0) return null;
  if (clouds.some((c) => c.cover === 'CLR' || c.cover === 'SKC')) return 'Clear';
  return clouds
    .map((c) => {
      const label = COVER_LABEL[c.cover] ?? c.cover;
      return c.base != null ? `${label} at ${feetToMeters(c.base).toLocaleString()} m` : label;
    })
    .join('; ');
}

// ─── Weather phenomena decoder ─────────────────────────────────────────────
const WX_INTENSITY = { '+': 'heavy', '-': 'light', VC: 'nearby' };
const WX_DESCRIPTOR = {
  MI: 'shallow', BC: 'patchy', PR: 'partial', DR: 'low drifting',
  BL: 'blowing', SH: 'shower', FZ: 'freezing', TS: 'thunderstorm',
};
const WX_PRECIP = {
  DZ: 'drizzle', RA: 'rain', SN: 'snow', SG: 'snow grains',
  IC: 'ice crystals', PL: 'ice pellets', GR: 'hail', GS: 'small hail', UP: 'precipitation',
};
const WX_OBSCURE = {
  BR: 'mist', FG: 'fog', FU: 'smoke', VA: 'volcanic ash',
  DU: 'dust', SA: 'sand', HZ: 'haze', PY: 'spray',
};
const WX_OTHER = {
  PO: 'dust/sand whirls', SQ: 'squalls', FC: 'tornado/funnel cloud',
  SS: 'sandstorm', DS: 'duststorm',
};
const ALL_WX = { ...WX_PRECIP, ...WX_OBSCURE, ...WX_OTHER };

function decodeWx(wxString) {
  if (!wxString) return null;
  const groups = wxString.trim().split(/\s+/);
  const decoded = groups.map((group) => {
    let s = group;
    const parts = [];

    if (s.startsWith('+')) { parts.push('heavy'); s = s.slice(1); }
    else if (s.startsWith('-')) { parts.push('light'); s = s.slice(1); }
    else if (s.startsWith('VC')) { parts.push('nearby'); s = s.slice(2); }

    for (const [code, text] of Object.entries(WX_DESCRIPTOR)) {
      if (s.startsWith(code)) { parts.push(text); s = s.slice(2); break; }
    }

    while (s.length >= 2) {
      const code = s.slice(0, 2);
      parts.push(ALL_WX[code] ?? code);
      s = s.slice(2);
    }

    return parts.join(' ');
  });
  return decoded.filter(Boolean).join(', ');
}

// ─── Descriptive helpers ───────────────────────────────────────────────────
function tempFeeling(c) {
  if (c >= 40) return 'dangerously hot';
  if (c >= 35) return 'very hot';
  if (c >= 28) return 'hot';
  if (c >= 20) return 'warm';
  if (c >= 15) return 'mild';
  if (c >= 10) return 'cool';
  if (c >= 5) return 'chilly';
  if (c >= 0) return 'near freezing';
  if (c >= -10) return 'freezing cold';
  return 'extremely cold';
}

function visLabel(km) {
  if (!isFinite(km) || km >= 16) return 'excellent (>10 km)';
  if (km >= 10) return 'good';
  if (km >= 5) return 'moderate';
  if (km >= 1.6) return 'reduced';
  if (km >= 0.8) return 'poor';
  return 'very poor';
}

function weatherEmoji(data) {
  const wx = data.wxString ?? '';
  const sky = effectiveCover(data);
  if (wx.includes('TS')) return '⛈️';
  if (wx.includes('SN') || wx.includes('SG') || wx.includes('PL')) return '🌨️';
  if (wx.includes('RA') || wx.includes('DZ')) return '🌧️';
  if (wx.includes('FG')) return '🌫️';
  if (wx.includes('HZ') || wx.includes('FU') || wx.includes('DU')) return '🌫️';
  if (sky === 'CLR' || sky === 'SKC') return '☀️';
  if (sky === 'FEW') return '🌤️';
  if (sky === 'SCT') return '⛅';
  if (sky === 'BKN') return '🌥️';
  if (sky === 'OVC') return '☁️';
  return '🌡️';
}

// ─── Plain-English summary paragraph ──────────────────────────────────────
function buildSummary(d) {
  const sentences = [];

  const sky = effectiveCover(d);
  const wxPhrase = decodeWx(d.wxString);

  if (wxPhrase) {
    sentences.push(`There is currently ${wxPhrase}.`);
  } else {
    const skyText = { CLR: 'Skies are clear.', SKC: 'Skies are clear.', FEW: 'Mostly clear with a few clouds.', SCT: 'Partly cloudy.', BKN: 'Mostly cloudy.', OVC: 'Overcast skies.' };
    if (skyText[sky]) sentences.push(skyText[sky]);
  }

  if (d.temp != null) {
    sentences.push(`The temperature is ${d.temp}°C — ${tempFeeling(d.temp)}.`);
  }

  if (d.wspd != null) {
    if (d.wspd === 0 || d.wdir === 0) {
      sentences.push('Winds are calm.');
    } else {
      const dir = typeof d.wdir === 'string' && d.wdir.toUpperCase() === 'VRB'
        ? 'variable direction'
        : `from the ${degreesToCompass(d.wdir) ?? `${d.wdir}°`}`;
      let s = `Wind is blowing ${dir} at ${knotsToMs(d.wspd)} m/s`;
      if (d.wgst) s += `, gusting to ${knotsToMs(d.wgst)} m/s`;
      sentences.push(s + '.');
    }
  }

  if (d.visib != null) {
    const km = milesToKm(d.visib);
    const unlimited = visIsUnlimited(d.visib) || km >= 16;
    const display = unlimited ? 'greater than 10 km' : `${km} km`;
    sentences.push(`Visibility is ${display} — ${visLabel(unlimited ? Infinity : km)}.`);
  }

  return sentences.join(' ');
}

function formatTime(obsTime) {
  if (!obsTime) return null;
  return new Date(obsTime * 1000).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }) + ' UTC';
}

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
