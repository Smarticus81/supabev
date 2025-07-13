"use client"

import { useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function OrderPanel({ orders, removeFromOrder, updateQuantity, total, onCompleteOrder }) {
  // Add debug logging
  useEffect(() => {
    console.log("OrderPanel received orders:", orders)
    console.log("Orders length:", orders?.length)
    console.log("Orders type:", typeof orders, Array.isArray(orders))

    if (orders && orders.length > 0) {
      console.log("First order item:", orders[0])
    }

    // Validate order data
    const invalidItems = orders.filter(
      (item) =>
        !item.id ||
        !item.name ||
        typeof item.price !== "number" ||
        isNaN(item.price) ||
        typeof item.quantity !== "number" ||
        isNaN(item.quantity),
    )

    if (invalidItems.length > 0) {
      console.warn("OrderPanel received invalid items:", invalidItems)
    }
  }, [orders])

  // Add a function to safely format prices
  const formatPrice = (price) => {
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
                  className="flex items-center justify-between p-2 bg-[#f8fafc] rounded-md border border-[#e2e8f0]"
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

        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            className="flex-1 border-red-300 hover:bg-red-50 text-red-500"
            disabled={orders.length === 0}
            onClick={() => {
              if (window.confirm("Are you sure you want to void this order?")) {
                removeFromOrder("all")
              }
            }}
          >
            Void Order
          </Button>
          <Button 
            className="flex-1 bg-black hover:bg-gray-800 text-[#FFD700]" 
            disabled={orders.length === 0}
            onClick={onCompleteOrder}
          >
            Complete Order
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
