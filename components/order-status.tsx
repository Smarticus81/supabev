"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle } from "lucide-react"

interface OrderStatusProps {
  orders: any[]
  lastAction: {
    type: string
    item?: string
    timestamp: number
    success: boolean
  } | null
}

export default function OrderStatus({ orders, lastAction }: OrderStatusProps) {
  const [showStatus, setShowStatus] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(true)

  useEffect(() => {
    if (!lastAction) return

    // Set status message based on action type
    let message = ""
    switch (lastAction.type) {
      case "add":
        message = `Added ${lastAction.item} to order`
        break
      case "remove":
        message = `Removed ${lastAction.item} from order`
        break
      case "void":
        message = "Order voided"
        break
      default:
        message = "Order updated"
    }

    setStatusMessage(message)
    setIsSuccess(lastAction.success)
    setShowStatus(true)

    // Hide after 3 seconds
    const timer = setTimeout(() => {
      setShowStatus(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [lastAction])

  if (!showStatus) return null

  return (
    <div
      className={`fixed bottom-4 left-4 p-2 rounded-md shadow-lg z-50 text-xs flex items-center gap-2 ${
        isSuccess
          ? "bg-green-50 text-green-800 border border-green-200"
          : "bg-red-50 text-red-800 border border-red-200"
      }`}
    >
      {isSuccess ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-500" />
      )}
      <span>{statusMessage}</span>
    </div>
  )
}
