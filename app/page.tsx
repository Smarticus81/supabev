"use client"

// @ts-ignore
import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Save, CreditCard, Menu, Users, Receipt, Package, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/toaster"
import OrderPanel from "@/components/order-panel";
import CategoryGrid from "@/components/category-grid"
import DatabaseViewer from "@/components/database-viewer"
import ItemsView from "@/components/items-view"
import TabsView from "@/components/tabs-view"
import TransactionsView from "@/components/transactions-view"
import VoiceAssistantButton from "@/components/voice-assistant-button";
import useVoiceAssistant from "@/hooks/use-voice-assistant";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function Home() {
  const [drinks, setDrinks] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedPackage, setSelectedPackage] = useState("Silver Pkg")
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState("menu")
  const [customerName, setCustomerName] = useState("Andrew Wagner")
  const [showDbViewer, setShowDbViewer] = useState(false)
  const [showMobileOrder, setShowMobileOrder] = useState(false)
  const [isBevSpeaking, setIsBevSpeaking] = useState(false)

  const handleTranscript = (transcript: string) => {
    console.log("Transcript received:", transcript);
  };

  // Handle order updates from voice assistant
  const handleOrderUpdate = useCallback((data: any) => {
    console.log("Processing order update:", data);
    if (data.action === 'add_items' && data.items) {
      setOrders(prevOrders => {
        const updatedOrders = [...prevOrders];
        
        // Add each item from voice order
        data.items.forEach((voiceItem: any) => {
          const existingItemIndex = updatedOrders.findIndex(item => 
            item.name === voiceItem.name && item.id.startsWith('voice_')
          );
          
          if (existingItemIndex >= 0) {
            // Update existing voice order item
            updatedOrders[existingItemIndex].quantity += voiceItem.quantity;
          } else {
            // Add new voice order item
            updatedOrders.push({
              id: voiceItem.id,
              name: voiceItem.name,
              price: voiceItem.price,
              quantity: voiceItem.quantity
            });
          }
        });
        
        return updatedOrders;
      });
    }
  }, []);

  // Handle cart clear from voice assistant
  const handleCartClear = useCallback(() => {
    console.log("Clearing cart from voice command");
    setOrders([]);
  }, []);

  // Initialize voice assistant
  const { isListening, toggleListening, mode, wakeWordDetected } = useVoiceAssistant(handleTranscript, handleOrderUpdate, handleCartClear);

  // old Vapi voice removed

  // Package options
  const packages = ["Silver Pkg", "Gold Pkg", "Platinum Pkg", "Others"]

  // Category data updated to match new data structure
  const categoryData = useMemo(
    () => [
      { name: "Beer", count: 10, color: "bg-blue-200", textColor: "text-blue-800" },
      { name: "Wine", count: 9, color: "bg-green-200", textColor: "text-green-800" },
      { name: "Signature", count: 3, color: "bg-yellow-200", textColor: "text-yellow-800" },
      { name: "Classics", count: 3, color: "bg-orange-200", textColor: "text-orange-800" },
      { name: "Spirits", count: 18, color: "bg-red-200", textColor: "text-red-800" },
      { name: "Non-Alcoholic", count: 15, color: "bg-purple-200", textColor: "text-purple-800" },
    ],
    [],
  )

  const fetchDrinks = useCallback(async () => {
      try {
        const response = await fetch("/api/drinks")
        const data = await response.json()

        const drinksArray: any[] = Array.isArray(data) ? data : [];
        setDrinks(drinksArray)

        // Extract unique categories only when data is array
        const uniqueCategories = [...new Set(drinksArray.map((drink: any) => drink.category))] as string[]
        setCategories(uniqueCategories)

        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching drinks:", error)
        setIsLoading(false)
      }
  }, [])

  // Load drinks data
  useEffect(() => {
    fetchDrinks()
  }, [fetchDrinks])

  // removed Vapi overlay logic

  // Add drink to order
  const addToOrder = (drink: any) => {
    setOrders((prevOrders) => {
      const existingItem = prevOrders.find((item) => item.id === drink.id);
      if (existingItem) {
        return prevOrders.map((item) =>
          item.id === drink.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prevOrders, { ...drink, quantity: 1 }];
    });
  };

  // Remove item from order
  const removeFromOrder = (itemId: string) => {
    if (itemId === "all") {
      setOrders([])
      return
    }

    const updatedOrders = orders.filter((item) => item.id !== itemId)
    setOrders(updatedOrders)
  }

  // Clear entire cart
  const clearCart = () => {
    setOrders([])
  }

  // Update item quantity
  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromOrder(itemId)
      return
    }

    setOrders(orders.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)))
  }

  // Calculate totals
  const calculateSubtotal = useMemo(() => {
    return () => orders.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [orders])

  const calculateTax = useMemo(() => {
    return () => calculateSubtotal() * 0.0825 // 8.25% tax
  }, [calculateSubtotal])

  const calculateTotal = useMemo(() => {
    return () => calculateSubtotal() + calculateTax()
  }, [calculateSubtotal, calculateTax])

  // Add completeOrder function
  const completeOrder = async () => {
    if (orders.length === 0) {
      return;
    }

    try {
      // Convert UI order format to the format expected by the API
      const orderItems = orders.map(item => ({
        // For UI orders, we need to find the serving option ID
        // For now, we'll create a simplified order structure
        drink_name: item.name,
        quantity: item.quantity,
        price: item.price,
        // Note: This is a simplified approach. In a real system, 
        // you'd need to map back to serving_option_id
      }));

      const orderData = {
        items: orderItems,
        customerName: customerName,
        total: calculateTotal(),
        subtotal: calculateSubtotal(),
        tax: calculateTax()
      };

      console.log('Completing order:', orderData);

      // For now, we'll just clear the cart and show success
      // In a real implementation, you'd send this to your order processing endpoint
      setOrders([]);
      
      // Show success message
      alert(`Order completed successfully! Total: $${calculateTotal().toFixed(2)}`);
      
      // Optionally switch to transactions tab to show the completed order
      // setCurrentTab("transactions");

    } catch (error) {
      console.error('Error completing order:', error);
      alert('Error completing order. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Voice waveform overlay temporarily disabled */}
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Package Tabs - Hidden on mobile, shown on tablet+ */}
          <div className="hidden md:block flex-1">
            <Tabs value={selectedPackage} onValueChange={setSelectedPackage}>
              <TabsList className="bg-gray-100 p-1">
                {packages.map((pkg) => (
                  <TabsTrigger
                    key={pkg}
                    value={pkg}
                    className="px-4 lg:px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    {pkg}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Mobile Package Selector */}
          <div className="md:hidden flex-1">
            <select
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              {packages.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </div>

          {/* Search and Actions */}
          <div className="flex items-center gap-2 sm:gap-4 ml-2 sm:ml-8">
            {/* Search - Hidden on small mobile */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search"
                className="pl-10 w-48 lg:w-64 bg-gray-50 border-gray-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Mobile Search Button */}
            <Button variant="outline" size="icon" className="sm:hidden bg-transparent">
              <Search className="h-4 w-4" />
            </Button>

            {/* Action Buttons */}
            <Button variant="outline" className="hidden sm:flex px-4 lg:px-6 bg-transparent">
              <Save className="h-4 w-4 mr-2" />
              <span className="hidden lg:inline">Save</span>
            </Button>

            <Button className="px-4 lg:px-6 bg-yellow-400 hover:bg-yellow-500 text-black">
              <CreditCard className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Pay</span>
            </Button>
            
            <VoiceAssistantButton 
            onTranscript={handleTranscript} 
            isListening={isListening}
            toggleListening={toggleListening}
            mode={mode}
            wakeWordDetected={wakeWordDetected}
          />

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {currentTab === "menu" ? (
          <>
            {/* Left Side - Categories */}
            <div className="flex-1 p-3 sm:p-6 min-h-0">
              <CategoryGrid
                categories={categoryData}
                drinks={drinks}
                searchQuery={searchQuery}
                onAddToOrder={addToOrder}
                isLoading={isLoading}
              />
            </div>

            {/* Right Side - Order Summary (Desktop/Tablet only) */}
            <div className="hidden md:block w-80 lg:w-96 bg-white border-l border-gray-200 flex-shrink-0">
              <OrderPanel
                orders={orders}
                removeFromOrder={removeFromOrder}
                updateQuantity={updateQuantity}
                total={calculateTotal()}
                onCompleteOrder={completeOrder}
              />
            </div>
          </>
        ) : currentTab === "items" ? (
          <div className="flex-1 p-3 sm:p-6 min-h-0">
            <ItemsView
              drinks={drinks}
              onAddToOrder={addToOrder}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        ) : currentTab === "tabs" ? (
          <div className="flex-1 p-3 sm:p-6 min-h-0">
            <TabsView currentCustomer={customerName} orders={orders} total={calculateTotal()} />
          </div>
        ) : currentTab === "transactions" ? (
          <div className="flex-1 p-3 sm:p-6 min-h-0">
            <TransactionsView />
          </div>
        ) : null}
      </div>

      {/* Mobile Order Summary Overlay */}
      {showMobileOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Current Order</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowMobileOrder(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="overflow-auto max-h-[calc(80vh-120px)]">
              <OrderPanel
                orders={orders}
                removeFromOrder={removeFromOrder}
                updateQuantity={updateQuantity}
                total={calculateTotal()}
                onCompleteOrder={completeOrder}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0 safe-area-bottom">
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          <Button
            variant={currentTab === "menu" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("menu")}
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs">Menu</span>
          </Button>

          <Button
            variant={currentTab === "tabs" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("tabs")}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs">Tabs</span>
          </Button>

          <Button
            variant={currentTab === "transactions" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("transactions")}
          >
            <Receipt className="h-5 w-5" />
            <span className="text-xs">Transactions</span>
          </Button>

          <Button
            variant={currentTab === "items" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("items")}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs">Items</span>
          </Button>
        </div>
      </div>

      {showDbViewer && (
        <Card className="mb-2 overflow-hidden border-[#e2e8f0]">
          <DatabaseViewer drinks={drinks} />
        </Card>
      )}

      <Toaster />
    </div>
  )
}
