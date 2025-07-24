import { NextRequest, NextResponse } from 'next/server';
import { invoke } from '../../../lib/tools';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, parameters } = body;

    if (!tool) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tool name is required' 
      }, { status: 400 });
    }

    console.log('Invoking tool:', tool, 'with parameters:', parameters);
    
    // Ensure consistent clientId is always provided
    const enhancedParameters = {
      ...parameters,
      clientId: parameters?.clientId || 'default'
    };
    
    // Use the invoke function from tools to execute the requested tool
    const result = await invoke(tool, enhancedParameters, { clientId: 'default' });
    
    return NextResponse.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('Error in voice-advanced API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
