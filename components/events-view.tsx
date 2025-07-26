"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  DollarSign, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Filter, 
  Search, 
  RefreshCw,
  LogOut
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface EventPackage {
  id: number
  name: string
  description: string
  price: number
  duration_hours: number
  max_guests: number
  created_at: string
}

interface EventBooking {
  id: number
  customer_id: number
  package_id: number
  event_name: string
  event_date: string
  start_time: string
  end_time: string
  guest_count: number
  total_price: number
  deposit_paid: number
  balance_due: number
  status: string
  special_requests: string
  created_at: string
  package_name?: string
  customer_name?: string
}

export default function EventsView() {
  const [activeTab, setActiveTab] = useState("packages")
  const [packages, setPackages] = useState<EventPackage[]>([])
  const [bookings, setBookings] = useState<EventBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [showNewPackageDialog, setShowNewPackageDialog] = useState(false)
  const [showNewBookingDialog, setShowNewBookingDialog] = useState(false)

  // New package form state
  const [newPackage, setNewPackage] = useState({
    name: "",
    description: "",
    price: "",
    duration_hours: "4",
    max_guests: ""
  })

  // New booking form state
  const [newBooking, setNewBooking] = useState({
    customer_name: "",
    package_id: "",
    event_name: "",
    event_date: "",
    start_time: "",
    guest_count: "",
    special_requests: ""
  })

  // Fetch event packages
  const fetchPackages = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/voice-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'list_event_packages',
          parameters: { clientId: 'default' }
        })
      })
      
      const data = await response.json()
      if (data.success && data.packages) {
        setPackages(data.packages)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch event bookings
  const fetchBookings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/voice-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'get_event_bookings',
          parameters: { clientId: 'default' }
        })
      })
      
      const data = await response.json()
      if (data.success && data.bookings) {
        setBookings(data.bookings)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Create new package
  const createPackage = async () => {
    try {
      const response = await fetch('/api/voice-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'create_event_package',
          parameters: {
            clientId: 'default',
            name: newPackage.name,
            description: newPackage.description,
            price: parseFloat(newPackage.price),
            duration_hours: parseInt(newPackage.duration_hours),
            max_guests: parseInt(newPackage.max_guests)
          }
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setShowNewPackageDialog(false)
        setNewPackage({
          name: "",
          description: "",
          price: "",
          duration_hours: "4",
          max_guests: ""
        })
        fetchPackages()
      }
    } catch (error) {
      console.error('Error creating package:', error)
    }
  }

  // Create new booking
  const createBooking = async () => {
    try {
      const response = await fetch('/api/voice-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'book_event',
          parameters: {
            clientId: 'default',
            customer_name: newBooking.customer_name,
            package: newBooking.package_id,
            event_name: newBooking.event_name,
            event_date: newBooking.event_date,
            start_time: newBooking.start_time,
            guest_count: parseInt(newBooking.guest_count),
            special_requests: newBooking.special_requests
          }
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setShowNewBookingDialog(false)
        setNewBooking({
          customer_name: "",
          package_id: "",
          event_name: "",
          event_date: "",
          start_time: "",
          guest_count: "",
          special_requests: ""
        })
        fetchBookings()
      }
    } catch (error) {
      console.error('Error creating booking:', error)
    }
  }

  useEffect(() => {
    fetchPackages()
    fetchBookings()
  }, [])

  // Filtered and sorted packages
  const filteredPackages = useMemo(() => {
    let result = packages.filter(pkg => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        pkg.name?.toLowerCase().includes(query) ||
        pkg.description?.toLowerCase().includes(query)
      )
    })

    result.sort((a, b) => {
      let aVal: string | number, bVal: string | number
      switch (sortBy) {
        case "name": aVal = a.name || ""; bVal = b.name || ""; break
        case "price": aVal = a.price || 0; bVal = b.price || 0; break
        case "guests": aVal = a.max_guests || 0; bVal = b.max_guests || 0; break
        case "duration": aVal = a.duration_hours || 0; bVal = b.duration_hours || 0; break
        default: aVal = a.name || ""; bVal = b.name || ""
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return result
  }, [packages, searchQuery, sortBy, sortDirection])

  // Filtered and sorted bookings
  const filteredBookings = useMemo(() => {
    let result = bookings.filter(booking => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        booking.event_name?.toLowerCase().includes(query) ||
        booking.customer_name?.toLowerCase().includes(query) ||
        booking.package_name?.toLowerCase().includes(query)
      )
    })

    result.sort((a, b) => {
      let aVal: string | number, bVal: string | number
      switch (sortBy) {
        case "date": aVal = a.event_date || ""; bVal = b.event_date || ""; break
        case "total": aVal = a.total_price || 0; bVal = b.total_price || 0; break
        case "status": aVal = a.status || ""; bVal = b.status || ""; break
        case "customer": aVal = a.customer_name || ""; bVal = b.customer_name || ""; break
        default: aVal = a.event_date || ""; bVal = b.event_date || ""
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return result
  }, [bookings, searchQuery, sortBy, sortDirection])

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortDirection("asc")
    }
  }

  // Calculate stats
  const packageStats = useMemo(() => {
    const totalPackages = packages.length
    const avgPrice = packages.length > 0 ? packages.reduce((sum, p) => sum + p.price, 0) / packages.length : 0
    const totalCapacity = packages.reduce((sum, p) => sum + p.max_guests, 0)
    const avgDuration = packages.length > 0 ? packages.reduce((sum, p) => sum + p.duration_hours, 0) / packages.length : 0

    return { totalPackages, avgPrice, totalCapacity, avgDuration }
  }, [packages])

  const bookingStats = useMemo(() => {
    const totalBookings = bookings.length
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_price || 0), 0)
    const avgBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length

    return { totalBookings, totalRevenue, avgBookingValue, confirmedBookings }
  }, [bookings])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (status: string) => {
    switch ((status || 'pending').toLowerCase()) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch ((status || 'pending').toLowerCase()) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />
      case 'pending': return <AlertCircle className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  if (loading && packages.length === 0 && bookings.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">Events</h1>
          <Button
            onClick={fetchPackages}
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

      {/* Simple Tabs */}
      <div className="mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="packages" className="px-4">
              Packages
            </TabsTrigger>
            <TabsTrigger value="bookings" className="px-4">
              Bookings
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
 
      {/* Tab Content */}
      <Tabs value={activeTab} className="flex-1">
        {/* Event Packages Tab */}
        <TabsContent value="packages" className="h-full">
          {/* Packages Table */}
          <Card className="flex-1">
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-400px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Duration</TableHead>
                      <TableHead className="text-center">Max Guests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPackages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell className="max-w-md">
                          <p className="truncate text-gray-600">{pkg.description}</p>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(pkg.price)}</TableCell>
                        <TableCell className="text-center">{pkg.duration_hours}h</TableCell>
                        <TableCell className="text-center">{pkg.max_guests}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
 
        {/* Event Bookings Tab */}
        <TabsContent value="bookings" className="h-full">
          {/* Bookings Table */}
          <Card className="flex-1">
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-500px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event Name</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Guests</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">#{booking.id}</TableCell>
                        <TableCell>{booking.customer_name}</TableCell>
                        <TableCell>{booking.event_name}</TableCell>
                        <TableCell>{booking.package_name}</TableCell>
                        <TableCell>{formatDate(booking.event_date)}</TableCell>
                        <TableCell className="text-center">{booking.guest_count}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(booking.total_price)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
