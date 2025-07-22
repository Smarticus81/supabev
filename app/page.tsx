"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Save, CreditCard, Menu, Users, Receipt, Package, X, Settings, Calendar } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/toaster"
import OrderPanel from "@/components/order-panel"
import CategoryGrid from "@/components/category-grid"
import DatabaseViewer from "@/components/database-viewer"
import ItemsView from "@/components/items-view"
import TabsView from "@/components/tabs-view"
import TransactionsView from "@/components/transactions-view"
import StaffView from "@/components/staff-view"
import EventsView from "@/components/events-view"
import { VoiceControlButton } from "@/components/voice-control-button"
import { VoiceDebug } from "@/components/voice-debug"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { useIsMobile } from '@/hooks/use-mobile'
import { useToast } from '@/hooks/use-toast'
import { SettingsView } from "@/components/settings-view"

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
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [showMobileSearch, setShowMobileSearch] = useState(false)

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

  const handleNavigateToTab = (tab: string) => {
    setCurrentTab(tab);
    // You can also add logic here to scroll to the relevant section if your layout supports it
    console.log(`Navigating to tab: ${tab}`);
  };

  // Load drinks data
  useEffect(() => {
    fetchDrinks()
  }, [fetchDrinks])

  // Debug orders state changes (keep minimal logging)
  useEffect(() => {
    console.log('Cart updated:', orders.length, 'items');
  }, [orders])

  // Sync with voice cart every 2 seconds
  useEffect(() => {
    const syncWithVoiceCart = async () => {
      try {
        const response = await fetch('/api/voice-cart');
        if (response.ok) {
          const voiceCartData = await response.json();
          if (voiceCartData.success) {
            // Always sync with voice cart state (including when empty)
            if (voiceCartData.items.length === 0) {
              // Voice cart is empty - clear the main cart
              setOrders([]);
            } else {
              // Merge voice cart items with current cart
              setOrders(prevOrders => {
                const mergedCart = [...prevOrders];
                
                voiceCartData.items.forEach((voiceItem: any) => {
                  const existingIndex = mergedCart.findIndex(item => String(item.id) === String(voiceItem.id));
                  if (existingIndex >= 0) {
                    // Update existing item with voice cart quantity
                    mergedCart[existingIndex] = voiceItem;
                  } else {
                    // Add new item from voice cart
                    mergedCart.push(voiceItem);
                  }
                });
                
                return mergedCart;
              });
            }
          }
        }
      } catch (error) {
        console.error('Error syncing with voice cart:', error);
      }
    };

    // Initial sync
    syncWithVoiceCart();
    
    // Set up periodic sync
    const interval = setInterval(syncWithVoiceCart, 2000);
    
    return () => clearInterval(interval);
  }, [])

  // removed Vapi overlay logic

  // Add drink to order
  const addToOrder = (drink: any) => {
    setOrders((prevOrders) => {
      // Ensure ID comparison works properly by converting both to strings
      const drinkId = String(drink.id);
      const existingItem = prevOrders.find((item) => String(item.id) === drinkId);
      
      if (existingItem) {
        return prevOrders.map((item) =>
          String(item.id) === drinkId ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      
      const newOrderItem = { 
        id: drinkId, 
        name: drink.name, 
        price: drink.price, 
        quantity: 1 
      };
      return [...prevOrders, newOrderItem];
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
    console.log("clearCart called - clearing orders");
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

  // Add save current order function
  const saveCurrentOrder = () => {
    if (orders.length === 0) {
      toast({
        title: "No Order to Save",
        description: "Please add items to the order before saving.",
        variant: "destructive",
      })
      return
    }

    // Save order to localStorage as draft
    const draftOrder = {
      id: Date.now().toString(),
      customer: customerName,
      items: orders,
      total: calculateTotal(),
      timestamp: new Date().toISOString(),
      status: 'draft'
    }

    const existingDrafts = JSON.parse(localStorage.getItem('draftOrders') || '[]')
    existingDrafts.push(draftOrder)
    localStorage.setItem('draftOrders', JSON.stringify(existingDrafts))

    toast({
      title: "Order Saved",
      description: `Draft order saved for ${customerName}`,
    })
  }

  // Add payment processing function
  const processPayment = () => {
    if (orders.length === 0) {
      toast({
        title: "No Items to Pay",
        description: "Please add items to the order before processing payment.",
        variant: "destructive",
      })
      return
    }

    // Simulate payment processing
    toast({
      title: "Payment Processing",
      description: `Processing payment of $${calculateTotal().toFixed(2)}...`,
    })

    // In a real app, you would integrate with a payment processor here
    setTimeout(() => {
      toast({
        title: "Payment Successful",
        description: "Payment has been processed successfully.",
      })
    }, 2000)
  }
  const completeOrder = async () => {
    if (orders.length === 0) {
      return;
    }

    try {
      // Convert UI order format to the format expected by the API
      const orderItems = orders.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const orderData = {
        items: orderItems,
        total: calculateTotal(),
        subtotal: calculateSubtotal(),
        tax: calculateTax()
      };

      console.log('Completing order:', orderData);

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear the UI cart
        setOrders([]);
        
        // Clear the voice cart as well
        try {
          await fetch('/api/voice-cart', { method: 'DELETE' });
        } catch (error) {
          console.error('Error clearing voice cart:', error);
        }
        
        // Show success message
        alert(`Order completed successfully! Order ID: ${result.orderId}`);
        
        // Optionally refresh drinks to show updated inventory
        fetchDrinks();
      } else {
        throw new Error(result.error || 'Failed to complete order');
      }

    } catch (error) {
      console.error('Error completing order:', error);
      alert('Error completing order. Please try again.');
    }
  }

  const isMobile = useIsMobile()

  const form = useForm({
    defaultValues: {
      tts_provider: 'deepgram',
      tts_voice: 'aura-2-juno-en'
    }
  })

  const { toast } = useToast()
  const [config, setConfig] = useState({ tts_provider: 'deepgram', tts_voice: 'aura-2-juno-en' })
  const [voices, setVoices] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    if (currentTab === 'settings') {
      fetch('/api/config')
        .then(res => res.json())
        .then(data => {
          if (data.config) {
            setConfig(data.config)
            // First fetch voices, then reset form
            fetchVoices(data.config.tts_provider).then(() => {
              form.reset(data.config)
            })
          } else {
            // No config found, use defaults and fetch voices
            fetchVoices('deepgram')
          }
        })
        .catch(console.error)
    }
  }, [currentTab, form])

  const fetchVoices = async (provider: string, autoSelect: boolean = false): Promise<void> => {
    try {
      const res = await fetch(`/api/tts/voices?provider=${provider}`)
      const data = await res.json()
      // Deduplicate by id to avoid React key warnings
      const unique = {} as Record<string, {id: string; name: string}>
      ;(data.voices || []).forEach((v: any) => { if(!unique[v.id]) unique[v.id] = v })
      const uniqueVoices = Object.values(unique)
      setVoices(uniqueVoices)
      
      // Auto-select first voice when provider changes
      if (autoSelect && uniqueVoices.length > 0) {
        form.setValue('tts_voice', uniqueVoices[0].id, { shouldValidate: true })
      }
      
      return Promise.resolve()
    } catch (error) {
      console.error('Failed to fetch voices', error)
      setVoices([])
      return Promise.resolve()
    }
  }

  // Watch provider change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'tts_provider' && value.tts_provider) {
        fetchVoices(value.tts_provider, true) // Auto-select when provider changes
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (data: { tts_provider: string; tts_voice: string }) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (res.ok) {
        toast({ title: 'Settings saved', description: 'TTS configuration updated successfully.' })
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
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
            <Button 
              variant="outline" 
              size="icon" 
              className="sm:hidden bg-transparent"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Action Buttons */}
            <Button 
              variant="outline" 
              className="hidden sm:flex px-4 lg:px-6 bg-transparent"
              onClick={saveCurrentOrder}
            >
              <Save className="h-4 w-4 mr-2" />
              <span className="hidden lg:inline">Save</span>
            </Button>

            <Button 
              className="px-4 lg:px-6 bg-yellow-400 hover:bg-yellow-500 text-black"
              onClick={processPayment}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Pay</span>
            </Button>

            <Button 
              className="px-4 lg:px-6 bg-black hover:bg-gray-800 text-[#FFD700]" 
              disabled={orders.length === 0}
              onClick={completeOrder}
            >
              <span className="hidden sm:inline">Complete Order</span>
              <span className="sm:hidden">Complete</span>
            </Button>

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
              onAddToOrder={addToOrder}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={fetchDrinks}
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
        ) : currentTab === "staff" ? (
          <div className="flex-1 p-3 sm:p-6 min-h-0">
            <StaffView />
          </div>
        ) : currentTab === "events" ? (
          <div className="flex-1 p-3 sm:p-6 min-h-0">
            <EventsView />
          </div>
        ) : currentTab === "settings" ? (
          <div className="flex-1 p-3 sm:p-6 min-h-0">
            <SettingsView />
          </div>
        ) : null}
      </div>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 sm:hidden">
          <div className="bg-white p-4 m-4 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search drinks..."
                  className="pl-10 w-full bg-gray-50 border-gray-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowMobileSearch(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              {searchQuery ? `Searching for "${searchQuery}"` : "Enter a drink name to search"}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Order Summary Overlay */}
      {showMobileOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] md:hidden">
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

      {/* Bottom Navigation - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0 safe-area-bottom z-50">
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
            variant={currentTab === "staff" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("staff")}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs">Staff</span>
          </Button>

          <Button
            variant={currentTab === "tabs" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("tabs")}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs">Tabs</span>
          </Button>

          <Button
            variant={currentTab === "events" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("events")}
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Events</span>
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

          <Button
            variant={currentTab === "settings" ? "default" : "ghost"}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 sm:px-4 min-w-0"
            onClick={() => setCurrentTab("settings")}
          >
            <Settings className="h-5 w-5" />
            <span className="text-xs">Settings</span>
          </Button>
        </div>
      </div>

      {showDbViewer && (
        <Card className="mb-2 overflow-hidden border-[#e2e8f0]">
          <DatabaseViewer drinks={drinks} />
        </Card>
      )}

      <Toaster />

      {/* Voice Control Button - Fixed on bottom right */}
      <div className="fixed bottom-4 right-4 z-50">
        <VoiceControlButton 
          onNavigateToTab={handleNavigateToTab}
          currentTab={currentTab}
        />
      </div>

      {/* Voice Debug Tool - Temporary */}
      <div className="fixed bottom-4 left-4 z-50">
        <VoiceDebug />
      </div>
    </div>
  )
}
