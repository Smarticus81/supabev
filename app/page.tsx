"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Menu, 
  Box, 
  Users, 
  Package, 
  Calendar, 
  BarChart3, 
  Settings,
  Search
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"

import CategoryGrid from "@/components/category-grid"
import DrinksList from "@/components/drinks-list"
import OrderPanel from "@/components/order-panel"
import ItemsView from "@/components/items-view"
import { StaffView } from "@/components/staff-view"
import TabsView from "@/components/tabs-view"
import EventsView from "@/components/events-view"
import TransactionsView from "@/components/transactions-view"
import { SettingsView } from "@/components/settings-view"
import { VoiceControlButton } from "@/components/voice-control-button"

// Real-time event manager
class RealTimeManager {
  private static instance: RealTimeManager
  private eventSource: EventSource | null = null
  private subscribers: Map<string, Set<(data: any) => void>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  static getInstance(): RealTimeManager {
    if (!RealTimeManager.instance) {
      RealTimeManager.instance = new RealTimeManager()
    }
    return RealTimeManager.instance
  }

  connect() {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return
    }

    try {
      this.eventSource = new EventSource('/api/realtime')
      
      this.eventSource.onopen = () => {
        console.log('🔗 Real-time connection established')
        this.reconnectAttempts = 0
      }

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.notifySubscribers(data.type, data.payload)
        } catch (error) {
          console.error('Failed to parse real-time message:', error)
        }
      }

      this.eventSource.onerror = () => {
        console.error('Real-time connection error')
        this.reconnect()
      }
    } catch (error) {
      console.error('Failed to establish real-time connection:', error)
      this.reconnect()
    }
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      this.connect()
    }, delay)
  }

  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set())
    }
    this.subscribers.get(eventType)!.add(callback)
  }

  unsubscribe(eventType: string, callback: (data: any) => void) {
    this.subscribers.get(eventType)?.delete(callback)
  }

  private notifySubscribers(eventType: string, data: any) {
    this.subscribers.get(eventType)?.forEach(callback => callback(data))
  }

  disconnect() {
    this.eventSource?.close()
    this.eventSource = null
  }
}

