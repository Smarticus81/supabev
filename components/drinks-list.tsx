"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface DrinkItem {
  id: string;
  name: string;
  price: number;
  category: string;
  inventory: number;
}

interface DrinksListProps {
  drinks: DrinkItem[];
  addToOrder: (item: any) => void;
  isLoading: boolean;
}

export default function DrinksList({ drinks, addToOrder, isLoading }: DrinksListProps) {
  const [hoveredDrink, setHoveredDrink] = useState<string | null>(null)

  // Helper function to truncate drink names consistently
  const truncateName = (name: string, maxLength: number = 18): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength).trim() + '...';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {[...Array(12)].map((_, i) => (
          <Card key={i} className="border border-gray-100 bg-white rounded-lg overflow-hidden">
            <CardContent className="p-3 h-20 flex flex-col justify-between">
              <div className="flex-1">
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-2 w-1/2" />
              </div>
              <div className="flex justify-between items-end">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-2 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (drinks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No drinks found</p>
        <p className="text-xs">Try adjusting your search</p>
      </div>
    )
  }

  const getInventoryBadge = (inventory: number) => {
    if (inventory <= 10) return 'destructive';
    if (inventory <= 25) return 'secondary';
    return 'default';
  };

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {drinks.map((drink: DrinkItem) => (
        <Card
          key={drink.id || drink.name}
          className="group relative border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all duration-200 cursor-pointer rounded-lg overflow-hidden"
          onMouseEnter={() => setHoveredDrink(drink.id || drink.name)}
          onMouseLeave={() => setHoveredDrink(null)}
          onClick={() => addToOrder({
            id: drink.id,
            name: drink.name,
            price: drink.price,
            category: drink.category
          })}
        >
          <CardContent className="p-3 h-20 flex flex-col justify-between">
            {/* Drink name - compact */}
            <div className="flex-1 min-h-0">
              <h3 
                className="text-xs font-medium text-gray-900 leading-tight mb-1"
                title={drink.name}
              >
                {truncateName(drink.name)}
              </h3>
              <div className="text-xs text-gray-500">{drink.category}</div>
            </div>
              
            {/* Price and inventory - bottom row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-900">
                ${drink.price.toFixed(2)}
              </span>
              
              {/* Inventory indicator - very compact */}
              {drink.inventory !== undefined && (
                <Badge 
                  variant={getInventoryBadge(drink.inventory)}
                  className="h-4 px-1 text-xs"
                >
                  {drink.inventory}
                </Badge>
              )}
            </div>
          </CardContent>

          {/* Subtle hover effect */}
          {hoveredDrink === (drink.id || drink.name) && (
            <div className="absolute inset-0 bg-blue-50/20 pointer-events-none" />
          )}
        </Card>
      ))}
    </div>
  )
}
