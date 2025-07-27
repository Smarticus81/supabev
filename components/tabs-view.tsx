"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Minus, Users, Search, RefreshCw, LogOut } from "lucide-react"
import { useEffect } from "react"

interface TabsViewProps {
  currentCustomer: string
  orders: any[]
  total: number
}

interface Tab {
  id: string
  partyName: string
  status: "Open" | "Closed"
  items: { name: string; quantity: number; price: number }[]
  createdAt: string
  closedAt?: string
}

export default function TabsView({ currentCustomer, orders, total }: TabsViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("open")
  const [openTabs, setOpenTabs] = useState<Tab[]>([]) // Start with empty tabs
  const [closedTabs, setClosedTabs] = useState<Tab[]>([])
  const [showNewTabForm, setShowNewTabForm] = useState(false)
  const [newTabName, setNewTabName] = useState("")
  const [tabs, setTabs] = useState<Tab[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTabs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data
      setTabs([
        {
          id: `tab-${Date.now()}`,
          partyName: "Table 1",
          status: "Open",
          items: [
            { name: "Stella Artois", quantity: 2, price: 6.00 },
            { name: "House Wine", quantity: 1, price: 8.00 }
          ],
          createdAt: new Date().toISOString(),
        },
        {
          id: `tab-${Date.now() + 1}`,
          partyName: "Bar Tab A",
          status: "Open",
          items: [
            { name: "Hendricks Gin", quantity: 1, price: 12.00 },
            { name: "Corona Extra", quantity: 3, price: 18.00 }
          ],
          createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
        }
      ])
    } catch (err) {
      setError("Failed to load tabs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTabs()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading tabs...</p>
        </div>
      </div>
    )
  }

  // Add function to view tab details
  const viewTabDetails = (tab: Tab) => {
    const itemsList = tab.items.map((item) => `${item.name} (${item.quantity}x) - $${(item.price * item.quantity).toFixed(2)}`).join('\n')
    const total = calculateTabTotal(tab.items)
    
    alert(`Tab Details:\n\nCustomer: ${tab.partyName}\nStatus: ${tab.status}\nItems (${tab.items.length}):\n${itemsList || 'No items'}\n\nTotal: $${total.toFixed(2)}`)
  }

  const currentTabs = activeTab === "open" ? openTabs : closedTabs

  const filteredTabs = currentTabs.filter((tab) => tab.partyName.toLowerCase().includes(searchQuery.toLowerCase()))

  const createNewTab = () => {
    if (newTabName.trim()) {
      const newTab: Tab = {
        id: `tab-${Date.now()}`,
        partyName: newTabName.trim(),
        status: "Open" as const,
        items: [],
        createdAt: new Date().toISOString(),
      }
      setOpenTabs([...openTabs, newTab])
      setNewTabName("")
      setShowNewTabForm(false)
    }
  }

  const updateQuantity = (tabId: string, itemIndex: number, newQuantity: number) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => {
        if (tab.id === tabId) {
          const updatedItems = [...tab.items]
          if (newQuantity <= 0) {
            updatedItems.splice(itemIndex, 1)
          } else {
            updatedItems[itemIndex] = { ...updatedItems[itemIndex], quantity: newQuantity }
          }
          return { ...tab, items: updatedItems }
        }
        return tab
      }),
    )
  }

  const addItemToTab = (tabId: string, item: any) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => {
        if (tab.id === tabId) {
          const existingItemIndex = tab.items.findIndex((i) => i.name === item.name)
          if (existingItemIndex >= 0) {
            const updatedItems = [...tab.items]
            updatedItems[existingItemIndex].quantity += 1
            return { ...tab, items: updatedItems }
          } else {
            return { ...tab, items: [...tab.items, { ...item, quantity: 1 }] }
          }
        }
        return tab
      }),
    )
  }

  const closeTab = (tabId: string) => {
    const tabToClose = openTabs.find((tab) => tab.id === tabId)
    if (tabToClose) {
      setClosedTabs([...closedTabs, { ...tabToClose, status: "Closed", closedAt: new Date().toISOString() }])
      setOpenTabs(openTabs.filter((tab) => tab.id !== tabId))
    }
  }

  const calculateTabTotal = (items: any[]) => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {activeTab === "open" ? "No Open Tabs" : "No Closed Tabs"}
      </h3>
      <p className="text-gray-500 text-center mb-6 max-w-sm">
        {activeTab === "open"
          ? "Create a new customer tab to start taking orders and managing customer sessions."
          : "Closed tabs will appear here once you complete customer orders."}
      </p>
      {activeTab === "open" && (
        <Button onClick={() => setShowNewTabForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Create New Tab
        </Button>
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-semibold text-gray-800">Tabs</h1>
          <Button
            onClick={fetchTabs}
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0 border-gray-200 hover:bg-gray-50 transition-all duration-200"
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          Open: {openTabs.length} • Closed: {closedTabs.length}
        </div>
      </div>

      {/* Header with Tab Toggle */}
      <div className="bg-white p-3 sm:p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Customer Tabs</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search customers..."
                className="pl-10 w-48 sm:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button onClick={() => setShowNewTabForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Tab</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
            <Button
              variant={activeTab === "open" ? "default" : "ghost"}
              className={`flex-1 sm:flex-none px-6 sm:px-8 py-2 text-sm font-medium rounded-md ${
                activeTab === "open" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("open")}
            >
              Open Tabs ({openTabs.length})
            </Button>
            <Button
              variant={activeTab === "closed" ? "default" : "ghost"}
              className={`flex-1 sm:flex-none px-6 sm:px-8 py-2 text-sm font-medium rounded-md ${
                activeTab === "closed" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("closed")}
            >
              Closed Tabs ({closedTabs.length})
            </Button>
          </div>
        </div>
      </div>

      {/* New Tab Form Modal */}
      {showNewTabForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Tab</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer/Party Name</label>
                <Input
                  type="text"
                  placeholder="Enter customer or party name"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && createNewTab()}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewTabForm(false)
                    setNewTabName("")
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createNewTab}
                  disabled={!newTabName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Create Tab
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Content */}
      <div className="flex-1 overflow-auto">
        {filteredTabs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
              {filteredTabs.map((tab) => (
                <Card
                  key={tab.id}
                  className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-3 sm:p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-900">{tab.partyName}</h3>
                      <Badge
                        variant="secondary"
                        className={`text-xs px-2 py-1 ${
                          tab.status === "Open" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {tab.status}
                      </Badge>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3 mb-4 min-h-[120px]">
                      {tab.items.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
                          No items ordered yet
                        </div>
                      ) : (
                        tab.items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex-1 min-w-0">
                              <span className="text-gray-900 truncate block">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-transparent touch-manipulation"
                                onClick={() => updateQuantity(tab.id, index, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-transparent touch-manipulation"
                                onClick={() => updateQuantity(tab.id, index, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <span className="text-gray-900 font-medium ml-2 min-w-[50px] text-right">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Tab Total */}
                    {tab.items.length > 0 && (
                      <div className="border-t pt-3 mb-3">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total:</span>
                          <span>${calculateTabTotal(tab.items).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 text-sm py-2 border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent touch-manipulation"
                        onClick={() => viewTabDetails(tab)}
                      >
                        View Details
                      </Button>
                      {tab.status === "Open" && (
                        <Button
                          onClick={() => closeTab(tab.id)}
                          className="flex-1 text-sm py-2 bg-green-600 hover:bg-green-700 text-white touch-manipulation"
                        >
                          Close Tab
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
