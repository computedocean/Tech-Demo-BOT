import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Chart } from '@/Chart'
import { type Bar, forecast, mae, naiveCloses, parseCsv } from '@/lib/candles'

type Score = { kronos: number; naive: number; n: number }
const fmt = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function App() {
  const [bars, setBars] = useState<Bar[]>([])
  const [name, setName] = useState('')
  const [horizon, setHorizon] = useState(20)
  const [backtest, setBacktest] = useState(false)
  const [pred, setPred] = useState<Bar[]>([])
  const [score, setScore] = useState<Score | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [helper, setHelper] = useState<'checking' | 'up' | 'down'>('checking')

  useEffect(() => {
    fetch('/api/health').then((r) => setHelper(r.ok ? 'up' : 'down')).catch(() => setHelper('down'))
  }, [])

  const reset = () => { setPred([]); setScore(null); setInfo('') }
  const loadSample = async () => {
    const text = await (await fetch('/btc-usd-daily.csv')).text()
    setBars(parseCsv(text)); setName('BTC-USD daily (sample)'); reset()
  }
  const onFile = async (f?: File) => {
    if (!f) return
    try { setBars(parseCsv(await f.text())); setName(f.name); reset(); setErr('') } catch (e) { setErr(String(e)) }
  }

  const history = useMemo(() => (backtest ? bars.slice(0, -horizon) : bars), [bars, backtest, horizon])
  const hidden = useMemo(() => (backtest ? bars.slice(-horizon) : []), [bars, backtest, horizon])

  const run = async () => {
    setBusy(true); setErr(''); setScore(null)
    try {
      const r = await forecast(history, horizon)
      setPred(r.bars)
      setInfo(`Kronos-small · ${Math.min(history.length, 400)}-bar context · ${r.seconds}s on CPU`)
      if (backtest) {
        const actual = hidden.map((b) => b.close)
        setScore({ kronos: mae(r.bars.map((b) => b.close), actual), naive: mae(naiveCloses(history.at(-1)!.close, horizon), actual), n: horizon })
      }
    } catch (e) { setErr(String(e)); setPred([]) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kronos candle forecast</h1>
          <p className="text-sm text-muted-foreground">Next-bar predictions from the open-source Kronos-small model, checked against “tomorrow = today”.</p>
        </div>
        <Badge variant={helper === 'up' ? 'default' : 'destructive'} data-testid="helper">Kronos helper: {helper}</Badge>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <Button variant="outline" onClick={loadSample} data-testid="load-sample">Load BTC sample</Button>
          <Label className="cursor-pointer text-sm">
            <span className="underline">Upload CSV</span>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </Label>
          <div className="flex min-w-64 items-center gap-3">
            <Label>Horizon: <span data-testid="horizon">{horizon}</span> bars</Label>
            <Slider className="w-40" min={1} max={60} step={1} value={[horizon]} onValueChange={(v) => { setHorizon(v[0]); reset() }} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="bt" checked={backtest} onCheckedChange={(v) => { setBacktest(v); reset() }} data-testid="backtest" />
            <Label htmlFor="bt">Backtest (hide last {horizon})</Label>
          </div>
          <Button onClick={run} disabled={!bars.length || busy} data-testid="run">{busy ? 'Forecasting…' : backtest ? 'Run backtest' : 'Forecast'}</Button>
        </CardContent>
      </Card>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{name || 'No data loaded'} {bars.length > 0 && <span className="font-normal text-muted-foreground">· {bars.length} bars</span>}</CardTitle>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span><span className="mr-1 inline-block size-2 bg-green-600" />real</span>
            {backtest && <span><span className="mr-1 inline-block size-2 bg-neutral-400" />hidden (actual)</span>}
            <span><span className="mr-1 inline-block size-2 border border-violet-600" />Kronos forecast</span>
          </div>
        </CardHeader>
        <CardContent>
          <Chart history={history} hidden={hidden} predicted={pred} />
          {info && <p className="mt-2 text-xs text-muted-foreground" data-testid="info">{info}</p>}
        </CardContent>
      </Card>

      {score && (
        <Card data-testid="score">
          <CardHeader><CardTitle className="text-base">Backtest: MAE on close over last {score.n} bars</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-muted-foreground">Kronos-small</div><div className="text-xl font-semibold" data-testid="mae-kronos">{fmt(score.kronos)}</div></div>
            <div><div className="text-muted-foreground">Naive (tomorrow = today)</div><div className="text-xl font-semibold" data-testid="mae-naive">{fmt(score.naive)}</div></div>
            <div><div className="text-muted-foreground">Winner</div><div className="text-xl font-semibold" data-testid="winner">{score.kronos < score.naive ? 'Kronos' : 'Naive'}</div></div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
