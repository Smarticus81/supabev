"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, Info, RefreshCw, LogOut } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
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
  const { toast } = useToast()

  // Add functions for item management
  const editItem = (item: any) => {
    alert(`Edit functionality for "${item.name}" would open an edit form.\n\nCurrent details:\nPrice: $${item.price?.toFixed(2) || '0.00'}\nInventory: ${item.inventory || 0} units\nCategory: ${item.category || 'Unknown'}`)
  }

  const deleteItem = (item: any) => {
    if (confirm(`Are you sure you want to delete "${item.name}"?\n\nThis action cannot be undone.`)) {
      // In a real app, you would call an API to delete the item
      console.log('Deleting item:', item)
      alert(`"${item.name}" has been deleted from the inventory.`)
      fetchDrinks() // Refresh the items list using internal function
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
      setLastUpdated(new Date()); // Update timestamp on successful refresh
      
      // Show success toast
      toast({
        title: "Inventory Refreshed",
        description: `Successfully loaded ${drinksArray.length} items`,
        duration: 2000,
      });
    } catch (error: any) {
      setError(error.message);
      console.error('Error fetching drinks:', error);
      
      // Show error toast
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh inventory data",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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
          compare = (a.inventory || 0) - (b.inventory || 0)
          break
        case "servings":
          compare = calculateTotalUnits(a) - calculateTotalUnits(b)
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

  const formatPrice = (price: number) => {
    if (typeof price !== 'number' || isNaN(price)) {
      return 'N/A';
    }
    return `$${price.toFixed(2)}`;
  };

  const formatInventoryDisplay = (drink: any) => {
    const inventory = drink.inventory || 0;
    const unitType = drink.unit_type || 'ounce';
    const category = drink.category || '';
    
    // Show number of actual containers based on category
    if (category === 'Wine') {
      return `${inventory} bottles`;
    } else if (category === 'Spirits') {
      return `${inventory} bottles`;
    } else if (category === 'Beer') {
      return `${inventory} bottles/cans`;
    } else if (category === 'Non-alcoholic') {
      return `${inventory} bottles/cans`;
    }
    
    // Map unit types to display labels for other categories
    const unitLabels = {
      'bottle': 'bottles',
      'glass': 'glasses', 
      'shot': 'shots',
      'ounce': 'oz',
      'can': 'cans',
      'pint': 'pints'
    };

    const unitLabel = unitLabels[unitType as keyof typeof unitLabels] || unitType;
    
    // For bottles, glasses, shots - show whole numbers
    if (['bottle', 'glass', 'shot', 'can', 'pint'].includes(unitType)) {
      return `${inventory} ${unitLabel}`;
    }
    
    // For ounces - show with decimal
    return `${inventory.toFixed(1)} ${unitLabel}`;
  };

  const getInventoryStatus = (drink: any) => {
    const inventory = drink.inventory || 0;
    const unitType = drink.unit_type || 'ounce';
    
    // Different thresholds based on unit type
    let criticalThreshold = 5;
    let lowThreshold = 20;
    
    if (unitType === 'bottle' || unitType === 'can') {
      criticalThreshold = 3;
      lowThreshold = 10;
    } else if (unitType === 'glass') {
      criticalThreshold = 10;
      lowThreshold = 30;
    } else if (unitType === 'shot') {
      criticalThreshold = 10;
      lowThreshold = 25;
    }
    
    if (inventory <= criticalThreshold) {
      return { status: "critical", color: "bg-red-500", text: "text-red-700", progress: "bg-red-500" };
    }
    if (inventory <= lowThreshold) {
      return { status: "low", color: "bg-yellow-500", text: "text-yellow-700", progress: "bg-yellow-500" };
    }
    return { status: "good", color: "bg-green-500", text: "text-green-700", progress: "bg-green-500" };
  };

  const getProgressValue = (drink: any) => {
    const inventory = drink.inventory || 0;
    const unitType = drink.unit_type || 'ounce';
    
    // Different max values for progress calculation based on unit type
    let maxValue = 100;
    
    if (unitType === 'bottle' || unitType === 'can') {
      maxValue = 50; // Assume 50 bottles as full stock
    } else if (unitType === 'glass') {
      maxValue = 100; // Wine glasses
    } else if (unitType === 'shot') {
      maxValue = 100; // Shots
    }
    
    return Math.min((inventory / maxValue) * 100, 100);
  };
  
  const calculateTotalUnits = (drink: any) => {
    const inventory = drink.inventory || 0;
    const unitType = drink.unit_type || 'ounce';
    const category = drink.category || '';
    const servingsPerContainer = drink.servings_per_container || 0;
    
    // For spirits (like Woodford Reserve), calculate total shots from bottles
    if (category === 'Spirits') {
      // If we have servings_per_container data, use it
      if (servingsPerContainer > 0) {
        return inventory * servingsPerContainer;
      }
      // Otherwise use a default (average shots per bottle)
      return inventory * 17; // Standard 750ml bottle has about 17 1.5oz shots
    }
    
    // For wine, calculate total glasses from bottles
    if (category === 'Wine') {
      // If we have servings_per_container data, use it
      if (servingsPerContainer > 0) {
        return inventory * servingsPerContainer;
      }
      // Otherwise use a default (average glasses per bottle)
      return inventory * 5; // Standard 750ml bottle has about 5 5oz glasses
    }
    
    // For other categories, return the same inventory amount
    return inventory;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
          <Button
            onClick={fetchDrinks}
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

      {/* Simple Category Tabs */}
      <div className="mb-6">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="bg-gray-100">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="px-4">
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
 
      {/* Items Table */}
      <Card className="flex-1">
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredDrinks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      {searchQuery ? `No items found matching "${searchQuery}"` : 'No items found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrinks.map((drink) => {
                    const status = getInventoryStatus(drink);

                    return (
                      <TableRow key={drink.id || drink.name}>
                        <TableCell className="font-medium">{drink.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{drink.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(drink.price)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <span className={`text-sm font-medium ${status.text}`}>
                              {drink.inventory || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onAddToOrder(drink)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
