"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function DrinksList({ drinks, addToOrder, isLoading }) {
  const [hoveredDrink, setHoveredDrink] = useState(null)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </Card>
        ))}
      </div>
    )
  }

  if (drinks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No drinks found</p>
        <p className="text-sm">Try adjusting your search or category selection</p>
      </div>
    )
  }

  const getInventoryColor = (inventory) => {
    if (inventory <= 10) return 'text-red-600';
    if (inventory <= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {drinks.map((drink) => (
        <Card
          key={drink.id || drink.name}
          className="relative overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
          onMouseEnter={() => setHoveredDrink(drink.id || drink.name)}
          onMouseLeave={() => setHoveredDrink(null)}
        >
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{drink.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{drink.subcategory}</p>
                <p className="font-bold text-lg text-gray-900">
                  ${drink.serving_options && drink.serving_options[0] ? drink.serving_options[0].price.toFixed(2) : 'N/A'}
                </p>
                <p className={`text-xs font-medium ${getInventoryColor(drink.inventory)}`}>Stock: {drink.inventory}</p>
              </div>
              <Button
                size="icon"
                className={`rounded-full h-8 w-8 bg-blue-500 hover:bg-blue-600 transition-opacity duration-200 ${
                  hoveredDrink === (drink.id || drink.name) ? "opacity-100" : "opacity-0"
                }`}
                onClick={() => addToOrder(drink)}
              >
                <Plus className="h-4 w-4 text-white" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
