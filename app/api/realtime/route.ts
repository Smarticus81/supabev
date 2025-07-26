import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// Event manager maintains open SSE connections
class EventManager {
  private static instance: EventManager
  private connections: Map<string, WritableStreamDefaultWriter> = new Map()
  private history: string[] = []

  static getInstance() {
    if (!EventManager.instance) EventManager.instance = new EventManager()
    return EventManager.instance
  }

  addConnection(id: string, writer: WritableStreamDefaultWriter) {
    this.connections.set(id, writer)
    // Send last 10 messages to new client
    this.history.slice(-10).forEach(msg => writer.write(new TextEncoder().encode(msg)))
  }

  removeConnection(id: string) {
    this.connections.delete(id)
  }

  broadcast(type: string, payload: any) {
    const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
    this.history.push(msg)
    if (this.history.length > 100) this.history = this.history.slice(-100)
    const encoded = new TextEncoder().encode(msg)
    this.connections.forEach((writer, id) => {
      writer.write(encoded).catch(() => this.connections.delete(id))
    })
  }
}

export async function GET(req: NextRequest) {
  const eventManager = EventManager.getInstance()
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  eventManager.addConnection(id, writer)

  // Initial hello
  writer.write(new TextEncoder().encode(`event: connected\ndata: {"id":"${id}"}\n\n`))

  // keep-alive ping every 25s
  const pingInterval = setInterval(() => {
    writer.write(new TextEncoder().encode('event: ping\ndata: {}\n\n')).catch(() => {})
  }, 25000)

  // Handle client close
  req.signal.addEventListener('abort', () => {
    clearInterval(pingInterval)
    eventManager.removeConnection(id)
    writer.close()
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

export const eventManager = EventManager.getInstance() 