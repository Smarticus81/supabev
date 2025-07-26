import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/index'
import { orders, drinks } from '@/db/schema'
import { eq, sql, desc, and, gte, lte } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('range') || '30d' // 30d, 7d, 1d

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    switch (timeRange) {
      case '1d':
        startDate.setDate(now.getDate() - 1)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
      default:
        startDate.setDate(now.getDate() - 30)
        break
    }

    // Revenue Analytics
    const revenueResult = await db
      .select({
        today: sql<number>`COALESCE(SUM(CASE WHEN DATE(${orders.createdAt}) = DATE(NOW()) THEN ${orders.total} END), 0)`,
        week: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= NOW() - INTERVAL '7 days' THEN ${orders.total} END), 0)`,
        month: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= NOW() - INTERVAL '30 days' THEN ${orders.total} END), 0)`,
        previousMonth: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= NOW() - INTERVAL '60 days' AND ${orders.createdAt} < NOW() - INTERVAL '30 days' THEN ${orders.total} END), 0)`
      })
      .from(orders)
      .where(eq(orders.status, 'completed'))

    const revenue = revenueResult[0]
    const growthRate = revenue.previousMonth > 0 
      ? ((revenue.month - revenue.previousMonth) / revenue.previousMonth * 100) 
      : 0

    // Order Analytics
    const orderStats = await db
      .select({
        today: sql<number>`COUNT(CASE WHEN DATE(${orders.createdAt}) = DATE(NOW()) THEN 1 END)`,
        week: sql<number>`COUNT(CASE WHEN ${orders.createdAt} >= NOW() - INTERVAL '7 days' THEN 1 END)`,
        month: sql<number>`COUNT(CASE WHEN ${orders.createdAt} >= NOW() - INTERVAL '30 days' THEN 1 END)`,
        avgOrderValue: sql<number>`COALESCE(AVG(${orders.total}), 0)`
      })
      .from(orders)
      .where(eq(orders.status, 'completed'))

    // Top Selling Items - Extract from JSON items field
    const topSelling = await db
      .select({
        name: sql<string>`item->>'name'`,
        sold: sql<number>`COALESCE(SUM((item->>'quantity')::integer), 0)`
      })
      .from(orders)
      .crossJoin(sql`jsonb_array_elements(${orders.items}) as item`)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, startDate.toISOString())
        )
      )
      .groupBy(sql`item->>'name'`)
      .orderBy(desc(sql`SUM((item->>'quantity')::integer)`))
      .limit(5)

    // Peak Hours Analysis
    const peakHours = await db
      .select({
        hour: sql<string>`TO_CHAR(${orders.createdAt}, 'HH24":00"')`,
        orders: sql<number>`COUNT(*)`
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, startDate.toISOString())
        )
      )
      .groupBy(sql`TO_CHAR(${orders.createdAt}, 'HH24')`)
      .orderBy(sql`TO_CHAR(${orders.createdAt}, 'HH24')`)

    // Category Performance - Extract from JSON items
    const categoryPerformance = await db
      .select({
        category: sql<string>`d.category`,
        revenue: sql<number>`COALESCE(SUM((item->>'quantity')::integer * (item->>'price')::integer), 0)`,
        count: sql<number>`COALESCE(SUM((item->>'quantity')::integer), 0)`
      })
      .from(orders)
      .crossJoin(sql`jsonb_array_elements(${orders.items}) as item`)
      .innerJoin(drinks, sql`d.id = (item->>'drink_id')::integer`, { d: drinks })
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, startDate.toISOString())
        )
      )
      .groupBy(sql`d.category`)
      .orderBy(desc(sql`SUM((item->>'quantity')::integer * (item->>'price')::integer)`))

    const totalCategoryRevenue = categoryPerformance.reduce((sum, cat) => sum + cat.revenue, 0)
    const popularCategories = categoryPerformance.map(cat => ({
      category: cat.category,
      percentage: totalCategoryRevenue > 0 ? Math.round((cat.revenue / totalCategoryRevenue) * 100) : 0
    }))

    // Weekly Customer Flow (using order count as proxy)
    const customerFlow = await db
      .select({
        day: sql<string>`EXTRACT(DOW FROM ${orders.createdAt})::text`,
        customers: sql<number>`COUNT(DISTINCT COALESCE(${orders.customerId}, 0))`
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        )
      )
      .groupBy(sql`EXTRACT(DOW FROM ${orders.createdAt})`)
      .orderBy(sql`EXTRACT(DOW FROM ${orders.createdAt})`)

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const formattedCustomerFlow = dayNames.map((day, index) => {
      const dayData = customerFlow.find(d => parseInt(d.day) === index)
      return {
        day,
        customers: dayData?.customers || 0
      }
    })

    // Inventory Status
    const inventoryStatus = await db
      .select({
        totalItems: sql<number>`COUNT(*)`,
        lowStock: sql<number>`COUNT(CASE WHEN ${drinks.inventory} <= 10 THEN 1 END)`,
        outOfStock: sql<number>`COUNT(CASE WHEN ${drinks.inventory} = 0 THEN 1 END)`
      })
      .from(drinks)

    const analytics = {
      revenue: {
        today: revenue.today,
        week: revenue.week,
        month: revenue.month,
        growth: Math.round(growthRate * 100) / 100
      },
      orders: {
        today: orderStats[0].today,
        week: orderStats[0].week,
        month: orderStats[0].month,
        avgOrderValue: Math.round(orderStats[0].avgOrderValue * 100) / 100
      },
      inventory: {
        totalItems: inventoryStatus[0].totalItems,
        lowStock: inventoryStatus[0].lowStock,
        outOfStock: inventoryStatus[0].outOfStock,
        topSelling: topSelling.map(item => ({
          name: item.name,
          sold: item.sold
        }))
      },
      performance: {
        peakHours: peakHours.map(hour => ({
          hour: hour.hour,
          orders: hour.orders
        })),
        popularCategories,
        customerFlow: formattedCustomerFlow
      }
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
} 