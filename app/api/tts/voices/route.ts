import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')

  if (!provider) {
    return NextResponse.json({ error: 'Provider required' }, { status: 400 })
  }

  try {
    let voices = []
    if (provider === 'openai') {
      // OpenAI Realtime API voices
      voices = [
        { id: 'shimmer', name: 'shimmer (Natural)' },
        { id: 'echo', name: 'Echo (Professional)' },
        { id: 'fable', name: 'Fable (Storytelling)' },
        { id: 'onyx', name: 'Onyx (Deep)' },
        { id: 'nova', name: 'Nova (Bright)' },
        { id: 'shimmer', name: 'Shimmer (Gentle)' },
      ]
    } else {
      return NextResponse.json({ 
        error: `Provider '${provider}' not supported. Only OpenAI voices are available for the premium WebRTC voice pipeline.`,
        supportedProviders: ['openai']
      }, { status: 400 })
    }

    return NextResponse.json({ voices })
  } catch (error) {
    console.error('Error fetching voices:', error)
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 })
  }
} 