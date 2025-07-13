import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createClient } from '@deepgram/sdk'
import { HumeClient } from 'hume'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')

  if (!provider) {
    return NextResponse.json({ error: 'Provider required' }, { status: 400 })
  }

  try {
    let voices = []
    if (provider === 'deepgram') {
      // Deepgram voices are fixed, list some
      voices = [
        { id: 'aura-2-asteria-en', name: 'Asteria (English)' },
        { id: 'aura-2-luna-en', name: 'Luna (English)' },
        { id: 'aura-2-stella-en', name: 'Stella (English)' },
        { id: 'aura-2-juno-en', name: 'Juno (English)' },
        { id: 'aura-2-athena-en', name: 'Athena (English)' },
        { id: 'aura-2-zeus-en', name: 'Zeus (English)' },
        { id: 'aura-2-hera-en', name: 'Hera (English)' },
      ]
    } else if (provider === 'elevenlabs') {
      try {
        const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
        const response = await elevenlabs.voices.getAll()
        voices = response.voices.map(v => ({ id: v.voiceId, name: v.name }))
      } catch (err) {
        console.warn('ElevenLabs API error, using fallback voices', err)
        voices = [
          { id: 'pNInz6obpgDQGcFmaJgB', name: 'Rachel' },
          { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
          { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Josh' }
        ]
      }
    } else if (provider === 'hume') {
      try {
        const hume = new HumeClient({ apiKey: process.env.HUME_API_KEY })
        const response: any = await hume.tts.voices.list()
        voices = (response.voices || []).map((v: any) => ({ id: v.id || v.name, name: v.name }))
      } catch (err) {
        console.warn('Hume API error, using fallback voices', err)
        voices = [
          { id: 'octave-female-1', name: 'Octave Female' },
          { id: 'octave-male-1', name: 'Octave Male' }
        ]
      }
    } else if (provider === 'rime') {
      // RIME LBS does not have a Node SDK; use static voices for now
      voices = [
        { id: 'rime-standard-female', name: 'RIME Standard Female' },
        { id: 'rime-standard-male', name: 'RIME Standard Male' }
      ]
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }

    return NextResponse.json({ voices })
  } catch (error) {
    console.error('Error fetching voices:', error)
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 })
  }
} 