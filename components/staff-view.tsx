'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, DollarSign, Package, Users, Clock, BarChart3, PieChart, Calendar, LogOut } from 'lucide-react'

interface Analytics {
  revenue: {
    today: number
    week: number
    month: number
    growth: number
  }
  orders: {
    today: number
    week: number
    month: number
    avgOrderValue: number
  }
  inventory: {
    totalItems: number
    lowStock: number
    outOfStock: number
    topSelling: Array<{name: string, sold: number}>
  }
  performance: {
    peakHours: Array<{hour: string, orders: number}>
    popularCategories: Array<{category: string, percentage: number}>
    customerFlow: Array<{day: string, customers: number}>
  }
}

export function StaffView() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchAnalytics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/analytics?range=30d')
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      // Fallback to mock data on error
      setAnalytics({
        revenue: {
          today: 0,
          week: 0,
          month: 0,
          growth: 0
        },
        orders: {
          today: 0,
          week: 0,
          month: 0,
          avgOrderValue: 0
        },
        inventory: {
          totalItems: 0,
          lowStock: 0,
          outOfStock: 0,
          topSelling: []
        },
        performance: {
          peakHours: [],
          popularCategories: [],
          customerFlow: []
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('beverage_pos_auth')
    window.location.href = '/landing'
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <Button
            onClick={fetchAnalytics}
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 border-gray-200 hover:bg-gray-50 transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 border-red-200 text-red-600 hover:bg-red-50 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>

      {/* Content */}
      <div className="h-full overflow-y-auto scrollbar-hide pb-24">
        <div className="space-y-6">
          {/* Revenue Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">Today</p>
                    <p className="text-2xl font-bold text-green-800">{formatCurrency(analytics?.revenue.today || 0)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">This Week</p>
                    <p className="text-2xl font-bold text-blue-800">{formatCurrency(analytics?.revenue.week || 0)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Orders Today</p>
                    <p className="text-2xl font-bold text-purple-800">{analytics?.orders.today}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700">Avg Order</p>
                    <p className="text-2xl font-bold text-orange-800">{formatCurrency(analytics?.orders.avgOrderValue || 0)}</p>
                  </div>
                  <Users className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Hours Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span>Peak Hours</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.performance.peakHours.map((hour, index) => (
                    <div key={hour.hour} className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-600 w-12">{hour.hour}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${(hour.orders / 35) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-800 w-8 text-right">{hour.orders}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Customer Flow */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  <span>Weekly Flow</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between h-32 space-x-2">
                  {analytics?.performance.customerFlow.map((day, index) => (
                    <div key={day.day} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-1000 ease-out"
                        style={{ height: `${(day.customers / 150) * 100}%` }}
                      />
                      <span className="text-xs font-medium text-gray-600 mt-2">{day.day}</span>
                      <span className="text-xs font-bold text-gray-800">{day.customers}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Items */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Package className="h-5 w-5 text-gray-600" />
                  <span>Top Sellers</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.inventory.topSelling.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold">
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-800">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-100 rounded-full h-2">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                            style={{ width: `${(item.sold / 100) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-800 w-8 text-right">{item.sold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <PieChart className="h-5 w-5 text-gray-600" />
                  <span>Category Mix</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.performance.popularCategories.map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">{category.category}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-100 rounded-full h-2">
                          <div 
                            className={`h-full rounded-full ${
                              index === 0 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                              index === 1 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                              index === 2 ? 'bg-gradient-to-r from-purple-400 to-purple-600' :
                              'bg-gradient-to-r from-gray-400 to-gray-600'
                            }`}
                            style={{ width: `${category.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-800 w-10 text-right">{category.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Growth Metrics */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-50 to-gray-100">
            <CardHeader>
              <CardTitle className="text-lg">Growth Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">+{analytics?.revenue.growth}%</p>
                  <p className="text-sm text-gray-600">Revenue Growth</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{analytics?.inventory.totalItems}</p>
                  <p className="text-sm text-gray-600">Total Items</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">{analytics?.inventory.lowStock}</p>
                  <p className="text-sm text-gray-600">Low Stock</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">{analytics?.inventory.outOfStock}</p>
                  <p className="text-sm text-gray-600">Out of Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Subtle Logo */}
      <div className="absolute bottom-4 right-4 opacity-10">
        <svg className="w-8 h-8" viewBox="0 0 100 100" fill="currentColor">
          <circle cx="50" cy="30" r="8" className="text-orange-500"/>
          <path d="M35 45 Q50 35 65 45 L65 70 Q50 80 35 70 Z" className="text-orange-500"/>
          <circle cx="50" cy="60" r="3" fill="white"/>
        </svg>
      </div>
    </div>
  )
} 