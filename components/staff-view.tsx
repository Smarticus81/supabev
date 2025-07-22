"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  UserCheck, 
  Clock,
  RefreshCw,
  Mail,
  Phone
} from "lucide-react"

interface StaffMember {
  id: number
  name: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: string
  permissions: any
  hourly_rate?: number
  hire_date?: string
  is_active: boolean
  has_pin: boolean
  created_at: string
  updated_at: string
}

export default function StaffView() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const fetchStaff = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/staff')
      if (!response.ok) {
        throw new Error('Failed to fetch staff')
      }
      const data = await response.json()
      setStaff(data)
    } catch (error: any) {
      console.error('Error fetching staff:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  // Filter and search logic
  useEffect(() => {
    let result = [...staff]

    // Filter by role
    if (activeTab !== "all") {
      result = result.filter(member => member.role === activeTab)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      )
    }

    // Sort
    result.sort((a, b) => {
      let aValue = a[sortBy as keyof StaffMember]
      let bValue = b[sortBy as keyof StaffMember]
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase()
      if (typeof bValue === 'string') bValue = bValue.toLowerCase()
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    setFilteredStaff(result)
  }, [staff, searchQuery, activeTab, sortBy, sortDirection])

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortDirection("asc")
    }
  }

  const roles = useMemo(() => {
    const allRoles = ["all", ...Array.from(new Set(staff.map(s => s.role)))]
    return allRoles
  }, [staff])

  const stats = useMemo(() => {
    const totalStaff = staff.filter(s => s.is_active).length
    const roleStats = staff.reduce((acc, member) => {
      if (member.is_active) {
        acc[member.role] = (acc[member.role] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    return {
      totalStaff,
      roleStats
    }
  }, [staff])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-50 text-red-700'
      case 'manager': return 'bg-purple-50 text-purple-700'
      case 'bartender': return 'bg-blue-50 text-blue-700'
      case 'server': return 'bg-green-50 text-green-700'
      default: return 'bg-gray-50 text-gray-700'
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading staff...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading staff: {error}</p>
          <Button onClick={fetchStaff}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">Manage your venue staff and permissions</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalStaff}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {Object.entries(stats.roleStats).slice(0, 3).map(([role, count]) => (
          <Card key={role}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 capitalize">{role}s</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role Filters */}
      <div className="flex items-center gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100">
            {roles.map((role) => (
              <TabsTrigger key={role} value={role} className="px-4 capitalize">
                {role}
                <Badge variant="secondary" className="ml-2">
                  {role === "all"
                    ? staff.filter(s => s.is_active).length
                    : staff.filter(s => s.role === role && s.is_active).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Staff Table */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Staff Members ({filteredStaff.length})</span>
            <Button variant="ghost" onClick={fetchStaff}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                    Name {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("role")}>
                    Role {sortBy === "role" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Hourly Rate</TableHead>
                  <TableHead>Hire Date</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{member.name}</div>
                        <div className="text-sm text-gray-500">ID: {member.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="h-3 w-3 mr-1" />
                          {member.email}
                        </div>
                        {member.phone && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="h-3 w-3 mr-1" />
                            {member.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {member.hourly_rate ? formatCurrency(member.hourly_rate) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {member.hire_date ? formatDate(member.hire_date) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={member.has_pin ? 'default' : 'outline'}>
                          {member.has_pin ? 'PIN Set' : 'No PIN'}
                        </Badge>
                        <Badge variant={member.is_active ? 'default' : 'secondary'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline">
                          <Clock className="h-4 w-4 mr-1" />
                          Schedule
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
    </div>
  )
} 