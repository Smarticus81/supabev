"use client"

import { Button } from "@/components/ui/button"
import { Minus, Plus, X, RefreshCw } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"
import { VoiceControlButton } from "./voice-control-button"

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface OrderPanelProps {
  orders: OrderItem[]
  removeFromOrder: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  total: number
  onCompleteOrder: () => void
}

export default function OrderPanel({ orders, removeFromOrder, updateQuantity, total, onCompleteOrder }: OrderPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Trigger a cart refresh by dispatching an event to sync with latest data
      window.dispatchEvent(new CustomEvent('force-cart-refresh'))
      
      // Visual feedback for refresh
      setTimeout(() => {
        setIsRefreshing(false)
      }, 500)
    } catch (error) {
      console.error('Refresh failed:', error)
      setIsRefreshing(false)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Minimal header with refresh */}
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Order</h2>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Empty state - ultra minimal */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center opacity-40">
            <div className="w-8 h-8 mx-auto mb-2 opacity-30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-full h-full">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="m1 1 4 4 13 1 1 6h-13l-2-8"></path>
              </svg>
            </div>
            <p className="text-xs text-gray-400">Empty</p>
          </div>
        </div>

        {/* Voice Control Button - Always visible at bottom */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
          <div className="relative bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl opacity-5"></div>
            <div className="relative z-10">
              <VoiceControlButton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Ultra-minimal header - optimized for iPad Mini */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Order ({orders.length})</h2>
        <Button
          onClick={handleRefresh}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Compact order items - iPad Mini optimized */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-2 py-3">
          {orders.map((order, index) => (
            <div
              key={order.id || index}
              className="group bg-white border border-gray-100 rounded-lg p-2 hover:border-gray-200 transition-colors"
            >
              {/* Item name and price - single line, small text */}
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-medium text-gray-900 truncate leading-tight">
                    {order.name}
                  </h4>
                  <p className="text-xs text-gray-500 leading-tight">
                    ${order.price.toFixed(2)}
                  </p>
                </div>
                
                {/* Remove button - appears on hover */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-150 ml-2 flex-shrink-0"
                  onClick={() => removeFromOrder(order.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Quantity controls and subtotal - compact layout */}
              <div className="flex items-center justify-between">
                {/* Compact quantity controls */}
                <div className="flex items-center bg-gray-50 rounded border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 border-0"
                    onClick={() => updateQuantity(order.id, order.quantity - 1)}
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </Button>
                  
                  <span className="w-8 text-center text-xs font-medium text-gray-900">
                    {order.quantity}
                  </span>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 border-0"
                    onClick={() => updateQuantity(order.id, order.quantity + 1)}
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </Button>
                </div>

                {/* Item subtotal */}
                <span className="text-xs font-semibold text-gray-900">
                  ${(order.price * order.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Minimal checkout section - iPad Mini optimized */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/50">
        {/* Total */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Total</span>
          <span className="text-lg font-semibold text-gray-900">${total.toFixed(2)}</span>
        </div>
        
        {/* Compact checkout button */}
        <Button
          onClick={onCompleteOrder}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white h-10 text-sm font-medium rounded-lg mb-3"
          disabled={orders.length === 0}
        >
          Complete Order
        </Button>
        
        {/* Voice Control Button - Beautifully integrated at bottom */}
        <div className="relative bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl opacity-5"></div>
          <div className="relative z-10">
            <VoiceControlButton />
          </div>
        </div>
      </div>
    </div>
  )
}