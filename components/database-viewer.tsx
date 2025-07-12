"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function DatabaseViewer({ drinks }) {
  const [filteredDrinks, setFilteredDrinks] = useState(drinks)
  const [searchQuery, setSearchQuery] = useState("")
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    // Filter drinks based on search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      setFilteredDrinks(
        drinks.filter(
          (drink) =>
            drink.name.toLowerCase().includes(query) ||
            drink.category.toLowerCase().includes(query) ||
            (drink.subcategory && drink.subcategory.toLowerCase().includes(query)),
        ),
      )
    } else {
      setFilteredDrinks(drinks)
    }

    // Update last updated timestamp
    setLastUpdated(new Date())
  }, [drinks, searchQuery])

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium text-black">Database Viewer</h2>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="Filter..."
            className="max-w-[150px] h-7 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="text-[10px] text-[#718096]">Updated: {lastUpdated.toLocaleTimeString()}</div>
        </div>
      </div>

      <ScrollArea className="h-[200px] rounded-md border border-[#e2e8f0]">
        <Table>
          <TableHeader className="bg-black sticky top-0">
            <TableRow>
              <TableHead className="text-[#FFD700] text-xs font-medium h-7 py-1">Name</TableHead>
              <TableHead className="text-[#FFD700] text-xs font-medium">Category</TableHead>
              <TableHead className="text-[#FFD700] text-xs font-medium">Subcategory</TableHead>
              <TableHead className="text-[#FFD700] text-xs font-medium text-right">Price</TableHead>
              <TableHead className="text-[#FFD700] text-xs font-medium text-right">Stock</TableHead>
              <TableHead className="text-[#FFD700] text-xs font-medium text-right">Sales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDrinks.map((drink) => (
              <TableRow key={drink.id || drink.name} className="h-6">
                <TableCell className="py-1 text-xs font-medium">{drink.name}</TableCell>
                <TableCell className="py-1 text-xs">{drink.category}</TableCell>
                <TableCell className="py-1 text-xs">{drink.subcategory}</TableCell>
                <TableCell className="py-1 text-xs text-right">${drink.price.toFixed(2)}</TableCell>
                <TableCell className="py-1 text-xs text-right">{drink.inventory}</TableCell>
                <TableCell className="py-1 text-xs text-right">{drink.sales || 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
