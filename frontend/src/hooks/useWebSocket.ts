import { useEffect, useRef, useState } from 'react'
import { AssetMetrics } from '../api/client'

export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<Record<number, AssetMetrics>>({})
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws.current = new WebSocket(`${protocol}://${window.location.host}/ws/realtime`)

      ws.current.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'metrics') {
          const map: Record<number, AssetMetrics> = {}
          for (const m of msg.data as AssetMetrics[]) {
            map[m.asset_id] = m
          }
          setMetrics(map)
        }
      }

      ws.current.onclose = () => {
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => ws.current?.close()
  }, [])

  return metrics
}
