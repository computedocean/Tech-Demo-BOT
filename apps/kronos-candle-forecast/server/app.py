"""Local Kronos helper: POST /forecast with candles, get next-N predicted bars."""
import sys, time
from pathlib import Path

import pandas as pd
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent / "vendor" / "Kronos"))
from model import Kronos, KronosPredictor, KronosTokenizer  # noqa: E402

torch.manual_seed(0)
tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
predictor = KronosPredictor(model, tokenizer, device="cpu", max_context=512)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Bar(BaseModel):
    time: int  # unix seconds
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


class Req(BaseModel):
    bars: list[Bar]
    horizon: int = 20
    lookback: int = 400
    seed: int = 0


@app.get("/health")
def health():
    return {"ok": True, "model": "NeoQuasar/Kronos-small", "tokenizer": "NeoQuasar/Kronos-Tokenizer-base", "device": "cpu"}


@app.post("/forecast")
def forecast(req: Req):
    if len(req.bars) < 32:
        raise HTTPException(400, "need at least 32 bars")
    if not 1 <= req.horizon <= 120:
        raise HTTPException(400, "horizon must be 1..120")
    df = pd.DataFrame([b.model_dump() for b in req.bars]).tail(min(req.lookback, 512)).reset_index(drop=True)
    ts = pd.to_datetime(df["time"], unit="s")
    step = ts.diff().median()
    y_ts = pd.Series([ts.iloc[-1] + step * (i + 1) for i in range(req.horizon)])
    df["amount"] = df["volume"] * df["close"]
    torch.manual_seed(req.seed)
    t0 = time.time()
    pred = predictor.predict(
        df=df[["open", "high", "low", "close", "volume", "amount"]],
        x_timestamp=ts, y_timestamp=y_ts, pred_len=req.horizon,
        T=1.0, top_p=0.9, sample_count=1, verbose=False,
    )
    out = [
        {"time": int(t.timestamp()), **{k: float(r[k]) for k in ("open", "high", "low", "close", "volume")}}
        for t, (_, r) in zip(y_ts, pred.iterrows())
    ]
    return {"bars": out, "seconds": round(time.time() - t0, 2), "context": len(df)}
