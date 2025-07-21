import { NextRequest, NextResponse } from 'next/server';
import { voiceAgentService } from '../../../../lib/voice-agent-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool, tool_input } = body;

    if (!tool) {
      return NextResponse.json({ error: 'Tool name is required' }, { status: 400 });
    }

    console.log(`🔧 Executing tool: ${tool} with input:`, tool_input);

    let result;

    // Route function calls to appropriate service methods
    switch (tool) {
      // 🍸 DRINK & CART MANAGEMENT
      case 'add_drink_to_cart':
        result = await voiceAgentService.addDrinkToCart(
          tool_input.drink_name,
          tool_input.quantity || 1
        );
        break;

      case 'remove_drink_from_cart':
        result = await voiceAgentService.removeDrinkFromCart(
          tool_input.drink_name,
          tool_input.quantity || 1
        );
        break;

      case 'show_cart':
        result = await voiceAgentService.showCart();
        break;

      case 'clear_cart':
        result = await voiceAgentService.clearCart();
        break;

      case 'process_order':
        result = await voiceAgentService.processOrder();
        break;

      // 🔍 SEARCH & INVENTORY
      case 'search_drinks':
        result = await voiceAgentService.searchDrinks(tool_input.query);
        break;

      case 'get_inventory_status':
        result = await voiceAgentService.getInventoryStatus(tool_input.drink_name);
        break;

      // 📊 ANALYTICS & REPORTING
      case 'get_order_analytics':
        result = await voiceAgentService.getOrderAnalytics(tool_input.date_range);
        break;

      // 🎉 EVENT MANAGEMENT
      case 'list_event_packages':
        result = await voiceAgentService.listEventPackages();
        break;

      case 'book_event':
        result = await voiceAgentService.bookEvent(
          tool_input.package,
          tool_input.guest_count,
          tool_input.event_date,
          tool_input.customer_name,
          tool_input.customer_email,
          tool_input.customer_phone
        );
        break;

      // Handle other functions that might still use MCP
      default:
        // For backwards compatibility, try to use the old MCP client if available
        try {
          const { mcpClient } = await import('../../../../server/mcp-client');
          mcpClient.getMcpProcess();
          result = await mcpClient.invokeMcpTool(tool, tool_input);
        } catch (mcpError) {
          console.warn(`Tool ${tool} not implemented in voice agent service and MCP unavailable`);
          result = {
            success: false,
            message: `Function ${tool} is not currently implemented`
          };
        }
        break;
    }

    console.log(`✅ Tool ${tool} executed with result:`, result);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('❌ Error executing tool:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred',
      success: false 
    }, { status: 500 });
  }
}
