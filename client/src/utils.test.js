import { describe, it, expect } from 'vitest';
import {
  knotsToMs, feetToMeters, milesToKm, visIsUnlimited, inHgToHpa,
  degreesToCompass, effectiveCover, skySummary,
  decodeWx, tempFeeling, visLabel, weatherEmoji, buildSummary, formatTime,
} from './utils.js';

describe('knotsToMs', () => {
  it('converts correctly', () => {
    expect(knotsToMs(0)).toBe(0);
    expect(knotsToMs(10)).toBe(5.1);
    expect(knotsToMs(20)).toBe(10.3);
  });
});

describe('feetToMeters', () => {
  it('converts correctly', () => {
    expect(feetToMeters(0)).toBe(0);
    expect(feetToMeters(1000)).toBe(305);
    expect(feetToMeters(3000)).toBe(914);
  });
});

describe('milesToKm', () => {
  it('converts numeric strings', () => {
    expect(milesToKm('10')).toBe(16.1);
    expect(milesToKm('5')).toBe(8);
  });
  it('returns null for non-numeric input', () => {
    expect(milesToKm('invalid')).toBeNull();
    expect(milesToKm('')).toBeNull();
  });
});

describe('visIsUnlimited', () => {
  it('returns true only for 10+ strings', () => {
    expect(visIsUnlimited('10+')).toBe(true);
    expect(visIsUnlimited('10')).toBe(false);
    expect(visIsUnlimited('9')).toBe(false);
    expect(visIsUnlimited(10)).toBe(false);
  });
});

describe('inHgToHpa', () => {
  it('converts standard pressure correctly', () => {
    expect(inHgToHpa(29.92)).toBe(1013);
    expect(inHgToHpa(30.0)).toBe(1016);
  });
});

describe('degreesToCompass', () => {
  it('returns null for 0 and null', () => {
    expect(degreesToCompass(0)).toBeNull();
    expect(degreesToCompass(null)).toBeNull();
  });
  it('returns correct cardinal directions', () => {
    expect(degreesToCompass(90)).toBe('east');
    expect(degreesToCompass(180)).toBe('south');
    expect(degreesToCompass(270)).toBe('west');
    expect(degreesToCompass(360)).toBe('north');
  });
  it('returns correct intercardinal directions', () => {
    expect(degreesToCompass(45)).toBe('northeast');
    expect(degreesToCompass(135)).toBe('southeast');
    expect(degreesToCompass(225)).toBe('southwest');
    expect(degreesToCompass(315)).toBe('northwest');
  });
});

describe('effectiveCover', () => {
  it('returns cover from first cloud layer', () => {
    expect(effectiveCover({ clouds: [{ cover: 'BKN', base: 3000 }] })).toBe('BKN');
  });
  it('falls back to top-level cover when clouds array is empty', () => {
    expect(effectiveCover({ clouds: [], cover: 'CLR' })).toBe('CLR');
  });
  it('returns null when no cover is available', () => {
    expect(effectiveCover({ clouds: [] })).toBeNull();
    expect(effectiveCover({})).toBeNull();
  });
});

describe('skySummary', () => {
  it('returns null for empty or missing clouds', () => {
    expect(skySummary(null)).toBeNull();
    expect(skySummary([])).toBeNull();
  });
  it('returns "Clear" when CLR or SKC is present', () => {
    expect(skySummary([{ cover: 'CLR' }])).toBe('Clear');
    expect(skySummary([{ cover: 'SKC' }])).toBe('Clear');
  });
  it('formats cloud layers with base altitude', () => {
    const result = skySummary([{ cover: 'FEW', base: 1000 }]);
    expect(result).toMatch(/Few clouds at \d+ m/);
  });
  it('joins multiple layers with semicolons', () => {
    const result = skySummary([{ cover: 'FEW', base: 1000 }, { cover: 'BKN', base: 3000 }]);
    expect(result).toContain(';');
    expect(result).toContain('Few clouds');
    expect(result).toContain('Broken clouds');
  });
});

describe('decodeWx', () => {
  it('returns null for falsy input', () => {
    expect(decodeWx(null)).toBeNull();
    expect(decodeWx('')).toBeNull();
  });
  it('decodes simple phenomena', () => {
    expect(decodeWx('RA')).toBe('rain');
    expect(decodeWx('FG')).toBe('fog');
    expect(decodeWx('SN')).toBe('snow');
    expect(decodeWx('BR')).toBe('mist');
  });
  it('decodes intensity prefixes', () => {
    expect(decodeWx('-RA')).toBe('light rain');
    expect(decodeWx('+RA')).toBe('heavy rain');
  });
  it('decodes descriptors', () => {
    expect(decodeWx('TSRA')).toBe('thunderstorm rain');
    expect(decodeWx('+TSRA')).toBe('heavy thunderstorm rain');
    expect(decodeWx('SHRA')).toBe('shower rain');
  });
  it('decodes multiple phenomena groups', () => {
    expect(decodeWx('FG BR')).toBe('fog, mist');
  });
  it('decodes nearby (VC) intensity', () => {
    expect(decodeWx('VCFG')).toBe('nearby fog');
  });
});

