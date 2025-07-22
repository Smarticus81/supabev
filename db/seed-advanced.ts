import db from './index';
import { 
  drinks, staff, venues, eventPackages, customers, eventBookings, 
  systemConfig, taxCategories, inventory, analyticsData, aiInsights
} from './schema';

async function seedAdvancedData() {
  console.log('🌱 Seeding advanced venue management data...');

  try {
    // 1. Seed Staff Management Data
    console.log('👥 Seeding staff data...');
    const staffMembers = await db.insert(staff).values([
      {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah@venue.com',
        phone: '555-0101',
        role: 'manager',
        permissions: {
          manage_inventory: true,
          access_analytics: true,
          process_payments: true,
          manage_events: true,
          view_reports: true
        },
        hourly_rate: 2500, // $25.00
        hire_date: new Date('2023-01-15'),
        pin_code: '1234'
      },
      {
        first_name: 'Mike',
        last_name: 'Chen',
        email: 'mike@venue.com',
        phone: '555-0102',
        role: 'bartender',
        permissions: {
          manage_inventory: false,
          access_analytics: false,
          process_payments: true,
          manage_events: false,
          view_reports: false
        },
        hourly_rate: 1800, // $18.00
        hire_date: new Date('2023-03-20'),
        pin_code: '5678'
      },
      {
        first_name: 'Emma',
        last_name: 'Davis',
        email: 'emma@venue.com',
        phone: '555-0103',
        role: 'server',
        permissions: {
          manage_inventory: false,
          access_analytics: false,
          process_payments: true,
          manage_events: false,
          view_reports: false
        },
        hourly_rate: 1500, // $15.00
        hire_date: new Date('2023-06-10'),
        pin_code: '9012'
      },
      {
        first_name: 'Alex',
        last_name: 'Rivera',
        email: 'alex@venue.com',
        phone: '555-0104',
        role: 'event_coordinator',
        permissions: {
          manage_inventory: false,
          access_analytics: true,
          process_payments: false,
          manage_events: true,
          view_reports: true
        },
        hourly_rate: 2200, // $22.00
        hire_date: new Date('2023-02-28'),
        pin_code: '3456'
      }
    ]).returning();

    // 2. Seed Venue Data
    console.log('🏛️ Seeding venue data...');
    const venueData = await db.insert(venues).values([
      {
        name: 'Grand Ballroom',
        address: '123 Celebration Ave',
        city: 'Austin',
        state: 'TX',
        zip_code: '78701',
        capacity: 300,
        indoor_capacity: 250,
        outdoor_capacity: 50,
        amenities: [
          'Full bar service',
          'Dance floor',
          'Stage/DJ booth',
          'Bridal suite',
          'Catering kitchen',
          'Parking for 100 cars',
          'Climate control',
          'Audio/visual equipment'
        ],
        hourly_rate: 50000, // $500.00 per hour
        daily_rate: 300000, // $3000.00 per day
        setup_time_hours: 3,
        cleanup_time_hours: 2,
        description: 'Elegant ballroom perfect for weddings and corporate events'
      },
      {
        name: 'Garden Pavilion',
        address: '456 Nature Way',
        city: 'Austin',
        state: 'TX',
        zip_code: '78702',
        capacity: 150,
        indoor_capacity: 0,
        outdoor_capacity: 150,
        amenities: [
          'Outdoor bar',
          'Garden setting',
          'String lights',
          'Pergola',
          'Portable restrooms',
          'Parking for 50 cars'
        ],
        hourly_rate: 30000, // $300.00 per hour
        daily_rate: 200000, // $2000.00 per day
        setup_time_hours: 2,
        cleanup_time_hours: 1,
        description: 'Beautiful outdoor pavilion surrounded by gardens'
      }
    ]).returning();

    // 3. Seed Event Packages
    console.log('🎉 Seeding event packages...');
    const packages = await db.insert(eventPackages).values([
      {
        name: 'Bronze Package',
        description: 'Essential wedding package with basic bar service',
        price_per_person: 8500, // $85.00 per person
        min_guests: 50,
        max_guests: 100,
        duration_hours: 5,
        included_drinks: 3,
        bar_service_included: true,
        setup_included: true,
        cleanup_included: true,
        catering_included: false,
        package_items: [
          'Welcome cocktail',
          'Open bar for 4 hours',
          'Beer and wine selection',
          'Basic setup and cleanup',
          'Standard glassware'
        ],
        add_ons_available: [
          { name: 'Premium spirits upgrade', price: 15.00 },
          { name: 'Champagne toast', price: 8.00 },
          { name: 'Late night snacks', price: 12.00 }
        ]
      },
      {
        name: 'Silver Package',
        description: 'Popular wedding package with enhanced bar service',
        price_per_person: 12000, // $120.00 per person
        min_guests: 75,
        max_guests: 200,
        duration_hours: 6,
        included_drinks: 5,
        bar_service_included: true,
        setup_included: true,
        cleanup_included: true,
        catering_included: false,
        package_items: [
          'Welcome cocktail hour',
          'Premium open bar for 5 hours',
          'Full liquor selection',
          'Beer and wine selection',
          'Signature cocktails (2)',
          'Enhanced setup and cleanup',
          'Premium glassware',
          'Professional bartender'
        ],
        add_ons_available: [
          { name: 'Top shelf spirits', price: 25.00 },
          { name: 'Champagne service', price: 15.00 },
          { name: 'Coffee and dessert bar', price: 18.00 },
          { name: 'Additional hour of service', price: 20.00 }
        ]
      },
      {
        name: 'Gold Package',
        description: 'Luxury wedding package with premium everything',
        price_per_person: 18000, // $180.00 per person
        min_guests: 100,
        max_guests: 300,
        duration_hours: 8,
        included_drinks: 0, // Unlimited
        bar_service_included: true,
        setup_included: true,
        cleanup_included: true,
        catering_included: true,
        package_items: [
          'Extended cocktail hour',
          'Unlimited premium open bar',
          'Top shelf liquor selection',
          'Craft beer and wine selection',
          'Custom signature cocktails (3)',
          'Champagne service',
          'Professional bartending team',
          'Elegant setup and decor',
          'Premium glassware and barware',
          'Late night snack service'
        ],
        add_ons_available: [
          { name: 'Whiskey tasting station', price: 35.00 },
          { name: 'Wine pairing dinner', price: 45.00 },
          { name: 'Custom cocktail creation', price: 30.00 },
          { name: 'Cigar and scotch bar', price: 40.00 }
        ]
      },
      {
        name: 'Platinum Package',
        description: 'Ultimate luxury experience with white-glove service',
        price_per_person: 25000, // $250.00 per person
        min_guests: 150,
        max_guests: 500,
        duration_hours: 10,
        included_drinks: 0, // Unlimited premium
        bar_service_included: true,
        setup_included: true,
        cleanup_included: true,
        catering_included: true,
        package_items: [
          'VIP cocktail reception',
          'Unlimited ultra-premium open bar',
          'Rare and vintage spirits',
          'Sommelier-selected wine collection',
          'Craft cocktail program',
          'Champagne and caviar service',
          'Master mixologist team',
          'Luxury setup with floral arrangements',
          'Crystal glassware and silver service',
          'Multi-course late night dining',
          'Dedicated event coordinator',
          'Photography of bar service'
        ],
        add_ons_available: [
          { name: 'Private sommelier service', price: 75.00 },
          { name: 'Vintage champagne upgrade', price: 100.00 },
          { name: 'Molecular cocktail experience', price: 85.00 },
          { name: 'Private chef demonstration', price: 120.00 }
        ]
      },
      {
        name: 'Corporate Package',
        description: 'Professional corporate event package',
        price_per_person: 6500, // $65.00 per person
        min_guests: 25,
        max_guests: 200,
        duration_hours: 4,
        included_drinks: 2,
        bar_service_included: true,
        setup_included: true,
        cleanup_included: true,
        catering_included: false,
        package_items: [
          'Welcome reception',
          'Open bar for 3 hours',
          'Beer, wine, and select spirits',
          'Coffee and soft drinks',
          'Professional presentation setup',
          'Basic AV equipment',
          'Networking space configuration'
        ],
        add_ons_available: [
          { name: 'Premium coffee service', price: 8.00 },
          { name: 'Extended bar service', price: 15.00 },
          { name: 'Breakfast or lunch catering', price: 25.00 }
        ]
      }
    ]).returning();

    // 4. Seed Customer Data
    console.log('👤 Seeding customer data...');
    const customerData = await db.insert(customers).values([
      {
        first_name: 'Jennifer',
        last_name: 'Smith',
        email: 'jennifer.smith@email.com',
        phone: '555-1001',
        address: '789 Oak Street',
        city: 'Austin',
        state: 'TX',
        zip_code: '78703',
        preferences: {
          drink_preferences: ['Wine', 'Champagne'],
          event_type: 'Wedding',
          budget_range: 'premium',
          special_requests: 'Vegetarian options required'
        },
        total_spent: 1500000, // $15,000.00
        visit_count: 3
      },
      {
        first_name: 'David',
        last_name: 'Wilson',
        email: 'david.wilson@corp.com',
        phone: '555-1002',
        address: '321 Business Blvd',
        city: 'Austin',
        state: 'TX',
        zip_code: '78704',
        preferences: {
          drink_preferences: ['Beer', 'Whiskey'],
          event_type: 'Corporate',
          budget_range: 'standard',
          special_requests: 'Early setup required'
        },
        total_spent: 850000, // $8,500.00
        visit_count: 5
      },
      {
        first_name: 'Maria',
        last_name: 'Garcia',
        email: 'maria.garcia@email.com',
        phone: '555-1003',
        address: '654 Celebration Lane',
        city: 'Austin',
        state: 'TX',
        zip_code: '78705',
        preferences: {
          drink_preferences: ['Cocktails', 'Tequila'],
          event_type: 'Birthday',
          budget_range: 'luxury',
          special_requests: 'Live music coordination'
        },
        total_spent: 2200000, // $22,000.00
        visit_count: 2
      }
    ]).returning();

    // 5. Seed Event Bookings
    console.log('📅 Seeding event bookings...');
    const bookings = await db.insert(eventBookings).values([
      {
        customer_id: customerData[0].id,
        venue_id: venueData[0].id,
        package_id: packages[1].id, // Silver Package
        event_name: 'Jennifer & Michael Wedding',
        event_type: 'wedding',
        event_date: new Date('2024-09-15'),
        start_time: '17:00:00',
        end_time: '23:00:00',
        guest_count: 150,
        base_price: packages[1].price_per_person * 150,
        total_price: packages[1].price_per_person * 150,
        deposit_paid: 500000, // $5,000.00
        balance_due: (packages[1].price_per_person * 150) - 500000,
        status: 'confirmed',
        special_requests: 'Gluten-free bar snacks, outdoor ceremony space',
        contract_signed: true,
        payment_schedule: [
          { date: '2024-06-15', amount: 5000, status: 'paid', description: 'Initial deposit' },
          { date: '2024-08-15', amount: 10000, status: 'pending', description: 'Second payment' },
          { date: '2024-09-10', amount: 3000, status: 'pending', description: 'Final payment' }
        ],
        assigned_staff: [staffMembers[0].id, staffMembers[1].id, staffMembers[3].id]
      },
      {
        customer_id: customerData[1].id,
        venue_id: venueData[0].id,
        package_id: packages[4].id, // Corporate Package
        event_name: 'Wilson Corp Annual Meeting',
        event_type: 'corporate',
        event_date: new Date('2024-08-22'),
        start_time: '14:00:00',
        end_time: '18:00:00',
        guest_count: 75,
        base_price: packages[4].price_per_person * 75,
        total_price: packages[4].price_per_person * 75,
        deposit_paid: 125000, // $1,250.00
        balance_due: (packages[4].price_per_person * 75) - 125000,
        status: 'confirmed',
        special_requests: 'AV setup for presentations, networking area',
        contract_signed: true,
        assigned_staff: [staffMembers[0].id, staffMembers[2].id]
      }
    ]).returning();

    // 6. Seed System Configuration
    console.log('⚙️ Seeding system configuration...');
    await db.insert(systemConfig).values([
      {
        config_key: 'venue_name',
        config_value: 'Premiere Wedding & Event Venue',
        config_type: 'string',
        description: 'Main venue name'
      },
      {
        config_key: 'default_tax_rate',
        config_value: '0.0825',
        config_type: 'number',
        description: 'Default Texas sales tax rate'
      },
      {
        config_key: 'low_inventory_threshold',
        config_value: '10',
        config_type: 'number',
        description: 'Alert when inventory falls below this level'
      },
      {
        config_key: 'business_hours_start',
        config_value: '09:00',
        config_type: 'string',
        description: 'Business opening time'
      },
      {
        config_key: 'business_hours_end',
        config_value: '23:00',
        config_type: 'string',
        description: 'Business closing time'
      },
      {
        config_key: 'max_event_capacity',
        config_value: '500',
        config_type: 'number',
        description: 'Maximum guests for any single event'
      },
      {
        config_key: 'booking_advance_days',
        config_value: '30',
        config_type: 'number',
        description: 'Minimum days in advance for bookings'
      },
      {
        config_key: 'cancellation_policy_hours',
        config_value: '48',
        config_type: 'number',
        description: 'Hours before event for cancellation'
      }
    ]);

    // 7. Seed Advanced Tax Categories
    console.log('💰 Updating tax categories...');
    await db.insert(taxCategories).values([
      {
        name: 'Event Services',
        rate: '0.06',
        type: 'percentage',
        description: 'Tax rate for event coordination services',
        applies_to: ['events', 'coordination', 'planning'],
        is_active: true
      },
      {
        name: 'Premium Alcohol',
        rate: '0.12',
        type: 'percentage',
        description: 'Higher tax rate for premium spirits',
        applies_to: ['premium_spirits', 'vintage_wine', 'champagne'],
        is_active: true
      }
    ]).onConflictDoNothing();

    // 8. Seed Advanced Inventory
    console.log('📦 Seeding advanced inventory...');
    const inventoryData = await db.insert(inventory).values([
      {
        drink_id: 1, // Assuming we have drinks with IDs 1-5
        bottle_id: 'BTL-001-2024',
        size_oz: 25.4, // 750ml
        remaining_ml: '750',
        cost: 2500, // $25.00
        vendor: 'Premium Spirits Co.',
        batch_number: 'PS2024-001',
        received_date: new Date('2024-07-01'),
        status: 'unopened',
        location: 'Main Bar - Shelf A1'
      },
      {
        drink_id: 2,
        bottle_id: 'BTL-002-2024',
        size_oz: 25.4,
        remaining_ml: '500',
        cost: 3500, // $35.00
        vendor: 'Craft Distillery',
        batch_number: 'CD2024-015',
        received_date: new Date('2024-06-15'),
        opened_at: new Date('2024-07-10'),
        status: 'opened',
        location: 'Main Bar - Shelf A2'
      }
    ]).onConflictDoNothing();

    // 9. Seed Analytics Data
    console.log('📊 Seeding analytics data...');
    const today = new Date();
    const analyticsEntries = [];
    
    // Generate sample analytics for the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      analyticsEntries.push({
        date,
        metric_type: 'sales',
        metric_name: 'daily_revenue',
        value: JSON.stringify({
          revenue: Math.floor(Math.random() * 5000) + 1000,
          orders: Math.floor(Math.random() * 50) + 10,
          avg_order: Math.floor(Math.random() * 150) + 50
        }),
        metadata: {
          day_of_week: date.toLocaleDateString('en-US', { weekday: 'long' }),
          weather: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
        }
      });
    }

    await db.insert(analyticsData).values(analyticsEntries);

    // 10. Seed AI Insights
    console.log('🤖 Seeding AI insights...');
    await db.insert(aiInsights).values([
      {
        insight_type: 'inventory_optimization',
        title: 'Optimize Wine Inventory',
        description: 'Based on recent sales patterns, consider increasing Chardonnay inventory by 25% and reducing Merlot by 15%.',
        confidence_score: 0.87,
        data_points: {
          chardonnay_sales_trend: '+35% over 30 days',
          merlot_sales_trend: '-12% over 30 days',
          current_inventory_levels: { chardonnay: 15, merlot: 25 }
        },
        recommendations: [
          'Order 8 more bottles of Chardonnay',
          'Promote Merlot in upcoming events',
          'Consider Merlot-based cocktail specials'
        ],
        priority: 'medium'
      },
      {
        insight_type: 'sales_prediction',
        title: 'Weekend Revenue Forecast',
        description: 'This weekend is predicted to have 20% higher revenue than average due to three confirmed events.',
        confidence_score: 0.93,
        data_points: {
          confirmed_events: 3,
          expected_guests: 425,
          historical_weekend_average: '$4,200'
        },
        recommendations: [
          'Ensure adequate staff scheduling',
          'Stock additional premium spirits',
          'Prepare signature cocktail ingredients'
        ],
        priority: 'high',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      },
      {
        insight_type: 'customer_behavior',
        title: 'Corporate Client Preferences',
        description: 'Corporate clients show strong preference for whiskey and craft beer. Consider premium upgrade packages.',
        confidence_score: 0.78,
        data_points: {
          corporate_events_analyzed: 15,
          whiskey_consumption: '40% above average',
          craft_beer_consumption: '60% above average'
        },
        recommendations: [
          'Create corporate whiskey tasting add-on',
          'Expand craft beer selection',
          'Offer bourbon-based signature cocktails for corporate events'
        ],
        priority: 'medium'
      }
    ]);

    console.log('✅ Advanced venue management data seeded successfully!');
    console.log(`
🎉 Comprehensive Venue Management System Ready!

📊 Data Seeded:
- ${staffMembers.length} Staff Members (Manager, Bartenders, Event Coordinator)
- ${venueData.length} Venues (Grand Ballroom, Garden Pavilion)
- ${packages.length} Event Packages (Bronze to Platinum + Corporate)
- ${customerData.length} Customers with detailed preferences
- ${bookings.length} Sample Event Bookings
- Advanced inventory tracking with bottle-level detail
- 30 days of sample analytics data
- AI-powered insights and recommendations
- Comprehensive system configuration

🚀 Bev is now the ultimate wedding venue assistant with:
- Complete beverage & inventory management
- Advanced event booking system
- Staff management & permissions
- Financial analytics & reporting
- AI-powered insights & optimization
- Comprehensive venue operations

Ready to revolutionize venue management! 🥂
    `);

  } catch (error) {
    console.error('Error seeding advanced data:', error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedAdvancedData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export default seedAdvancedData; 