# Railway Deployment Guide

## Quick Deploy

1. **Go to Railway**: https://railway.app/
2. **Sign in** with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. **Select**: `Smarticus81/beverage-pos`

## Required Environment Variables

Set these in Railway Dashboard → Project → Variables:

### Core APIs
```
GROQ_API_KEY=your_groq_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
HUME_API_KEY=your_hume_api_key_here
RIME_API_KEY=your_rime_api_key_here
RIME_TTS_URL=your_rime_tts_endpoint_here
```

### Next.js
```
NEXT_PUBLIC_APP_URL=https://your-app-name.railway.app
```

### Database (Railway will auto-generate)
```
DATABASE_URL=postgresql://...
```

## Post-Deployment

1. **Run database migration**:
   - Railway Dashboard → Project → Service → Deploy Logs
   - Or connect via Railway CLI

2. **Seed database**:
   ```bash
   npm run seed
   ```

3. **Start voice server** (if needed separately):
   - Add as a separate service or background process

## Custom Domain (Optional)

1. Railway Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Update NEXT_PUBLIC_APP_URL

## Monitoring

- Check logs in Railway Dashboard
- Monitor resource usage
- Set up alerts for downtime

## Scaling

Railway auto-scales based on usage. For high traffic:
- Upgrade to Pro plan
- Consider separate services for voice processing
- Use Redis for session management 