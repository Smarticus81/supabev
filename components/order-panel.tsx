"use client"

import { useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { VoiceControlButton } from "@/components/voice-control-button"

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

export default function OrderPanel({ 
  orders = [], 
  removeFromOrder, 
  updateQuantity, 
  total = 0, 
  onCompleteOrder 
}: OrderPanelProps) {
  // Add debug logging
  useEffect(() => {
    if (orders && orders.length > 0) {
      console.log("Voice cart synced - items in cart:", orders.length);
    }
  }, [orders])

  // Add a function to safely format prices
  const formatPrice = (price: number): string => {
    if (typeof price !== "number" || isNaN(price)) {
      console.warn(`Invalid price value: ${price}`)
      return "0.00"
    }
    return price.toFixed(2)
  }

  return (
    <Card className="border-[#e2e8f0] h-full flex flex-col">
      <CardHeader className="border-b border-[#e2e8f0] py-2 px-3">
        <h2 className="text-sm font-medium text-black">Current Order</h2>
      </CardHeader>

      <CardContent className="flex-grow p-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[150px] p-3 text-center text-[#718096]">
            <p className="text-xs">No items in order</p>
            <p className="text-[10px] mt-1">Add drinks from the menu</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)] min-h-[150px]">
            <div className="p-2 space-y-2">
              {orders.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2"
                >
                  <div className="flex-grow">
                    <h3 className="font-medium text-black text-xs">{item.name}</h3>
                    <p className="text-[10px] text-[#FFD700]">${formatPrice(item.price)}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-5 w-5 rounded-full border-[#e2e8f0]"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-2 w-2" />
                    </Button>

                    <span className="w-4 text-center text-xs text-black">{item.quantity}</span>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-5 w-5 rounded-full border-[#e2e8f0]"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-2 w-2" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-[#a0aec0] hover:text-red-500"
                      onClick={() => removeFromOrder(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <CardFooter className="flex flex-col border-t border-[#e2e8f0] p-3">
        <div className="flex justify-between w-full mb-2">
          <span className="text-sm text-black">Total</span>
          <span className="font-bold text-sm text-[#FFD700]">
            ${typeof total === "number" && !isNaN(total) ? total.toFixed(2) : "0.00"}
          </span>
        </div>

        {/* Complete Order Button */}
        {orders.length > 0 && (
          <Button 
            onClick={onCompleteOrder}
            className="w-full mb-3 bg-green-600 hover:bg-green-700 text-white"
          >
            Complete Order
          </Button>
        )}

        {/* Voice Control Button - positioned symmetrically above the divider line */}
        <div className="flex justify-center w-full mb-3 relative">
          <div className="absolute top-6 left-0 right-0 h-px bg-[#e2e8f0]"></div>
          <div className="relative z-10 bg-white px-2">
            <VoiceControlButton />
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
