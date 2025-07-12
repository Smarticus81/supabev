"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Receipt, Search, Download, TrendingUp, DollarSign, CreditCard } from "lucide-react"

export default function TransactionsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  // Sample transactions data
  const transactions = [
    {
      id: "TXN-001",
      customerName: "Andrew Wagner",
      items: ["Rosé glass x5", "Chateau d'esclans glass x9", "Manhattan x1"],
      total: 264.13,
      tax: 20.13,
      subtotal: 244.0,
      paymentMethod: "Credit Card",
      status: "completed",
      timestamp: "2024-01-15 14:30:22",
      server: "John D.",
    },
    {
      id: "TXN-002",
      customerName: "Sarah Johnson",
      items: ["Mojito x2", "Bud Light x3"],
      total: 89.5,
      tax: 6.85,
      subtotal: 82.65,
      paymentMethod: "Cash",
      status: "completed",
      timestamp: "2024-01-15 13:45:18",
      server: "Maria S.",
    },
    {
      id: "TXN-003",
      customerName: "Mike Chen",
      items: ["Old Fashioned x2", "Whiskey x1", "Gin & Tonic x2"],
      total: 156.75,
      tax: 11.98,
      subtotal: 144.77,
      paymentMethod: "Credit Card",
      status: "completed",
      timestamp: "2024-01-15 12:20:45",
      server: "John D.",
    },
    {
      id: "TXN-004",
      customerName: "Emily Davis",
      items: ["Wine Glass x2"],
      total: 45.0,
      tax: 3.44,
      subtotal: 41.56,
      paymentMethod: "Debit Card",
      status: "pending",
      timestamp: "2024-01-15 11:15:30",
      server: "Lisa K.",
    },
    {
      id: "TXN-005",
      customerName: "John Smith",
      items: ["Martini x3", "Champagne x1", "Cocktail Mix x4"],
      total: 312.25,
      tax: 23.85,
      subtotal: 288.4,
      paymentMethod: "Credit Card",
      status: "refunded",
      timestamp: "2024-01-15 10:30:15",
      server: "Maria S.",
    },
  ]

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      txn.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || txn.id.includes(searchQuery)
    const matchesFilter = filterStatus === "all" || txn.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const totalRevenue = transactions.filter((txn) => txn.status === "completed").reduce((sum, txn) => sum + txn.total, 0)
  const totalTransactions = transactions.length
  const avgTransaction = totalRevenue / transactions.filter((txn) => txn.status === "completed").length

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "refunded":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case "credit card":
      case "debit card":
        return <CreditCard className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Transactions</h2>
          <p className="text-gray-600">View and manage transaction history</p>
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
            <div className="space-y-3 p-4">
              {filteredTransactions.map((transaction) => (
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
                        {transaction.items.map((item, index) => (
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
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
