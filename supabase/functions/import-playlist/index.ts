import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Song = { title: string; artist: string | null }

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function parsePlaylistUrl(rawUrl: string) {
  const url = new URL(rawUrl)
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'spotify.com' || hostname === 'open.spotify.com' || hostname === 'spotify') {
    return { provider: 'spotify-disabled', id: '' }
  }
  if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'youtu.be') return { provider: 'youtube', id: url.searchParams.get('list') || '' }
  return { provider: '', id: '' }
}

async function youtubeSongs(playlistId: string): Promise<Song[]> {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY')
  if (!apiKey) throw new Error('YouTube playlist import is not configured.')
  const songs: Song[] = []
  let pageToken = ''
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ part: 'snippet', maxResults: '50', playlistId, key: apiKey })
    if (pageToken) query.set('pageToken', pageToken)
    const playlistResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${query}`)
    if (!playlistResponse.ok) throw new Error('Unable to read that YouTube playlist. Check the playlist link and visibility.')
    const payload = await playlistResponse.json()
    songs.push(...(payload.items || []).map((item: { snippet?: { title?: string; videoOwnerChannelTitle?: string } }) => ({ title: item.snippet?.title || '', artist: item.snippet?.videoOwnerChannelTitle || null })).filter((song: Song) => song.title && song.title !== 'Private video' && song.title !== 'Deleted video'))
    pageToken = payload.nextPageToken || ''
    if (!pageToken) break
  }
  return songs
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { url: rawUrl } = await request.json()
    if (!rawUrl) return response({ error: 'A playlist URL is required.' }, 400)
    const parsed = parsePlaylistUrl(rawUrl)
    if (parsed.provider === 'spotify-disabled') return response({ error: 'Spotify playlist import is temporarily unavailable while we fix the integration.' }, 400)
    if (!parsed.provider || !parsed.id) return response({ error: 'Use a valid YouTube playlist URL.' }, 400)
    const songs = await youtubeSongs(parsed.id)
    return response({ provider: parsed.provider, songs })
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Playlist import failed.' }, 500)
  }
})
