# Nexus Finance — Data Service

Backend real-time para BTC Trading Desk. Busca dados da Binance com cache TTL inteligente.

## Endpoints

| Endpoint | Descrição | Cache TTL |
|----------|-----------|-----------|
| `GET /health` | Status do serviço + cache | — |
| `GET /snapshot` | Snapshot completo (ticker + candles + macro) | Misto |
| `GET /ticker` | Só preço BTC (polling rápido) | 5s |
| `GET /candles?tf=1h&limit=50` | Candles OHLCV | 20s–60s |

## Cache TTL (spec A2)
- Ticker/price: **5s**
- Candles 1m: **20s**
- Candles 15m/1h/4h: **60s**
- Macro (BCB, PTAX): **15min**

---

## Deploy no Cloud Run (recomendado)

### Pré-requisitos
```bash
# Instalar Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

gcloud auth login
gcloud config set project SEU_PROJETO_ID
```

### Deploy direto (sem Docker local)
```bash
cd data-service/
gcloud run deploy nexus-data-service \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --port 8080
```

Cloud Run retorna uma URL tipo:
`https://nexus-data-service-xxxx-uc.a.run.app`

Cole essa URL no app Nexus Finance em **Pipeline & IA → Data Service URL**.

---

## Deploy no Railway (alternativa gratuita)

1. Crie conta em [railway.app](https://railway.app)
2. New Project → Deploy from GitHub (suba este repo)
3. Railway detecta o Dockerfile automaticamente
4. URL gerada: `https://nexus-data-service.railway.app`

---

## Deploy no Render (alternativa gratuita)

1. Crie conta em [render.com](https://render.com)
2. New Web Service → conecte repositório
3. Runtime: Docker
4. URL gerada: `https://nexus-data-service.onrender.com`

⚠️ No plano free do Render, o serviço "dorme" após 15min inativo.

---

## Testar localmente

```bash
npm install
npm start

# Testar endpoints
curl http://localhost:8080/health
curl "http://localhost:8080/snapshot?symbols=BTCUSDT&include=macro&tf=1h,4h"
curl "http://localhost:8080/ticker"
curl "http://localhost:8080/candles?tf=1h&limit=20"
```

---

## Variáveis de ambiente

| Var | Descrição | Default |
|-----|-----------|---------|
| `PORT` | Porta HTTP | `8080` |
| `ALLOWED_ORIGINS` | CORS origins (vírgula) | `*` |

---

## Verificar que está real-time

No topo da página `/btc` do app, você deve ver:
- **Idade do dado: 1–10s** ✅
- Status: **OK** (verde)
- Last update atualizando a cada 10s

Se mostrar > 30s → dado STALE → botão "Rodar Análise" bloqueado automaticamente.
