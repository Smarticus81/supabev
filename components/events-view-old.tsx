"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
  Mail
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
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
            price_per_person: parseFloat(newPackage.price),
            duration_hours: parseInt(newPackage.duration_hours),
            min_guests: 1,
            max_guests: parseInt(newPackage.max_guests)
          }
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setShowNewPackageDialog(false)
        setNewPackage({ name: "", description: "", price: "", duration_hours: "4", max_guests: "" })
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
            customer_email: `${newBooking.customer_name?.toLowerCase().replace(' ', '.') || 'customer'}@example.com`,
            package_id: parseInt(newBooking.package_id),
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

  // Filter packages and bookings based on search (with null safety)
  const filteredPackages = (packages || []).filter(pkg => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      pkg.name?.toLowerCase().includes(query) ||
      pkg.description?.toLowerCase().includes(query)
    )
  })

  const filteredBookings = (bookings || []).filter(booking => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      booking.event_name?.toLowerCase().includes(query) ||
      booking.customer_name?.toLowerCase().includes(query) ||
      booking.package_name?.toLowerCase().includes(query)
    )
  })

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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Event Management</h2>
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
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="packages" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Event Packages
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Bookings
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} className="h-full">
          {/* Event Packages Tab */}
          <TabsContent value="packages" className="h-full p-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Event Packages</h3>
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
                        placeholder="2500"
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

            {/* Packages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPackages.map((pkg) => (
                <Card key={pkg.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-lg">{pkg.name}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-sm text-gray-600">
                          <DollarSign className="h-4 w-4 mr-1" />
                          Price
                        </span>
                        <span className="font-semibold">${pkg.price}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          Duration
                        </span>
                        <span className="font-semibold">{pkg.duration_hours} hours</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-sm text-gray-600">
                          <Users className="h-4 w-4 mr-1" />
                          Max Guests
                        </span>
                        <span className="font-semibold">{pkg.max_guests}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredPackages.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Event Packages</h3>
                <p className="text-gray-500 mb-4">Create your first event package to get started.</p>
                <Button onClick={() => setShowNewPackageDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Package
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Event Bookings Tab */}
          <TabsContent value="bookings" className="h-full p-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Event Bookings</h3>
              <Dialog open={showNewBookingDialog} onOpenChange={setShowNewBookingDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Booking
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create Event Booking</DialogTitle>
                    <DialogDescription>
                      Book a new event with customer details and package selection.
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
                      <Label htmlFor="event_name" className="text-right">Event Name</Label>
                      <Input
                        id="event_name"
                        value={newBooking.event_name}
                        onChange={(e) => setNewBooking({...newBooking, event_name: e.target.value})}
                        className="col-span-3"
                        placeholder="Smith Wedding"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="package_id" className="text-right">Package</Label>
                      <Select value={newBooking.package_id} onValueChange={(value) => setNewBooking({...newBooking, package_id: value})}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select package" />
                        </SelectTrigger>
                        <SelectContent>
                          {packages.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id.toString()}>
                              {pkg.name} - ${pkg.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        placeholder="75"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="special_requests" className="text-right">Special Requests</Label>
                      <Textarea
                        id="special_requests"
                        value={newBooking.special_requests}
                        onChange={(e) => setNewBooking({...newBooking, special_requests: e.target.value})}
                        className="col-span-3"
                        placeholder="Any special requirements..."
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

            {/* Bookings List */}
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{booking.event_name}</h3>
                        <p className="text-gray-600">{booking.customer_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(booking.status)}>
                          {getStatusIcon(booking.status)}
                          <span className="ml-1 capitalize">{booking.status}</span>
                        </Badge>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <CalendarDays className="h-4 w-4 mr-2" />
                        {new Date(booking.event_date).toLocaleDateString()} at {booking.start_time}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        {booking.guest_count} guests
                      </div>
                      <div className="flex items-center text-gray-600">
                        <DollarSign className="h-4 w-4 mr-2" />
                        ${booking.total_price}
                      </div>
                    </div>

                    {booking.special_requests && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">
                          <strong>Special Requests:</strong> {booking.special_requests}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      {booking.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            Confirm
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredBookings.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Event Bookings</h3>
                <p className="text-gray-500 mb-4">Create your first event booking to get started.</p>
                <Button onClick={() => setShowNewBookingDialog(true)} className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Booking
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 