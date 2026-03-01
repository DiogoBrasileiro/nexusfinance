# Nexus Finance — Data Service v2.0
## Endpoints Públicos (Market Data)
- GET /health
- GET /snapshot?symbols=BTCUSDT&include=macro&tf=1h,4h
- GET /ticker
- GET /candles?tf=1h&limit=50

## Endpoints Privados Binance (requerem headers X-Binance-ApiKey + X-Binance-Secret)

### Spot
- GET  /account/spot/balances
- GET  /account/spot/orders
- GET  /account/spot/trades?symbol=BTCUSDT&limit=20
- POST /account/spot/order         body: {symbol, side, type, quantity, price?}
- DEL  /account/spot/order?symbol=BTCUSDT&orderId=123

### Futures USDT-M
- GET  /account/futures/balances
- GET  /account/futures/positions
- GET  /account/futures/orders
- GET  /account/futures/trades?symbol=BTCUSDT&limit=20
- GET  /account/futures/income
- POST /account/futures/order
- DEL  /account/futures/order?symbol=BTCUSDT&orderId=123

### Filtros
- GET /account/filters?symbol=BTCUSDT&market=spot

## Deploy Cloud Run (1 comando)
```bash
gcloud run deploy nexus-data-service \
  --source . --region us-central1 \
  --allow-unauthenticated --memory 256Mi
```
Cole a URL em Pipeline & IA → Data Service URL.

## Segurança
- HMAC-SHA256 assinado no servidor (secret NUNCA vai ao browser)
- API Keys em headers HTTP (não em URL)
- Rate limit: 120 req/min por IP
- Use chaves com permissão Leitura + Trading. NUNCA ative Saque.
