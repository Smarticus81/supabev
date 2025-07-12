"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Beer, Wine, Martini, BoxIcon as Bottle, Sparkles, Coffee, GlassWater } from "lucide-react"
import DrinksList from "@/components/drinks-list"

interface CategoryGridProps {
  categories: Array<{
    name: string
    count: number
    color: string
    textColor: string
  }>
  drinks: any[]
  searchQuery: string
  onAddToOrder: (drink: any) => void
  isLoading: boolean
}

const getCategoryIcon = (categoryName: string) => {
  switch (categoryName.toLowerCase()) {
    case "beer":
      return Beer
    case "wine":
      return Wine
    case "cocktails":
      return Martini
    case "spirits":
      return Bottle
    case "signature drinks":
      return Sparkles
    case "non-alcoholic":
      return Coffee
    default:
      return GlassWater
  }
}

export default function CategoryGrid({ categories, drinks, searchQuery, onAddToOrder, isLoading }: CategoryGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Filter drinks based on selected category and search
  const filteredDrinks = useMemo(() => {
    return drinks.filter((drink) => {
      const matchesCategory = !selectedCategory || drink.category === selectedCategory
      const matchesSearch =
        !searchQuery ||
        drink.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drink.category.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [drinks, selectedCategory, searchQuery])

  if (selectedCategory) {
    return (
      <div className="h-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{selectedCategory}</h2>
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-2 rounded-md hover:bg-blue-50"
          >
            ← Back to Categories
          </button>
        </div>
        <div className="h-[calc(100%-60px)] overflow-auto">
          <DrinksList drinks={filteredDrinks} addToOrder={onAddToOrder} isLoading={isLoading} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden flex flex-col p-2 sm:p-4">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex-shrink-0">Menu Categories</h2>
      <div className="flex-1 max-w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 h-fit">
          {categories.map((category) => {
            // Get actual count from drinks data
            const actualCount = drinks.filter((drink) => drink.category === category.name).length
            const IconComponent = getCategoryIcon(category.name)

            return (
              <Card
                key={category.name}
                className={`${category.color} border border-gray-200 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 aspect-square hover:shadow-md touch-manipulation`}
                onClick={() => setSelectedCategory(category.name)}
              >
                <CardContent className="p-4 sm:p-6 h-full flex flex-col justify-center items-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className={`p-3 sm:p-4 rounded-full ${category.textColor} bg-white bg-opacity-90 shadow-sm`}>
                      <IconComponent className="h-10 w-10 sm:h-12 sm:w-12" />
                    </div>
                    <div className="text-center">
                      <h3 className={`text-sm sm:text-base font-semibold ${category.textColor} mb-1 leading-tight`}>
                        {category.name}
                      </h3>
                      <p className={`${category.textColor} opacity-80 text-xs`}>
                        {actualCount > 0 ? actualCount : category.count} items
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
