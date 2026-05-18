// Unit conversions
export const knotsToMs = (kt) => Math.round(kt * 0.514444 * 10) / 10;
export const feetToMeters = (ft) => Math.round(ft * 0.3048);
export const milesToKm = (mi) => {
  const v = parseFloat(mi);
  if (isNaN(v)) return null;
  return Math.round(v * 1.60934 * 10) / 10;
};
export const visIsUnlimited = (mi) => typeof mi === 'string' && mi.startsWith('10+');
export const inHgToHpa = (inHg) => Math.round(inHg * 33.8639);

// Wind direction
export function degreesToCompass(deg) {
  if (deg == null || deg === 0) return null;
  const dirs = [
    'north', 'north-northeast', 'northeast', 'east-northeast',
    'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest',
    'west', 'west-northwest', 'northwest', 'north-northwest',
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Sky / cloud descriptions
export const COVER_LABEL = {
  CLR: 'Clear', SKC: 'Clear', CAVOK: 'Clear',
  FEW: 'Few clouds', SCT: 'Scattered clouds',
  BKN: 'Broken clouds', OVC: 'Overcast',
  VV: 'Sky obscured', OVX: 'Sky obscured',
};

// The API sometimes puts cover in top-level `cover` with an empty clouds array
export function effectiveCover(data) {
  return data.clouds?.[0]?.cover ?? data.cover ?? null;
}

export function skySummary(clouds) {
  if (!clouds || clouds.length === 0) return null;
  if (clouds.some((c) => c.cover === 'CLR' || c.cover === 'SKC')) return 'Clear';
  return clouds
    .map((c) => {
      const label = COVER_LABEL[c.cover] ?? c.cover;
      return c.base != null ? `${label} at ${feetToMeters(c.base).toLocaleString()} m` : label;
    })
    .join('; ');
}

// Weather phenomena decoder
export const WX_DESCRIPTOR = {
  MI: 'shallow', BC: 'patchy', PR: 'partial', DR: 'low drifting',
  BL: 'blowing', SH: 'shower', FZ: 'freezing', TS: 'thunderstorm',
};
export const WX_PRECIP = {
  DZ: 'drizzle', RA: 'rain', SN: 'snow', SG: 'snow grains',
  IC: 'ice crystals', PL: 'ice pellets', GR: 'hail', GS: 'small hail', UP: 'precipitation',
};
export const WX_OBSCURE = {
  BR: 'mist', FG: 'fog', FU: 'smoke', VA: 'volcanic ash',
  DU: 'dust', SA: 'sand', HZ: 'haze', PY: 'spray',
};
export const WX_OTHER = {
  PO: 'dust/sand whirls', SQ: 'squalls', FC: 'tornado/funnel cloud',
  SS: 'sandstorm', DS: 'duststorm',
};
const ALL_WX = { ...WX_PRECIP, ...WX_OBSCURE, ...WX_OTHER };

export function decodeWx(wxString) {
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

// Descriptive helpers
export function tempFeeling(c) {
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

export function visLabel(km) {
  if (!isFinite(km) || km >= 16) return 'excellent (>10 km)';
  if (km >= 10) return 'good';
  if (km >= 5) return 'moderate';
  if (km >= 1.6) return 'reduced';
  if (km >= 0.8) return 'poor';
  return 'very poor';
}

export function weatherEmoji(data) {
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

// Plain-English summary paragraph
export function buildSummary(d) {
  const sentences = [];

  const sky = effectiveCover(d);
  const wxPhrase = decodeWx(d.wxString);

  if (wxPhrase) {
    sentences.push(`There is currently ${wxPhrase}.`);
  } else {
    const skyText = {
      CLR: 'Skies are clear.', SKC: 'Skies are clear.',
      FEW: 'Mostly clear with a few clouds.', SCT: 'Partly cloudy.',
      BKN: 'Mostly cloudy.', OVC: 'Overcast skies.',
    };
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

export function formatTime(obsTime) {
  if (!obsTime) return null;
  return new Date(obsTime * 1000).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }) + ' UTC';
}
