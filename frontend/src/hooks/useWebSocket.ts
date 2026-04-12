import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AssetMetrics, WSEvent } from '../api/client'

interface WSContextType {
  metrics:   Record<number, AssetMetrics>
  events:    WSEvent[]
  connected: boolean
}

export const WSContext = createContext<WSContextType>({
  metrics: {}, events: [], connected: false,
})

export function useRealtimeMetrics() {
  return useContext(WSContext)
}

export function useWebSocketProvider(): WSContextType {
  const [metrics,   setMetrics]   = useState<Record<number, AssetMetrics>>({})
  const [events,    setEvents]    = useState<WSEvent[]>([])
  const [connected, setConnected] = useState(false)
  const ws        = useRef<WebSocket | null>(null)
  const cancelled = useRef(false)   // unmount 플래그 (재연결 루프 방지)

  useEffect(() => {
    cancelled.current = false
    let retryDelay = 3000  // 지수 백오프 시작값 (ms)

    const connect = () => {
      if (cancelled.current) return

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws/realtime`)
      ws.current = socket

      socket.onopen = () => {
        if (!cancelled.current) {
          setConnected(true)
          retryDelay = 3000  // 연결 성공 시 딜레이 초기화
        }
      }

      socket.onmessage = (e) => {
        if (cancelled.current) return
        const msg = JSON.parse(e.data)

        if (msg.type === 'metrics') {
          const map: Record<number, AssetMetrics> = {}
          for (const m of msg.data as AssetMetrics[]) map[m.asset_id] = m
          setMetrics(map)
        } else if (msg.type === 'event') {
          const event: WSEvent = {
            id:         `${Date.now()}-${Math.random()}`,
            event_type: msg.event_type,
            data:       msg.data,
          }
          setEvents(prev => [event, ...prev].slice(0, 50))
        }
      }

      socket.onclose = () => {
        if (cancelled.current) return  // 언마운트 시 재연결 안 함
        setConnected(false)
        setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30_000)  // 최대 30초까지 지수 증가
      }
    }

    connect()

    return () => {
      cancelled.current = true
      ws.current?.close()
    }
  }, [])

  return { metrics, events, connected }
}
