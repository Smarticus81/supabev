"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Receipt, Search, Download, TrendingUp, DollarSign, CreditCard, RefreshCw } from "lucide-react"

export default function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Fetch transactions from API
  const fetchTransactions = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/orders")
      const data = await response.json()
      
      if (Array.isArray(data)) {
        setTransactions(data)
        setLastUpdated(new Date())
      } else {
        console.error("Invalid transactions data:", data)
        setTransactions([])
      }
    } catch (error) {
      console.error("Error fetching transactions:", error)
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }

  // Load transactions on component mount
  useEffect(() => {
    fetchTransactions()
  }, [])

  // Listen for inventory updates (which means orders were processed)
  useEffect(() => {
    const handleInventoryUpdate = () => {
      // Refresh transactions when inventory updates (orders completed)
      fetchTransactions()
    }

    window.addEventListener('inventoryUpdated', handleInventoryUpdate)
    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate)
    }
  }, [])

  // Refresh transactions
  const handleRefresh = () => {
    fetchTransactions()
  }

  const filteredTransactions = transactions.filter((txn: any) => {
    const matchesSearch =
      txn.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || txn.id.includes(searchQuery)
    const matchesFilter = filterStatus === "all" || txn.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const totalRevenue = transactions.filter((txn: any) => txn.status === "completed").reduce((sum, txn) => sum + txn.total, 0)
  const totalTransactions = transactions.length
  const completedTransactions = transactions.filter((txn: any) => txn.status === "completed")
  const avgTransaction = completedTransactions.length > 0 ? totalRevenue / completedTransactions.length : 0

  const statusColors: { [key: string]: string } = {
    "completed": "bg-green-100 text-green-800",
    "pending": "bg-yellow-100 text-yellow-800",
    "refunded": "bg-red-100 text-red-800",
  };

  const getStatusColor = (status: string) => statusColors[status] || "bg-gray-100 text-gray-800";

  const paymentIcons: { [key: string]: JSX.Element } = {
    "credit card": <CreditCard className="h-4 w-4" />,
    "debit card": <CreditCard className="h-4 w-4" />,
  };

  const getPaymentMethodIcon = (method: string) => {
    const lower = method.toLowerCase();
    return paymentIcons[lower] || <DollarSign className="h-4 w-4" />;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Transactions</h2>
          <p className="text-gray-600">View and manage transaction history</p>
          <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search transactions..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Receipt className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{totalTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
                <p className="text-2xl font-bold text-gray-900">${avgTransaction.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Recent Transactions ({filteredTransactions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-600">Loading transactions...</span>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Receipt className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Transactions Found</h3>
                <p className="text-gray-500 text-center mb-4">
                  {transactions.length === 0 
                    ? "No transactions have been recorded yet. Create some orders to see them here."
                    : "No transactions match your search criteria."
                  }
                </p>
                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {filteredTransactions.map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{transaction.id}</h3>
                          <p className="text-sm text-gray-600">{transaction.customerName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg text-gray-900">${transaction.total.toFixed(2)}</p>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(transaction.status)}>{transaction.status}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 mb-1">Items:</p>
                        <ul className="text-gray-900 space-y-1">
                          {transaction.items.map((item: string, index: number) => (
                            <li key={index} className="text-xs">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="text-gray-900">${transaction.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax:</span>
                          <span className="text-gray-900">${transaction.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span>${transaction.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{transaction.timestamp}</span>
                        <span>Server: {transaction.server}</span>
                        <div className="flex items-center gap-1">
                          {getPaymentMethodIcon(transaction.paymentMethod)}
                          <span>{transaction.paymentMethod}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          Print Receipt
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
