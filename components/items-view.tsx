"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, Info, RefreshCw } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"


interface ItemsViewProps {
  onAddToOrder: (drink: any) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onRefresh: () => void
}

export default function ItemsView({ onAddToOrder, searchQuery, onSearchChange, onRefresh }: ItemsViewProps) {
  const [allDrinks, setAllDrinks] = useState<any[]>([]);
  const [filteredDrinks, setFilteredDrinks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Add functions for item management
  const editItem = (item: any) => {
    alert(`Edit functionality for "${item.name}" would open an edit form.\n\nCurrent details:\nPrice: $${item.price?.toFixed(2) || '0.00'}\nInventory: ${item.inventory || 0} units\nCategory: ${item.category || 'Unknown'}`)
  }

  const deleteItem = (item: any) => {
    if (confirm(`Are you sure you want to delete "${item.name}"?\n\nThis action cannot be undone.`)) {
      // In a real app, you would call an API to delete the item
      console.log('Deleting item:', item)
      alert(`"${item.name}" has been deleted from the inventory.`)
      onRefresh() // Refresh the items list
    }
  }

  const fetchDrinks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/drinks");
      if (!response.ok) {
        throw new Error('Failed to fetch drinks');
      }
      const data = await response.json();
      const drinksArray: any[] = Array.isArray(data) ? data : [];
      setAllDrinks(drinksArray);
      setFilteredDrinks(drinksArray);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrinks();
  }, [fetchDrinks]);

  // This replaces the parent-provided `drinks` prop
  const drinks = useMemo(() => {
    let result = allDrinks;

    if (searchQuery) {
      result = result.filter(drink =>
        drink.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (activeTab !== "all") {
      result = result.filter(drink => drink.category === activeTab);
    }
    
    return result;
  }, [allDrinks, searchQuery, activeTab]);

  const [selectedCategory, setSelectedCategory] = useState("All")

  // Update timestamp when drinks data changes
  useEffect(() => {
    setLastUpdated(new Date())
  }, [drinks])

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

  // Enhanced filter and sort
  useEffect(() => {
    let result = inventoryDrinks

    if (selectedCategory !== "All") {
      result = result.filter((drink) => drink.category === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (drink) =>
          drink.name.toLowerCase().includes(query) ||
          drink.category.toLowerCase().includes(query) ||
          drink.subcategory.toLowerCase().includes(query),
      )
    }

    // Enhanced sorting with direction
    result.sort((a, b) => {
      let compare = 0
      switch (sortBy) {
        case "name":
          compare = a.name.localeCompare(b.name)
          break
        case "price":
          compare = a.price - b.price
          break
        case "inventory":
          compare = (a.inventory_oz || 0) - (b.inventory_oz || 0)
          break
        case "category":
          compare = a.category.localeCompare(b.category)
          break
      }
      return sortDirection === "asc" ? compare : -compare
    })

    setFilteredDrinks(result)
  }, [inventoryDrinks, selectedCategory, searchQuery, sortBy, sortDirection])

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortDirection("asc")
    }
  }

  const getInventoryStatus = (inventoryOz: number, unitVolumeOz: number) => {
    const units = Math.floor(inventoryOz / unitVolumeOz)
    if (units <= 5) return { status: "critical", color: "bg-red-500", text: "text-red-700", progress: "bg-red-500" }
    if (units <= 20) return { status: "low", color: "bg-yellow-500", text: "text-yellow-700", progress: "bg-yellow-500" }
    return { status: "good", color: "bg-green-500", text: "text-green-700", progress: "bg-green-500" }
  }

  const getProgressValue = (inventoryOz: number, unitVolumeOz: number) => {
    const units = Math.floor(inventoryOz / unitVolumeOz)
    return Math.min((units / 100) * 100, 100) // Assume 100 units as full, cap at 100%
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
          <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
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

      {/* Category Filters */}
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
      </div>

      {/* Items Table */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inventory Items ({filteredDrinks.length})</span>
            <Button variant="ghost" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px] cursor-pointer" onClick={() => handleSort("name")}>
                    Name {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("category")}>
                    Category {sortBy === "category" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Subcategory</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("price")}>
                    Price {sortBy === "price" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="cursor-pointer text-center" onClick={() => handleSort("popularity_score")}>
                    Popularity {sortBy === "popularity_score" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="w-[300px] cursor-pointer" onClick={() => handleSort("inventory")}>
                    Stock Level {sortBy === "inventory" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrinks.map((drink) => {
                  const inventoryOz = drink.inventory_oz || 0
                  const unitVolumeOz = drink.unit_volume_oz || 12
                  const units = Math.floor(inventoryOz / unitVolumeOz)
                  const status = getInventoryStatus(inventoryOz, unitVolumeOz)
                  const progressValue = getProgressValue(inventoryOz, unitVolumeOz)

                  return (
                    <TableRow key={drink.id || drink.name}>
                      <TableCell className="font-medium">{drink.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{drink.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{drink.subcategory || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(drink.price)}</TableCell>
                      <TableCell className="text-right">
                        {drink.cost_per_unit ? formatPrice(drink.cost_per_unit) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {drink.profit_margin ? (
                          <span className={drink.profit_margin > 0.5 ? 'text-green-600 font-medium' : drink.profit_margin > 0.3 ? 'text-yellow-600' : 'text-red-600'}>
                            {(drink.profit_margin * 100).toFixed(1)}%
                          </span>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={drink.popularity_score > 75 ? 'default' : drink.popularity_score > 50 ? 'secondary' : 'outline'}>
                          {drink.popularity_score || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${status.text}`}>
                              {units} units ({inventoryOz.toFixed(1)} oz)
                            </span>
                            <Badge className={status.color}>{status.status}</Badge>
                          </div>
                          <Progress value={progressValue} className="h-2" indicatorClassName={status.progress} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAddToOrder(drink)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => editItem(drink)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-red-600"
                            onClick={() => deleteItem(drink)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
