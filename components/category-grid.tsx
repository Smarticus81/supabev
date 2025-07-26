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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">{selectedCategory}</h2>
            <div className="w-16 h-px bg-gray-200 mt-2"></div>
          </div>
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-gray-500 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
        </div>
        <div className="h-[calc(100%-80px)] overflow-auto">
          <DrinksList drinks={filteredDrinks} addToOrder={onAddToOrder} isLoading={isLoading} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Menu Categories</h2>
        <div className="w-16 h-px bg-gray-200 mt-2"></div>
      </div>
      
      <div className="flex-1 max-w-full">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((category) => {
            const actualCount = drinks.filter((drink) => drink.category === category.name).length
            const IconComponent = getCategoryIcon(category.name)

            return (
              <Card
                key={category.name}
                className="group border-0 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:bg-white/90"
                onClick={() => setSelectedCategory(category.name)}
              >
                <CardContent className="p-4 flex flex-col justify-center items-center relative">
                  {/* Subtle top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                  
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-gray-100 transition-colors duration-300">
                      <IconComponent className="h-5 w-5 text-gray-700" />
                    </div>
                    
                    <div className="text-center">
                      <h3 className="text-xs font-medium text-gray-900 mb-1">
                        {category.name}
                      </h3>
                      <div className="w-6 h-px bg-gray-200 mx-auto mb-1 transition-all duration-300 group-hover:w-8 group-hover:bg-gray-300"></div>
                      <p className="text-xs text-gray-500">
                        {actualCount > 0 ? actualCount : category.count} items
                      </p>
                    </div>
                  </div>

                  {/* Subtle hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"></div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
