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
  Users, 
  Clock, 
  DollarSign, 
  Package, 
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  CalendarDays,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  Download,
  TrendingUp,
  Eye,
  Printer
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
          parameters: {}
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
          parameters: {}
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Event Management</h2>
          <p className="text-gray-600">Manage event packages and bookings</p>
          <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search events..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="packages" className="px-4">
              Event Packages
              <Badge variant="secondary" className="ml-2">
                {packages.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="px-4">
              Bookings
              <Badge variant="secondary" className="ml-2">
                {bookings.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <Tabs value={activeTab} className="flex-1">
        {/* Event Packages Tab */}
        <TabsContent value="packages" className="h-full space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Packages</p>
                    <p className="text-2xl font-bold text-gray-900">{packageStats.totalPackages}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Price/Person</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(packageStats.avgPrice)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Capacity</p>
                    <p className="text-2xl font-bold text-gray-900">{packageStats.totalCapacity}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                    <p className="text-2xl font-bold text-gray-900">{packageStats.avgDuration.toFixed(1)}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Packages Table */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Event Packages ({filteredPackages.length})</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={fetchPackages}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Dialog open={showNewPackageDialog} onOpenChange={setShowNewPackageDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        New Package
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Create Event Package</DialogTitle>
                        <DialogDescription>
                          Add a new event package with pricing and details.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="name" className="text-right">Name</Label>
                          <Input
                            id="name"
                            value={newPackage.name}
                            onChange={(e) => setNewPackage({...newPackage, name: e.target.value})}
                            className="col-span-3"
                            placeholder="Wedding Package"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="description" className="text-right">Description</Label>
                          <Textarea
                            id="description"
                            value={newPackage.description}
                            onChange={(e) => setNewPackage({...newPackage, description: e.target.value})}
                            className="col-span-3"
                            placeholder="Complete wedding package with bar service..."
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="price" className="text-right">Price ($)</Label>
                          <Input
                            id="price"
                            type="number"
                            value={newPackage.price}
                            onChange={(e) => setNewPackage({...newPackage, price: e.target.value})}
                            className="col-span-3"
                            placeholder="25"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="duration" className="text-right">Duration (hrs)</Label>
                          <Input
                            id="duration"
                            type="number"
                            value={newPackage.duration_hours}
                            onChange={(e) => setNewPackage({...newPackage, duration_hours: e.target.value})}
                            className="col-span-3"
                            placeholder="4"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="max_guests" className="text-right">Max Guests</Label>
                          <Input
                            id="max_guests"
                            type="number"
                            value={newPackage.max_guests}
                            onChange={(e) => setNewPackage({...newPackage, max_guests: e.target.value})}
                            className="col-span-3"
                            placeholder="100"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewPackageDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createPackage}>Create Package</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-500px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                        Package Name {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort("price")}>
                        Price/Person {sortBy === "price" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer text-center" onClick={() => handleSort("duration")}>
                        Duration {sortBy === "duration" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer text-center" onClick={() => handleSort("guests")}>
                        Max Guests {sortBy === "guests" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="text-center">Actions</TableHead>
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
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Bookings Tab */}
        <TabsContent value="bookings" className="h-full space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                    <p className="text-2xl font-bold text-gray-900">{bookingStats.totalBookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(bookingStats.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Booking</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(bookingStats.avgBookingValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Confirmed</p>
                    <p className="text-2xl font-bold text-gray-900">{bookingStats.confirmedBookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bookings Table */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Event Bookings ({filteredBookings.length})</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={fetchBookings}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Dialog open={showNewBookingDialog} onOpenChange={setShowNewBookingDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        New Booking
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Create Event Booking</DialogTitle>
                        <DialogDescription>
                          Book a new event with customer details.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="customer_name" className="text-right">Customer</Label>
                          <Input
                            id="customer_name"
                            value={newBooking.customer_name}
                            onChange={(e) => setNewBooking({...newBooking, customer_name: e.target.value})}
                            className="col-span-3"
                            placeholder="John Smith"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="package_id" className="text-right">Package</Label>
                          <Select
                            value={newBooking.package_id}
                            onValueChange={(value) => setNewBooking({...newBooking, package_id: value})}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select package" />
                            </SelectTrigger>
                            <SelectContent>
                              {packages.map((pkg) => (
                                <SelectItem key={pkg.name} value={pkg.name}>
                                  {pkg.name} - {formatCurrency(pkg.price)}/person
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="event_name" className="text-right">Event Name</Label>
                          <Input
                            id="event_name"
                            value={newBooking.event_name}
                            onChange={(e) => setNewBooking({...newBooking, event_name: e.target.value})}
                            className="col-span-3"
                            placeholder="Anniversary Party"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="event_date" className="text-right">Date</Label>
                          <Input
                            id="event_date"
                            type="date"
                            value={newBooking.event_date}
                            onChange={(e) => setNewBooking({...newBooking, event_date: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="start_time" className="text-right">Start Time</Label>
                          <Input
                            id="start_time"
                            type="time"
                            value={newBooking.start_time}
                            onChange={(e) => setNewBooking({...newBooking, start_time: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="guest_count" className="text-right">Guests</Label>
                          <Input
                            id="guest_count"
                            type="number"
                            value={newBooking.guest_count}
                            onChange={(e) => setNewBooking({...newBooking, guest_count: e.target.value})}
                            className="col-span-3"
                            placeholder="50"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="special_requests" className="text-right">Notes</Label>
                          <Textarea
                            id="special_requests"
                            value={newBooking.special_requests}
                            onChange={(e) => setNewBooking({...newBooking, special_requests: e.target.value})}
                            className="col-span-3"
                            placeholder="Special dietary requirements..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewBookingDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createBooking}>Create Booking</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-500px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("customer")}>
                        Customer {sortBy === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Event Name</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("date")}>
                        Date {sortBy === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="text-center">Guests</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort("total")}>
                        Total {sortBy === "total" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer text-center" onClick={() => handleSort("status")}>
                        Status {sortBy === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="text-center">Actions</TableHead>
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
                        <TableCell className="text-center">
                          <Badge className={getStatusColor(booking.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(booking.status)}
                              {booking.status}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
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
