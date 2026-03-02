import crypto from 'crypto-js';

const BINANCE_API_URL = 'https://api.binance.com';

export function signQuery(query: string, apiSecret: string): string {
  return crypto.HmacSHA256(query, apiSecret).toString(crypto.enc.Hex);
}

export async function binanceRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE',
  apiKey: string,
  apiSecret: string,
  params: Record<string, any> = {}
) {
  const timestamp = Date.now();
  const queryString = new URLSearchParams({ ...params, timestamp: timestamp.toString() }).toString();
  const signature = signQuery(queryString, apiSecret);
  const url = `${BINANCE_API_URL}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Binance API Error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}
