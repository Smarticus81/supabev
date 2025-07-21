"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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
  const truncateName = (name: string, maxLength: number = 20): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength).trim() + '...';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="border-0 bg-white/80 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-6 h-32 flex flex-col justify-between">
              <div className="flex-1">
                <Skeleton className="h-10 w-3/4 mb-1" />
                <div className="w-8 h-px bg-gray-200"></div>
              </div>
              <div className="flex justify-between items-end">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-6 w-8 rounded-full" />
              </div>
            </CardContent>
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

  const getInventoryColor = (inventory: number) => {
    if (inventory <= 10) return 'text-red-600';
    if (inventory <= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {drinks.map((drink: DrinkItem) => (
        <Card
          key={drink.id || drink.name}
          className="group relative border-0 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer rounded-2xl overflow-hidden hover:bg-white/90"
          onMouseEnter={() => setHoveredDrink(drink.id || drink.name)}
          onMouseLeave={() => setHoveredDrink(null)}
          onClick={() => addToOrder({
            id: drink.id,
            name: drink.name,
            price: drink.price,
            category: drink.category
          })}
        >
          {/* Subtle top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
          
          <CardContent className="p-6 relative h-32 flex flex-col justify-between">
            {/* Main content area - fixed height layout */}
            <div className="flex-1">
              {/* Drink name - truncated for consistency */}
              <div className="mb-3">
                            {/* Drink Name - Fixed height with JavaScript truncation */}
            <h3 
              className="text-lg font-medium text-slate-900 leading-tight px-4 pt-3"
              title={drink.name} // Show full name on hover
            >
              {truncateName(drink.name)}
            </h3>
                <div className="w-8 h-px bg-gray-200 transition-all duration-300 group-hover:w-12 group-hover:bg-gray-300 mt-1"></div>
              </div>
            </div>
              
            {/* Price - fixed position */}
            <div className="absolute bottom-6 left-6">
              <span className="text-2xl font-light text-gray-900 tracking-tight">
                {drink.price ? Math.floor(drink.price) : '—'}
              </span>
            </div>

            {/* Stock level - fixed position in bottom right */}
            <div className="absolute bottom-6 right-6">
              <div className={`text-xs font-mono px-2 py-1 rounded-full transition-all duration-300 ${
                drink.inventory <= 10 
                  ? 'bg-red-50 text-red-600 group-hover:bg-red-100' 
                  : drink.inventory <= 25 
                  ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' 
                  : 'bg-gray-50 text-gray-500 group-hover:bg-gray-100'
              }`}>
                {drink.inventory}
              </div>
            </div>

            {/* Subtle hover overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-gray-50/30 transition-opacity duration-300 pointer-events-none rounded-2xl ${
              hoveredDrink === (drink.id || drink.name) ? "opacity-100" : "opacity-0"
            }`}></div>

            {/* Click indicator - subtle plus icon overlay */}
            <div className={`absolute top-4 right-4 transition-all duration-300 ${
              hoveredDrink === (drink.id || drink.name) 
                ? "opacity-60 scale-100" 
                : "opacity-0 scale-90"
            }`}>
              <div className="w-6 h-6 bg-gray-900/10 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
