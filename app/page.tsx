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

export default function Home() {
  console.log('🔧 [VERSION] Home component loaded - v2.0 - WebSocket only')
  const router = useRouter()
  
  // All hooks must be called unconditionally at the top level
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedView, setSelectedView] = useState("items")
  const [orders, setOrders] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  
  // Debounce timer for cart updates to prevent excessive rerenders
  const cartUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [drinks, setDrinks] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [drinksLoading, setDrinksLoading] = useState(false)
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Navigation array for bottom navigation
  const navigation = [
    { name: "Items", icon: Box, view: "items" },
    { name: "Menu", icon: Menu, view: "menu" },
    { name: "Staff", icon: Users, view: "staff" },
    { name: "Tabs", icon: Package, view: "tabs" },
    { name: "Events", icon: Calendar, view: "events" },
    { name: "Transactions", icon: BarChart3, view: "transactions" },
    { name: "Settings", icon: Settings, view: "settings" },
  ]

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
      setSelectedView('items')
      console.log('🔧 [AUTH] Setting selectedView to items')
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

  // Premium WebSocket connection
  useEffect(() => {
    if (!isAuthenticated) return

    console.log('🔌 [PREMIUM-WS] Initializing premium WebSocket connection...')
    
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.hostname}:8081`
        
        const ws = new WebSocket(wsUrl)
        setWsConnection(ws)
        
        ws.onopen = () => {
          console.log('🔌 [PREMIUM-WS] Connection established')
          setWsConnected(true)
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleWebSocketMessage(message)
          } catch (error) {
            console.error('🔌 [PREMIUM-WS] Message parse error:', error)
          }
        }

        ws.onclose = () => {
          console.log('🔌 [PREMIUM-WS] Connection closed')
          setWsConnected(false)
          setWsConnection(null)
          
          // Reconnect after delay
          setTimeout(() => {
            if (isAuthenticated) {
              console.log('🔌 [PREMIUM-WS] Attempting reconnection...')
              connectWebSocket()
            }
          }, 3000)
        }

        ws.onerror = (error) => {
          console.error('🔌 [PREMIUM-WS] Connection error:', error)
          setWsConnected(false)
        }
      } catch (error) {
        console.error('🔌 [PREMIUM-WS] Connection failed:', error)
      }
    }

    connectWebSocket()

    return () => {
      if (wsConnection) {
        wsConnection.close()
      }
    }
  }, [isAuthenticated])

  // Listen for cart update events from voice control
  useEffect(() => {
    const handleCartUpdateRequested = (event: CustomEvent) => {
      console.log('🔌 [PREMIUM-WS] Cart update requested via custom event:', event.detail)
      updateCartFromData(event.detail, 'voice-control')
    }

    // Also expose the updateCartFromData function globally for direct access
    ;(window as any).updateCartFromData = updateCartFromData

    window.addEventListener('cartUpdateRequested', handleCartUpdateRequested as EventListener)

    return () => {
      window.removeEventListener('cartUpdateRequested', handleCartUpdateRequested as EventListener)
      delete (window as any).updateCartFromData
    }
  }, [])

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    console.log('🔌 [PREMIUM-WS] Received message:', message)
    
    switch (message.type) {
      case 'cart_update':
        updateCartFromData(message.payload, 'websocket')
        break
      case 'order_update':
        if (message.payload.type === 'order_completed') {
          setOrders([])
          console.log('✅ Order completed, cart cleared via WebSocket')
        }
        break
      case 'heartbeat':
        console.log('🔌 [PREMIUM-WS] Heartbeat received:', message.payload)
        break
      case 'connection':
        console.log('🔌 [PREMIUM-WS] Connection confirmed:', message.payload)
        break
      default:
        console.log('🔌 [PREMIUM-WS] Unknown message type:', message.type)
    }
  }

  // Update cart from data with debouncing to prevent excessive rerenders
  const updateCartFromData = (data: any, source: string) => {
    console.log(`🔌 [PREMIUM-WS] Updating cart from ${source}:`, data)
    
    // Clear any pending update
    if (cartUpdateTimeoutRef.current) {
      clearTimeout(cartUpdateTimeoutRef.current)
    }
    
    // Debounce the actual update
    cartUpdateTimeoutRef.current = setTimeout(() => {
      if (data && Array.isArray(data.items)) {
        const newOrders = data.items.map((item: any, index: number) => ({
          ...item,
          id: index.toString()
        }))
        
        // Only update if the cart has actually changed
        const hasChanged = JSON.stringify(orders) !== JSON.stringify(newOrders)
        if (hasChanged) {
          setOrders(newOrders)
          console.log(`🔌 [PREMIUM-WS] Cart updated with ${data.items.length} items from ${source}`)
        } else {
          console.log(`🔌 [PREMIUM-WS] No cart changes detected from ${source}, skipping update`)
          return // Early return to prevent WebSocket broadcast
        }
      
        // Also send update via WebSocket if connected
        if (wsConnection && wsConnected) {
          wsConnection.send(JSON.stringify({
            type: 'cart_update',
            payload: {
              items: newOrders,
              total: data.total || 0,
              clientId: 'default',
              source: source
            }
          }))
          console.log(`🔌 [PREMIUM-WS] Cart update sent via WebSocket`)
        }
      } else if (data && Array.isArray(data)) {
        const newOrders = data.map((item: any, index: number) => ({
          ...item,
          id: index.toString()
        }))
        const hasChanged = JSON.stringify(orders) !== JSON.stringify(newOrders)
        if (hasChanged) {
          setOrders(newOrders)
          console.log(`🔌 [PREMIUM-WS] Cart updated with ${data.length} items from ${source}`)
        }
      }
    }, 50) // 50ms debounce delay
  }

  // Calculate total
  const total = useMemo(() => {
    return orders.reduce((sum, order) => sum + (order.price * order.quantity), 0)
  }, [orders])

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center ios-height-fix no-bounce safe-area-all">
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
    console.log('⚡ [PREMIUM] Added', drink.name, 'to cart')

    // Send update via WebSocket
    if (wsConnection && wsConnected) {
      wsConnection.send(JSON.stringify({
        type: 'cart_add',
        payload: {
          drink_name: drink.name,
          quantity: 1,
          clientId: 'default'
        }
      }))
    }

    // Also update via API for persistence
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
    }).catch(error => {
      console.error('❌ [PREMIUM] API update failed:', error)
    })
  }

  const removeFromOrder = (id: string) => {
    const orderItem = orders[parseInt(id)]
    if (orderItem) {
      const newOrders = orders.filter((_, index) => index !== parseInt(id))
      setOrders(newOrders)
      console.log('⚡ [PREMIUM] Removed', orderItem.name, 'from cart')

      // Send update via WebSocket
      if (wsConnection && wsConnected) {
        wsConnection.send(JSON.stringify({
          type: 'cart_remove',
          payload: {
            drink_name: orderItem.name,
            clientId: 'default'
          }
        }))
      }

      // Also update via API for persistence
      fetch('/api/voice-cart-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cart_remove',
          parameters: {
            drink_name: orderItem.name,
            clientId: 'default'
          }
        })
      }).catch(error => {
        console.error('❌ [PREMIUM] API update failed:', error)
      })
    }
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity === 0) {
      removeFromOrder(id)
    } else {
      const orderItem = orders[parseInt(id)]
      if (orderItem) {
        const newOrders = [...orders]
        const oldQuantity = newOrders[parseInt(id)].quantity
        newOrders[parseInt(id)].quantity = quantity
        setOrders(newOrders)
        console.log('⚡ [PREMIUM] Updated', orderItem.name, 'quantity to', quantity)

        const quantityDiff = quantity - oldQuantity
        if (quantityDiff !== 0) {
          // Send update via WebSocket
          if (wsConnection && wsConnected) {
            wsConnection.send(JSON.stringify({
              type: quantityDiff > 0 ? 'cart_add' : 'cart_remove',
              payload: {
                drink_name: orderItem.name,
                quantity: Math.abs(quantityDiff),
                clientId: 'default'
              }
            }))
          }

          // Also update via API for persistence
          fetch('/api/voice-cart-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool: quantityDiff > 0 ? 'cart_add' : 'cart_remove',
              parameters: {
                drink_name: orderItem.name,
                quantity: Math.abs(quantityDiff),
                clientId: 'default'
              }
            })
          }).catch(error => {
            console.error('❌ [PREMIUM] API update failed:', error)
          })
        }
      }
    }
  }

  const completeOrder = async () => {
    if (orders.length === 0) return

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orders,
          payment_method: 'Credit Card'
        })
      })

      if (response.ok) {
        setOrders([])
        console.log('✅ [PREMIUM] Order completed successfully')

        // Send order completion via WebSocket
        if (wsConnection && wsConnected) {
          wsConnection.send(JSON.stringify({
            type: 'order_completed',
            payload: {
              items: orders,
              total: total
            }
          }))
        }
      } else {
        console.error('❌ [PREMIUM] Order completion failed')
      }
    } catch (error) {
      console.error('❌ [PREMIUM] Order completion error:', error)
    }
  }

  const renderView = () => {
    console.log('🔧 [RENDER] Current selectedView:', selectedView)
    switch (selectedView) {
      case "items":
        return (
          <ItemsView
            onAddToOrder={addToOrder}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={fetchDrinks}
          />
        )
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
      case "menu":
        return (
          <CategoryGrid
            categories={categories}
            drinks={drinks}
            searchQuery={searchQuery}
            onAddToOrder={addToOrder}
            isLoading={drinksLoading}
          />
        )
      default:
        return (
          <ItemsView
            onAddToOrder={addToOrder}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={fetchDrinks}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col ios-height-fix no-bounce safe-area-all">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-3">
                <svg width="70" height="12" viewBox="0 0 70 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9.71591 0.33965C9.71591 0.33965 11.7913 0.825162 12.1411 2.68747C12.6261 5.27007 11.171 5.97442 11.171 5.97442C11.171 5.97442 12.8686 7.14834 12.1411 9.26138C11.5086 11.0981 9.71591 11.6092 9.71591 11.6092H1.95513C1.53158 11.6092 1.22941 11.4817 0.929907 11.1918C0.630406 10.9019 0.499999 10.6105 0.5 10.2005V1.74834C0.500005 1.33831 0.630407 1.04698 0.929907 0.757041C1.22941 0.467105 1.53158 0.339657 1.95513 0.33965C4.86275 0.339626 9.707 0.33965 9.71591 0.33965ZM3.29439 7.2266V8.68746H9.31308V7.2266H3.29439ZM3.29439 4.51356H9.31308V3.05269H3.29439V4.51356Z" fill="#17223B"/>
                  <path d="M50.0452 4.38262C50.0452 3.29516 49.5806 2.41515 48.7422 1.76394C48.2495 1.38117 47.7508 1.35653 45.9611 1.35654C45.0857 1.35654 44.5663 1.35771 44.1428 1.41646C43.7558 1.47014 43.4463 1.57325 43.0216 1.80002C42.1833 2.38031 41.8048 3.02065 41.6206 3.77304C41.424 4.57632 41.447 5.49857 41.447 6.67827V11.4783C41.447 11.7664 41.2064 12 40.9097 12C40.6129 12 40.3723 11.7664 40.3723 11.4783V6.67827C40.3723 5.56235 40.3416 4.4848 40.5748 3.53174C40.8188 2.53513 41.3483 1.66755 42.4273 0.929978L42.4509 0.914081L42.4758 0.900426C43.0061 0.614382 43.4446 0.459341 43.9908 0.383579C44.5077 0.311884 45.1168 0.313068 45.9611 0.313063C47.6105 0.313053 48.5628 0.288329 49.4135 0.949135C50.4966 1.79043 51.1199 2.9657 51.1199 4.38262C51.1199 5.77571 50.5164 7.02097 49.3388 7.65612C48.5569 8.07787 47.8243 8.34783 46.4984 8.34783H43.1667C42.8699 8.34783 42.6293 8.11424 42.6293 7.82609C42.6293 7.53795 42.8699 7.30436 43.1667 7.30436H46.4984C47.6175 7.30436 48.1722 7.09168 48.817 6.74389C49.5739 6.33558 50.0452 5.49393 50.0452 4.38262Z" fill="#17223B"/>
                  <path d="M52.5724 11.4157V4.28314C52.5724 2.77143 54.0191 0.250475 57.1939 0.250475C57.4907 0.250475 57.7313 0.484065 57.7313 0.772213C57.7313 1.06036 57.4907 1.29395 57.1939 1.29395C54.7139 1.29395 53.6472 3.24427 53.6472 4.28314V11.4157L53.6445 11.4691C53.6169 11.7321 53.388 11.9374 53.1098 11.9374C52.813 11.9374 52.5724 11.7038 52.5724 11.4157Z" fill="#17223B"/>
                  <path d="M36.1143 1.19914C36.5076 0.493956 37.4301 0.20334 38.1749 0.550022C38.9197 0.896749 39.2046 1.74957 38.8113 2.45477L34.0691 10.9583C33.7834 11.4707 33.2183 11.764 32.6449 11.7531C32.0715 11.7639 31.5065 11.4706 31.2208 10.9583L26.4786 2.45477C26.0853 1.74957 26.3703 0.896749 27.1151 0.550022C27.8598 0.203324 28.7823 0.493952 29.1756 1.19914L32.6449 7.42026L36.1143 1.19914Z" fill="#17223B"/>
                  <path d="M68.4252 5.94782C68.4252 3.23922 66.1636 1.04348 63.3738 1.04348C60.584 1.04348 58.3224 3.23922 58.3224 5.94782C58.3224 8.65641 60.584 10.8522 63.3738 10.8522V11.8956C59.9904 11.8956 57.2477 9.2327 57.2477 5.94782C57.2477 2.66293 59.9904 0 63.3738 0C66.7572 0 69.5 2.66293 69.5 5.94782C69.5 9.2327 66.7572 11.8956 63.3738 11.8956V10.8522C66.1636 10.8522 68.4252 8.65641 68.4252 5.94782Z" fill="#17223B"/>
                  <path d="M23.0806 8.76521C23.9058 8.76522 24.5748 9.41471 24.5748 10.2159V10.2988C24.5747 11.0542 23.9439 11.6666 23.1658 11.6666C18.3336 11.6666 16.4628 11.8238 15.3624 11.2638C14.4692 10.8093 14.0421 9.70399 14.0421 8.76521H14.0475V7.51304H14.0421V4.59131H14.0475V3.33913H14.0421C14.0421 2.40033 14.4692 1.29483 15.3624 0.840292C16.4628 0.280373 18.3336 0.437778 23.1658 0.437779C23.9439 0.437779 24.5747 1.05007 24.5748 1.80551V1.88846C24.5747 2.68961 23.9058 3.33912 23.0806 3.33913H17.0569V4.59131H22.6402C23.4712 4.59131 24.1449 5.24536 24.1449 6.05217C24.1448 6.85897 23.4712 7.51304 22.6402 7.51304H17.0569V8.76521H23.0806Z" fill="#17223B"/>
                </svg>
                <div className="h-6 w-px bg-gray-300"></div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs text-gray-500">
                    {wsConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search items..."
                  className="pl-10 w-48 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Main Content */}
        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>
        
        {/* Right Panel - Order Panel */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <OrderPanel
            orders={orders}
            removeFromOrder={removeFromOrder}
            updateQuantity={updateQuantity}
            total={total}
            onCompleteOrder={completeOrder}
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t border-gray-200 safe-area-bottom">
        <nav className="flex justify-around">
          {navigation.map((item) => {
            const IconComponent = item.icon
            return (
              <button
                key={item.name}
                onClick={() => setSelectedView(item.view)}
                className={`flex flex-col items-center py-2 px-3 min-w-0 flex-1 touch-target ${
                  selectedView === item.view
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <IconComponent className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium truncate">{item.name}</span>
              </button>
            )
          })}
        </nav>
      </div>


    </div>
  )
}