export default function Home() {
  const router = useRouter()
  
  // All hooks must be called unconditionally at the top level
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedView, setSelectedView] = useState("items")
  const [orders, setOrders] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [drinks, setDrinks] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [drinksLoading, setDrinksLoading] = useState(false)
  const realTimeManager = useRef<RealTimeManager>()

  // Enhanced real-time connection with multiple fallback mechanisms
  const [optimisticCart, setOptimisticCart] = useState<any[]>([])
  const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false)
  const pollingInterval = useRef<NodeJS.Timeout>()
  const lastSyncTime = useRef<number>(0)

  // Fetch drinks data
  const fetchDrinks = async () => {
    setDrinksLoading(true)
    try {
      const response = await fetch('/api/drinks')
      if (response.ok) {
        const data = await response.json()
        setDrinks(Array.isArray(data) ? data : [])
        
        // Extract categories
        const uniqueCategories = [...new Set(data.map((drink: any) => drink.category))]
        setCategories(uniqueCategories.map(cat => ({
          name: cat,
          count: data.filter((d: any) => d.category === cat).length,
          color: "bg-blue-200",
          textColor: "text-blue-800"
        })))
      }
    } catch (error) {
      console.error('Error fetching drinks:', error)
      setDrinks([])
      setCategories([])
    } finally {
      setDrinksLoading(false)
    }
  }

  // Authentication check
  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem('beverage_pos_auth')
      if (!authToken) {
        router.push('/landing')
        return
      }
      setIsAuthenticated(true)
      setSelectedView('dashboard') // Default to dashboard after auth
      fetchDrinks()
      setIsLoading(false)
    }
    
    checkAuth()
  }, [router])

  // Fetch drinks when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDrinks()
    }
  }, [isAuthenticated])

  // Enhanced real-time connection with multiple fallback mechanisms
  useEffect(() => {
    if (!isAuthenticated) return

    console.log('🚀 [HYBRID] Initializing enhanced real-time system...')
    
    // Method 1: Enhanced SSE Connection
    let eventSource: EventSource | null = null
    
    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/realtime')
        
        eventSource.onopen = () => {
          console.log('📡 [SSE] Enhanced real-time connection established')
        }

        eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleRealTimeMessage(message)
          } catch (error) {
            console.error('📡 [SSE] Message parse error:', error)
          }
        }

        eventSource.onerror = () => {
          console.warn('📡 [SSE] Connection error, will retry...')
        }
      } catch (error) {
        console.error('📡 [SSE] Connection failed:', error)
      }
    }

    // Method 2: Custom Event Listeners (for immediate local updates)
    const handleCartUpdate = (event: any) => {
      console.log('🚨 [DEBUG-MAIN] Cart update event received!')
      console.log('🎯 [EVENT] Direct cart update received:', event.detail)
      console.log('🎯 [EVENT] Current orders before update:', orders.length, 'items')
      console.log('🎯 [EVENT] Is optimistic update active:', isOptimisticUpdate)
      console.log('🚨 [DEBUG-MAIN] Event detail structure:', JSON.stringify(event.detail, null, 2))
      
      // Handle both old and new event formats
      const data = event.detail.payload || event.detail
      console.log('🚨 [DEBUG-MAIN] Processed data for updateCartFromData:', data)
      updateCartFromData(data, 'event')
    }

    const handleOrderUpdate = (event: any) => {
      console.log('📦 [EVENT] Direct order update received:', event.detail)
      if (event.detail.type === 'order_completed') {
        setOrders([])
        setOptimisticCart([])
        console.log('✅ Order completed, cart cleared via event')
      }
    }

    // Method 3: Polling Fallback
    const startPolling = () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current)
      
      pollingInterval.current = setInterval(async () => {
        try {
          // Only poll if we haven't received updates recently
          if (Date.now() - lastSyncTime.current > 5000) {
            console.log('🔄 [POLL] Checking for cart updates...')
            await syncCartFromAPI()
          }
        } catch (error) {
          console.error('🔄 [POLL] Error:', error)
        }
      }, 3000) // Poll every 3 seconds as fallback
    }

    // Method 4: WebSocket Connection (if available)
    let websocket: WebSocket | null = null
    const connectWebSocket = () => {
      try {
        // Try to connect to WebSocket if available
        const wsUrl = `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/api/ws`
        websocket = new WebSocket(wsUrl)
        
        websocket.onopen = () => {
          console.log('🔌 [WS] WebSocket connected')
        }

        websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleRealTimeMessage(message)
          } catch (error) {
            console.error('🔌 [WS] Message parse error:', error)
          }
        }

        websocket.onerror = () => {
          console.warn('🔌 [WS] Connection failed, falling back to SSE')
        }
      } catch (error) {
        console.warn('🔌 [WS] WebSocket not available, using SSE')
      }
    }

    // Initialize all connection methods
    connectSSE()
    connectWebSocket()
    startPolling()

    // Add event listeners
    console.log('🚨 [DEBUG-MAIN] Adding event listeners for cart updates...')
    window.addEventListener('realtime-cart_update', handleCartUpdate)
    window.addEventListener('realtime-order_update', handleOrderUpdate)
    
    // Handle force refresh events from UI components
    const handleForceRefresh = async () => {
      console.log('� [FORCE-REFRESH] Manual cart refresh requested')
      await syncCartFromAPI()
    }
    window.addEventListener('force-cart-refresh', handleForceRefresh)
    console.log('�🚨 [DEBUG-MAIN] Event listeners added successfully')

    return () => {
      // Cleanup all connections
      if (eventSource) {
        eventSource.close()
      }
      if (websocket) {
        websocket.close()
      }
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
      }
      window.removeEventListener('realtime-cart_update', handleCartUpdate)
      window.removeEventListener('realtime-order_update', handleOrderUpdate)
      window.removeEventListener('force-cart-refresh', handleForceRefresh)
    }
  }, [isAuthenticated])

  // Handle real-time messages from any source
  const handleRealTimeMessage = (message: any) => {
    lastSyncTime.current = Date.now()
    
    switch (message.type) {
      case 'cart_update':
        updateCartFromData(message.payload, 'realtime')
        break
      case 'order_update':
        if (message.payload.type === 'order_completed') {
          setOrders([])
          setOptimisticCart([])
          console.log('✅ Order completed, cart cleared via realtime')
        }
        break
      case 'connection':
        console.log('📡 [REALTIME] Connected:', message.payload.message)
        break
      case 'heartbeat':
        // Update last sync time on heartbeat
        lastSyncTime.current = Date.now()
        break
    }
  }

  // Update cart from data with source tracking - prevent duplicates
  const updateCartFromData = (data: any, source: string) => {
    console.log(`🛒 [${source.toUpperCase()}] Updating cart:`, data)
    
    try {
      if (data && Array.isArray(data.items)) {
        setOrders(data.items)
        setOptimisticCart(data.items)
        setIsOptimisticUpdate(false)
        console.log(`✅ [${source.toUpperCase()}] Cart updated with ${data.items.length} items`)
      } else if (data && data.items) {
        const items = Array.isArray(data.items) ? data.items : []
        setOrders(items)
        setOptimisticCart(items)
        setIsOptimisticUpdate(false)
        console.log(`✅ [${source.toUpperCase()}] Cart updated with ${items.length} items`)
      } else {
        // Handle empty cart case
        setOrders([])
        setOptimisticCart([])
        setIsOptimisticUpdate(false)
        console.log(`✅ [${source.toUpperCase()}] Cart cleared`)
      }
    } catch (error) {
      console.error(`❌ [${source.toUpperCase()}] Cart update error:`, error)
    }
  }

  // Sync cart from API (fallback method)
  const syncCartFromAPI = async () => {
    try {
      const response = await fetch('/api/voice-cart-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cart_view',
          parameters: { clientId: 'default' }
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.cart) {
          setOrders(result.cart)
          setOptimisticCart(result.cart)
          setIsOptimisticUpdate(false)
          console.log(`🔄 [SYNC] Cart synchronized: ${result.cart.length} items`)
        }
      }
    } catch (error) {
      console.error('🔄 [SYNC] API sync failed:', error)
    }
  }

  // Ensure default view is 'items' only on initial load (handled by initialState)

  // Calculate total - always called
  const total = useMemo(() => {
    return orders.reduce((sum, order) => sum + (order.price * order.quantity), 0)
  }, [orders])

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to landing if not authenticated
  if (!isAuthenticated) {
    return null
  }

  const addToOrder = (drink: any) => {
    // Voice commands use real-time updates, manual clicks use optimistic updates
    const isVoiceCommand = false // Manual click from UI
    
    if (isVoiceCommand) {
      // For voice commands, rely on real-time updates only
      console.log('🎙️ [VOICE] Adding via voice command, waiting for real-time update')
      return
    }
    
    // Optimistic Update for manual UI interactions only
    setIsOptimisticUpdate(true)
    const newItem = {
      name: drink.name,
      quantity: 1,
      price: drink.price || 7.00,
      category: 'Beverage'
    }
    
    const existingIndex = orders.findIndex(item => item.name === drink.name)
    let newOrders
    
    if (existingIndex >= 0) {
      newOrders = [...orders]
      newOrders[existingIndex].quantity += 1
    } else {
      newOrders = [...orders, newItem]
    }
    
    setOrders(newOrders)
    setOptimisticCart(newOrders)
    console.log('⚡ [OPTIMISTIC] Added', drink.name, 'to cart immediately')

    // Add to cart via direct real-time API (not MCP server)
    fetch('/api/voice-cart-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'cart_add',
        parameters: {
          drink_name: drink.name,
          quantity: 1,
          clientId: 'default'
        }
      })
    }).then(response => response.json())
    .then(result => {
      if (!result.success) {
        // Revert optimistic update on failure
        console.warn('❌ [OPTIMISTIC] Reverting add operation')
        setOrders(optimisticCart)
        setIsOptimisticUpdate(false)
      }
    }).catch(error => {
      console.error('❌ [OPTIMISTIC] Add failed, reverting:', error)
      setOrders(optimisticCart)
      setIsOptimisticUpdate(false)
    })
  }

  const removeFromOrder = (id: string) => {
    const orderItem = orders[parseInt(id)];
    if (orderItem) {
      // Optimistic Update: Immediately update UI
      setIsOptimisticUpdate(true)
      const newOrders = orders.filter((_, index) => index !== parseInt(id))
      setOrders(newOrders)
      setOptimisticCart(newOrders)
      console.log('⚡ [OPTIMISTIC] Removed', orderItem.name, 'from cart immediately')

      // Remove from cart via direct real-time API
      fetch('/api/voice-cart-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cart_remove',
          parameters: {
            drink_name: orderItem.name,
            quantity: orderItem.quantity,
            clientId: 'default'
          }
        })
      }).then(response => response.json())
      .then(result => {
        if (!result.success) {
          // Revert optimistic update on failure
          console.warn('❌ [OPTIMISTIC] Reverting remove operation')
          setOrders(optimisticCart)
          setIsOptimisticUpdate(false)
        }
      }).catch(error => {
        console.error('❌ [OPTIMISTIC] Remove failed, reverting:', error)
        setOrders(optimisticCart)
        setIsOptimisticUpdate(false)
      })
    }
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity === 0) {
      removeFromOrder(id)
    } else {
      const orderItem = orders[parseInt(id)];
      if (orderItem) {
        // Optimistic Update: Immediately update UI
        setIsOptimisticUpdate(true)
        const newOrders = [...orders]
        const oldQuantity = newOrders[parseInt(id)].quantity
        newOrders[parseInt(id)].quantity = quantity
        setOrders(newOrders)
        setOptimisticCart(newOrders)
        console.log('⚡ [OPTIMISTIC] Updated', orderItem.name, 'quantity to', quantity)

        const quantityDiff = quantity - oldQuantity;
        if (quantityDiff > 0) {
          // Add more
          fetch('/api/voice-cart-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool: 'cart_add',
              parameters: {
                drink_name: orderItem.name,
                quantity: quantityDiff,
                clientId: 'default'
              }
            })
          }).catch(error => {
            console.error('❌ [OPTIMISTIC] Quantity update failed, reverting:', error)
            setOrders(optimisticCart)
            setIsOptimisticUpdate(false)
          })
        } else if (quantityDiff < 0) {
          // Remove some
          fetch('/api/voice-cart-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool: 'cart_remove',
              parameters: {
                drink_name: orderItem.name,
                quantity: Math.abs(quantityDiff),
                clientId: 'default'
              }
            })
          }).catch(error => {
            console.error('❌ [OPTIMISTIC] Quantity update failed, reverting:', error)
            setOrders(optimisticCart)
            setIsOptimisticUpdate(false)
          })
        }
      }
    }
  }

  const completeOrder = async () => {
    if (orders.length === 0) return

    // Optimistic Update: Clear cart immediately
    setIsOptimisticUpdate(true)
    const currentOrders = [...orders]
    setOrders([])
    setOptimisticCart([])
    console.log('⚡ [OPTIMISTIC] Order completed, cart cleared immediately')

    // Complete order via direct real-time API
    fetch('/api/voice-cart-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'cart_create_order',
        parameters: {
          clientId: 'default'
        }
      })
    }).then(response => response.json())
    .then(result => {
      if (result.success) {
        alert('Order completed successfully!')
        setIsOptimisticUpdate(false)
      } else {
        // Revert optimistic update on failure
        console.warn('❌ [OPTIMISTIC] Reverting order completion')
        setOrders(currentOrders)
        setOptimisticCart(currentOrders)
        setIsOptimisticUpdate(false)
        alert('Order failed. Please try again.')
      }
    }).catch(error => {
      console.error('❌ [OPTIMISTIC] Order completion failed, reverting:', error)
      setOrders(currentOrders)
      setOptimisticCart(currentOrders)
      setIsOptimisticUpdate(false)
      alert('Order failed. Please try again.')
    })
  }

  const navigation = [
    { id: "menu", icon: Menu, label: "Menu" },
    { id: "items", icon: Box, label: "Items" },
    { id: "staff", icon: Users, label: "Dashboard" },
    { id: "tabs", icon: Package, label: "Tabs" },
    { id: "events", icon: Calendar, label: "Events" },
    { id: "transactions", icon: BarChart3, label: "Transactions" },
    { id: "settings", icon: Settings, label: "Settings" }
  ]

  const renderView = () => {
    console.log('Current selectedView:', selectedView)
    switch (selectedView) {
      case "menu":
        console.log('Rendering menu view with drinks:', drinks.length, 'categories:', categories.length)
        return (
          <div className="h-full flex gap-6">
            <div className="flex-1">
              <CategoryGrid 
                categories={categories}
                drinks={drinks}
                searchQuery={searchQuery}
                onAddToOrder={addToOrder}
                isLoading={drinksLoading}
              />
            </div>
            {/* Subtle separator line between menu and cart */}
            <div className="w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent flex-shrink-0"></div>
            <div className="w-64 h-full flex flex-col">
              <OrderPanel 
                orders={orders}
                removeFromOrder={removeFromOrder}
                updateQuantity={updateQuantity}
                onCompleteOrder={completeOrder}
                total={total}
              />
            </div>
          </div>
        )
      case "items":
        return <ItemsView 
          onAddToOrder={addToOrder}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={() => window.location.reload()}
        />
      case "staff":
        return <StaffView />
      case "tabs":
        return <TabsView 
          currentCustomer="Walk-in Customer"
          orders={orders}
          total={total}
        />
      case "events":
        return <EventsView />
      case "transactions":
        return <TransactionsView />
      case "settings":
        return <SettingsView />
      default:
        return <ItemsView 
          onAddToOrder={addToOrder}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={() => window.location.reload()}
        />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col ios-height-fix no-bounce safe-area-all">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 ipad:px-6 py-3 flex-shrink-0 nav-ipad">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <svg width="70" height="12" viewBox="0 0 70 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-auto crisp-edges">
              <path fillRule="evenodd" clipRule="evenodd" d="M9.71591 0.33965C9.71591 0.33965 11.7913 0.825162 12.1411 2.68747C12.6261 5.27007 11.171 5.97442 11.171 5.97442C11.171 5.97442 12.8686 7.14834 12.1411 9.26138C11.5086 11.0981 9.71591 11.6092 9.71591 11.6092H1.95513C1.53158 11.6092 1.22941 11.4817 0.929907 11.1918C0.630406 10.9019 0.499999 10.6105 0.5 10.2005V1.74834C0.500005 1.33831 0.630407 1.04698 0.929907 0.757041C1.22941 0.467105 1.53158 0.339657 1.95513 0.33965C4.86275 0.339626 9.707 0.33965 9.71591 0.33965ZM3.29439 7.2266V8.68746H9.31308V7.2266H3.29439ZM3.29439 4.51356H9.31308V3.05269H3.29439V4.51356Z" fill="#17223B"/>
              <path d="M50.0452 4.38262C50.0452 3.29516 49.5806 2.41515 48.7422 1.76394C48.2495 1.38117 47.7508 1.35653 45.9611 1.35654C45.0857 1.35654 44.5663 1.35771 44.1428 1.41646C43.7558 1.47014 43.4463 1.57325 43.0216 1.80002C42.1833 2.38031 41.8048 3.02065 41.6206 3.77304C41.424 4.57632 41.447 5.49857 41.447 6.67827V11.4783C41.447 11.7664 41.2064 12 40.9097 12C40.6129 12 40.3723 11.7664 40.3723 11.4783V6.67827C40.3723 5.56235 40.3416 4.4848 40.5748 3.53174C40.8188 2.53513 41.3483 1.66755 42.4273 0.929978L42.4509 0.914081L42.4758 0.900426C43.0061 0.614382 43.4446 0.459341 43.9908 0.383579C44.5077 0.311884 45.1168 0.313068 45.9611 0.313063C47.6105 0.313053 48.5628 0.288329 49.4135 0.949135C50.4966 1.79043 51.1199 2.9657 51.1199 4.38262C51.1199 5.77571 50.5164 7.02097 49.3388 7.65612C48.5569 8.07787 47.8243 8.34783 46.4984 8.34783H43.1667C42.8699 8.34783 42.6293 8.11424 42.6293 7.82609C42.6293 7.53795 42.8699 7.30436 43.1667 7.30436H46.4984C47.6175 7.30436 48.1722 7.09168 48.817 6.74389C49.5739 6.33558 50.0452 5.49393 50.0452 4.38262Z" fill="#17223B"/>
              <path d="M52.5724 11.4157V4.28314C52.5724 2.77143 54.0191 0.250475 57.1939 0.250475C57.4907 0.250475 57.7313 0.484065 57.7313 0.772213C57.7313 1.06036 57.4907 1.29395 57.1939 1.29395C54.7139 1.29395 53.6472 3.24427 53.6472 4.28314V11.4157L53.6445 11.4691C53.6169 11.7321 53.388 11.9374 53.1098 11.9374C52.813 11.9374 52.5724 11.7038 52.5724 11.4157Z" fill="#17223B"/>
              <path d="M36.1143 1.19914C36.5076 0.493956 37.4301 0.20334 38.1749 0.550022C38.9197 0.896749 39.2046 1.74957 38.8113 2.45477L34.0691 10.9583C33.7834 11.4707 33.2183 11.764 32.6449 11.7531C32.0715 11.7639 31.5065 11.4706 31.2208 10.9583L26.4786 2.45477C26.0853 1.74957 26.3703 0.896749 27.1151 0.550022C27.8598 0.203324 28.7823 0.493952 29.1756 1.19914L32.6449 7.42026L36.1143 1.19914Z" fill="#17223B"/>
              <path d="M68.4252 5.94782C68.4252 3.23922 66.1636 1.04348 63.3738 1.04348C60.584 1.04348 58.3224 3.23922 58.3224 5.94782C58.3224 8.65641 60.584 10.8522 63.3738 10.8522V11.8956C59.9904 11.8956 57.2477 9.2327 57.2477 5.94782C57.2477 2.66293 59.9904 0 63.3738 0C66.7572 0 69.5 2.66293 69.5 5.94782C69.5 9.2327 66.7572 11.8956 63.3738 11.8956V10.8522C66.1636 10.8522 68.4252 8.65641 68.4252 5.94782Z" fill="#17223B"/>
              <path d="M23.0806 8.76521C23.9058 8.76522 24.5748 9.41471 24.5748 10.2159V10.2988C24.5747 11.0542 23.9439 11.6666 23.1658 11.6666C18.3336 11.6666 16.4628 11.8238 15.3624 11.2638C14.4692 10.8093 14.0421 9.70399 14.0421 8.76521H14.0475V7.51304H14.0421V4.59131H14.0475V3.33913H14.0421C14.0421 2.40033 14.4692 1.29483 15.3624 0.840292C16.4628 0.280373 18.3336 0.437778 23.1658 0.437779C23.9439 0.437779 24.5747 1.05007 24.5748 1.80551V1.88846C24.5747 2.68961 23.9058 3.33912 23.0806 3.33913H17.0569V4.59131H22.6402C23.4712 4.59131 24.1449 5.24536 24.1449 6.05217C24.1448 6.85897 23.4712 7.51304 22.6402 7.51304H17.0569V8.76521H23.0806Z" fill="#17223B"/>
            </svg>
            <div>
              <p className="text-xs text-gray-500 font-medium">Knotting Hill Place</p>
            </div>
          </div>

          {/* Search and Voice Control */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search"
                className="pl-10 w-48 ipad:w-64 bg-gray-50/50 border-0 rounded-lg no-zoom touch-target"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Cart indicator */}
            {orders.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg touch-button no-select">
                <Package className="h-4 w-4" />
                <span className="text-sm font-medium">{orders.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 ipad:p-6 pb-20 ipad:pb-24">
        {renderView()}
      </div>

      {/* Voice Control Button - Fixed Position with High Z-Index */}
      <div className="voice-button-ipad z-[9999]">
        <VoiceControlButton />
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 ipad:px-6 py-3 z-50 safe-area-bottom">
        <div className="flex justify-center">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {navigation.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => {
                  console.log('Clicking tab:', id)
                  setSelectedView(id)
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 touch-button no-select min-h-touch min-w-touch ${
                  selectedView === id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium text-ipad">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}