describe('tempFeeling', () => {
  const cases = [
    [42, 'dangerously hot'],
    [36, 'very hot'],
    [30, 'hot'],
    [22, 'warm'],
    [17, 'mild'],
    [12, 'cool'],
    [7, 'chilly'],
    [2, 'near freezing'],
    [-5, 'freezing cold'],
    [-15, 'extremely cold'],
  ];
  it.each(cases)('tempFeeling(%i) → "%s"', (temp, label) => {
    expect(tempFeeling(temp)).toBe(label);
  });
});

describe('visLabel', () => {
  it('returns correct visibility labels', () => {
    expect(visLabel(Infinity)).toBe('excellent (>10 km)');
    expect(visLabel(17)).toBe('excellent (>10 km)');
    expect(visLabel(12)).toBe('good');
    expect(visLabel(7)).toBe('moderate');
    expect(visLabel(2)).toBe('reduced');
    expect(visLabel(1)).toBe('poor');
    expect(visLabel(0.5)).toBe('very poor');
  });
});

describe('weatherEmoji', () => {
  it('returns thunderstorm emoji for TS phenomena', () => {
    expect(weatherEmoji({ wxString: 'TSRA', clouds: [] })).toBe('⛈️');
  });
  it('returns snow emoji for SN/SG/PL phenomena', () => {
    expect(weatherEmoji({ wxString: 'SN', clouds: [] })).toBe('🌨️');
  });
  it('returns rain emoji for RA/DZ phenomena', () => {
    expect(weatherEmoji({ wxString: 'RA', clouds: [] })).toBe('🌧️');
  });
  it('returns fog emoji for FG phenomena', () => {
    expect(weatherEmoji({ wxString: 'FG', clouds: [] })).toBe('🌫️');
  });
  it('returns sky-based emoji when no phenomena', () => {
    expect(weatherEmoji({ clouds: [{ cover: 'CLR' }] })).toBe('☀️');
    expect(weatherEmoji({ clouds: [{ cover: 'FEW' }] })).toBe('🌤️');
    expect(weatherEmoji({ clouds: [{ cover: 'SCT' }] })).toBe('⛅');
    expect(weatherEmoji({ clouds: [{ cover: 'BKN' }] })).toBe('🌥️');
    expect(weatherEmoji({ clouds: [{ cover: 'OVC' }] })).toBe('☁️');
  });
  it('falls back to thermometer emoji when no info', () => {
    expect(weatherEmoji({ clouds: [] })).toBe('🌡️');
  });
});

describe('buildSummary', () => {
  it('includes sky condition when no phenomena', () => {
    const result = buildSummary({ clouds: [{ cover: 'CLR' }], temp: 22, wspd: 0 });
    expect(result).toContain('Skies are clear.');
    expect(result).toContain('22°C');
    expect(result).toContain('Winds are calm.');
  });
  it('uses phenomena description over sky cover', () => {
    const result = buildSummary({ wxString: 'RA', clouds: [{ cover: 'OVC' }], temp: 15 });
    expect(result).toContain('There is currently rain.');
    expect(result).not.toContain('Overcast');
  });
  it('formats wind with direction', () => {
    const result = buildSummary({ clouds: [], wspd: 15, wdir: 270 });
    expect(result).toContain('west');
    expect(result).toContain('m/s');
  });
  it('formats wind with gusts', () => {
    const result = buildSummary({ clouds: [], wspd: 15, wdir: 90, wgst: 25 });
    expect(result).toContain('gusting to');
  });
  it('handles variable wind direction', () => {
    const result = buildSummary({ clouds: [], wspd: 10, wdir: 'VRB' });
    expect(result).toContain('variable direction');
  });
  it('formats unlimited visibility', () => {
    const result = buildSummary({ clouds: [], visib: '10+' });
    expect(result).toContain('greater than 10 km');
    expect(result).toContain('excellent');
  });
  it('formats limited visibility', () => {
    // 4 miles = 6.4 km → "moderate" (>= 5 km)
    const result = buildSummary({ clouds: [], visib: '4' });
    expect(result).toContain('km');
    expect(result).toContain('moderate');
  });
});

describe('formatTime', () => {
  it('returns null for falsy input', () => {
    expect(formatTime(null)).toBeNull();
    expect(formatTime(0)).toBeNull();
    expect(formatTime(undefined)).toBeNull();
  });
  it('returns a UTC-suffixed string', () => {
    const result = formatTime(1700000000);
    expect(typeof result).toBe('string');
    expect(result).toContain('UTC');
  });
});
