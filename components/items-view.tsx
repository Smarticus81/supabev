"use client"

// @ts-ignore
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, Info } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"


interface ItemsViewProps {
  drinks: any[]
  onAddToOrder: (drink: any) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export default function ItemsView({ drinks, onAddToOrder, searchQuery, onSearchChange }: ItemsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortBy, setSortBy] = useState("name")
  const [filteredDrinks, setFilteredDrinks] = useState([])

  // Filter out signature drinks and classics from inventory (they're made to order)
  const inventoryDrinks = useMemo(() => {
    return drinks.filter((drink) =>
      !['Signature', 'Classics', 'Cocktails', 'Signature Drinks'].includes(drink.category)
    )
  }, [drinks])

  // Get unique categories (excluding Signature and Classics)
  const categories = useMemo(() => {
    return ["All", ...new Set(inventoryDrinks.map((drink) => drink.category))]
  }, [inventoryDrinks])

  // Filter and sort drinks
  useEffect(() => {
    let result = inventoryDrinks

    // Filter by category
    if (selectedCategory !== "All") {
      result = result.filter((drink) => drink.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (drink) =>
          drink.name.toLowerCase().includes(query) ||
          drink.category.toLowerCase().includes(query) ||
          drink.subcategory.toLowerCase().includes(query),
      )
    }

    // Sort drinks
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "price":
          return a.price - b.price
        case "inventory":
          return b.inventory - a.inventory
        case "category":
          return a.category.localeCompare(b.category)
        default:
          return 0
      }
    })

    setFilteredDrinks(result)
  }, [inventoryDrinks, selectedCategory, searchQuery, sortBy])

  const getInventoryStatus = (inventory: number) => {
    if (inventory <= 10) return { status: "critical", color: "bg-red-100 text-red-800", icon: AlertTriangle }
    if (inventory <= 25) return { status: "low", color: "bg-yellow-100 text-yellow-800", icon: Package }
    return { status: "good", color: "bg-green-100 text-green-800", icon: Package }
  }

  const formatPrice = (price: number) => {
    if (typeof price !== 'number' || isNaN(price)) {
      return 'N/A';
    }
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Inventory Management</h2>
          <p className="text-gray-600">Manage your beverage inventory</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search items..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-900">Inventory Note</h3>
            <p className="text-sm text-blue-700 mt-1">
              Signature drinks and cocktails are not included in inventory as they are made-to-order using base spirits
              and mixers.
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{inventoryDrinks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inventoryDrinks.filter((drink) => drink.inventory <= 25).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">$</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(inventoryDrinks.reduce((sum, drink) => sum + drink.price, 0) / inventoryDrinks.length)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">#</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-gray-900">{categories.length - 1}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="bg-gray-100">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="px-4">
                {category}
                <Badge variant="secondary" className="ml-2">
                  {category === "All"
                    ? inventoryDrinks.length
                    : inventoryDrinks.filter((d) => d.category === category).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md bg-white"
        >
          <option value="name">Sort by Name</option>
          <option value="price">Sort by Price</option>
          <option value="inventory">Sort by Stock</option>
          <option value="category">Sort by Category</option>
        </select>
      </div>

      {/* Items List */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inventory Items ({filteredDrinks.length})</span>
            <div className="text-sm text-gray-500">
              Showing {selectedCategory === "All" ? "all categories" : selectedCategory.toLowerCase()}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-500px)]">
            <div className="space-y-2 p-4">
              {filteredDrinks.map((drink) => {
                const inventoryStatus = getInventoryStatus(drink.inventory)
                const StatusIcon = inventoryStatus.icon

                return (
                  <div
                    key={drink.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{drink.name}</h3>
                        <p className="text-sm text-gray-600">{drink.subcategory}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {drink.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {drink.subcategory}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatPrice(drink.price)}</p>
                        <div className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          <span className={`text-xs px-2 py-1 rounded-full ${inventoryStatus.color}`}>
                            {drink.inventory} in stock
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                          onClick={() => onAddToOrder(drink)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
