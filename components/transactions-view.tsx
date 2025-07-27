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
      {/* Compact header optimized for iPad Mini */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-semibold text-gray-800">Transactions</h1>
          <Button
            onClick={fetchTransactions}
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0 border-gray-200 hover:bg-gray-50 transition-all duration-200"
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          Updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {/* Compact time filters */}
      <div className="mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100 h-8">
            {timeFilters.map((filter) => (
              <TabsTrigger key={filter} value={filter} className="px-3 py-1 text-xs capitalize">
                {filter}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Compact stats cards - iPad Mini optimized */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="border border-gray-100">
          <CardContent className="p-3">
            <div className="text-xs text-gray-500 mb-1">Revenue</div>
            <div className="text-sm font-semibold text-gray-900">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100">
          <CardContent className="p-3">
            <div className="text-xs text-gray-500 mb-1">Orders</div>
            <div className="text-sm font-semibold text-gray-900">{stats.totalOrders}</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100">
          <CardContent className="p-3">
            <div className="text-xs text-gray-500 mb-1">Avg Order</div>
            <div className="text-sm font-semibold text-gray-900">{formatCurrency(stats.averageOrder)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Compact transactions table */}
      <Card className="flex-1 border border-gray-100">
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100">
                  <TableHead className="py-2 text-xs">ID</TableHead>
                  <TableHead className="py-2 text-xs">Customer</TableHead>
                  <TableHead className="py-2 text-xs">Items</TableHead>
                  <TableHead className="py-2 text-xs text-right">Total</TableHead>
                  <TableHead className="py-2 text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="border-gray-50 hover:bg-gray-50/50">
                    <TableCell className="py-2 text-xs font-medium">#{transaction.id}</TableCell>
                    <TableCell className="py-2 text-xs">
                      {transaction.customerName || "Walk-in"}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="text-xs font-medium">
                        {(transaction.items?.length || transaction.rawItems?.length || 0)} items
                      </div>
                      {((transaction.items && transaction.items.length) || (transaction.rawItems && transaction.rawItems.length)) ? (
                        <div className="text-xs text-gray-500 truncate max-w-[120px]">
                          {(transaction.items || transaction.rawItems)
                            .slice(0, 2)
                            .map((item: any) => {
                              if (typeof item === 'string') {
                                return item
                              }
                              const name = item.name || item.drink_name || item.item_name || 'Item'
                              return name
                            })
                            .join(', ')}
                          {(transaction.items || transaction.rawItems).length > 2 && '...'}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right font-semibold">
                      {formatCurrency(transaction.total || 0)}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      <div>{formatShortDate(transaction.created_at || transaction.timestamp)}</div>
                      <div className="text-xs text-gray-400">{formatTime(transaction.created_at || transaction.timestamp)}</div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-gray-500">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
