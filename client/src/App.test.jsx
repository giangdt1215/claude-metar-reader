import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from './App';

const mockMetar = {
  icaoId: 'KJFK',
  name: 'JFK International',
  temp: 22,
  dewp: 15,
  wspd: 10,
  wdir: 90,
  visib: '10+',
  altim: 29.92,
  clouds: [{ cover: 'FEW', base: 3000 }],
  obsTime: 1700000000,
  rawOb: 'KJFK 221251Z 09010KT 10SM FEW030 22/15 A2992',
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders title and search form', () => {
    render(<App />);
    expect(screen.getByText('METAR Reader')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/airport code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get weather/i })).toBeInTheDocument();
  });

  it('disables submit button when input is empty', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /get weather/i })).toBeDisabled();
  });

  it('shows example airport buttons on initial load', () => {
    render(<App />);
    expect(screen.getByText('KJFK')).toBeInTheDocument();
    expect(screen.getByText('EGLL')).toBeInTheDocument();
  });

  it('shows loading state while fetching', async () => {
    fetch.mockImplementationOnce(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText(/airport code/i), 'KJFK');
    await user.click(screen.getByRole('button', { name: /get weather/i }));
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();
  });

  it('displays error message on API error response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No METAR found for "XXXX".' }),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText(/airport code/i), 'XXXX');
    await user.click(screen.getByRole('button', { name: /get weather/i }));
    expect(await screen.findByText('No METAR found for "XXXX".')).toBeInTheDocument();
  });

  it('displays a generic error on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText(/airport code/i), 'KJFK');
    await user.click(screen.getByRole('button', { name: /get weather/i }));
    expect(await screen.findByText(/could not connect/i)).toBeInTheDocument();
  });

  it('renders weather data on successful fetch', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockMetar });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText(/airport code/i), 'KJFK');
    await user.click(screen.getByRole('button', { name: /get weather/i }));
    expect(await screen.findByText('JFK International')).toBeInTheDocument();
    expect(screen.getByText('22°C')).toBeInTheDocument();
    expect(screen.getByText('KJFK')).toBeInTheDocument();
  });

  it('uppercases typed airport code', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockMetar });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText(/airport code/i), 'kjfk');
    expect(screen.getByPlaceholderText(/airport code/i)).toHaveValue('KJFK');
  });

  it('fetches when an example button is clicked', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockMetar });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('EGLL'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('EGLL'));
  });
});
