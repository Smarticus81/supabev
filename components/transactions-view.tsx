"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Search, 
  Calendar, 
  DollarSign, 
  ShoppingCart, 
  TrendingUp,
  Eye,
  Printer,
  Download,
  RefreshCw,
  LogOut
} from "lucide-react"

export default function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Add functions for transaction actions
  const viewTransactionDetails = (transaction: any) => {
    alert(`Transaction Details:\n\nID: ${transaction.id}\nCustomer: ${transaction.customer_name || 'Walk-in Customer'}\nItems: ${transaction.items?.length || 0}\nTotal: $${transaction.total?.toFixed(2) || '0.00'}\nDate: ${new Date(transaction.created_at).toLocaleString()}`)
  }

  const printReceipt = (transaction: any) => {
    // Create a simple receipt format
    const receiptContent = `
      RECEIPT
      ================
      Transaction ID: ${transaction.id}
      Customer: ${transaction.customer_name || 'Walk-in Customer'}
      Date: ${new Date(transaction.created_at).toLocaleString()}
      
      ITEMS:
      ${transaction.items?.map((item: any) => `${item.name} - $${item.price?.toFixed(2) || '0.00'}`).join('\n') || 'No items'}
      
      TOTAL: $${transaction.total?.toFixed(2) || '0.00'}
      ================
    `
    
    // In a real app, you would send this to a printer
    console.log('Printing receipt:', receiptContent)
    alert('Receipt sent to printer!\n\n' + receiptContent)
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  // Update timestamp when transactions data changes
  useEffect(() => {
    setLastUpdated(new Date())
  }, [transactions])

  const fetchTransactions = async () => {
    try {
      const response = await fetch("/api/orders")
      const data = await response.json()
      console.log("Raw API response:", data)
      
      const ordersArray = Array.isArray(data) ? data : (data.orders || [])
      console.log("Orders array:", ordersArray)
      
      setTransactions(ordersArray)
    } catch (error) {
      console.error("Error fetching transactions:", error)
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    let result = transactions

    if (searchQuery) {
      result = result.filter(transaction =>
        transaction.id?.toString().includes(searchQuery) ||
        transaction.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.items?.some((item: any) => 
          item.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    }

    if (activeTab !== "all") {
      const now = new Date()
      switch (activeTab) {
        case "today":
          result = result.filter(transaction => {
            const transactionDate = new Date(transaction.created_at)
            return transactionDate.toDateString() === now.toDateString()
          })
          break
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          result = result.filter(transaction => {
            const transactionDate = new Date(transaction.created_at)
            return transactionDate >= weekAgo
          })
          break
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          result = result.filter(transaction => {
            const transactionDate = new Date(transaction.created_at)
            return transactionDate >= monthAgo
          })
          break
      }
    }

    // Enhanced sorting with direction
    result.sort((a, b) => {
      let compare = 0
      switch (sortBy) {
        case "date":
          compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case "total":
          compare = (a.total || 0) - (b.total || 0)
          break
        case "customer":
          compare = (a.customer_name || "").localeCompare(b.customer_name || "")
          break
        case "items":
          compare = (a.items?.length || 0) - (b.items?.length || 0)
          break
      }
      return sortDirection === "asc" ? compare : -compare
    })

    return result
  }, [transactions, searchQuery, activeTab, sortBy, sortDirection])

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortDirection("asc")
    }
  }

  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + (t.total || 0), 0)
    const avgOrder = filteredTransactions.length > 0 ? total / filteredTransactions.length : 0
    const totalOrders = filteredTransactions.length

    return {
      totalRevenue: total,
      averageOrder: avgOrder,
      totalOrders: totalOrders
    }
  }, [filteredTransactions])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const timeFilters = ["all", "today", "week", "month"]

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading transactions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
          <Button
            onClick={fetchTransactions}
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 border-gray-200 hover:bg-gray-50 transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={() => {
            localStorage.removeItem('beverage_pos_auth')
            window.location.href = '/landing'
          }}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 border-red-200 text-red-600 hover:bg-red-50 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>

      {/* Simple Time Filters */}
      <div className="mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100">
            {timeFilters.map((filter) => (
              <TabsTrigger key={filter} value={filter} className="px-4 capitalize">
                {filter}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Transactions Table */}
      <Card className="flex-1">
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.id}</TableCell>
                    <TableCell>
                      {transaction.customerName || "Walk-in Customer"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {(transaction.items?.length || transaction.rawItems?.length || 0)} items
                      </div>
                      {((transaction.items && transaction.items.length) || (transaction.rawItems && transaction.rawItems.length)) ? (
                        <div className="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                          {(transaction.items || transaction.rawItems)
                            .map((item: any) => {
                              if (typeof item === 'string') {
                                return item
                              }
                              const name = item.name || item.drink_name || item.item_name || 'Item'
                              const qty = item.quantity || item.qty || 1
                              return `${name} x${qty}`
                            })
                            .join(', ')}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.total || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {transaction.paymentMethod || 'Cash'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatShortDate(transaction.created_at || transaction.timestamp)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
