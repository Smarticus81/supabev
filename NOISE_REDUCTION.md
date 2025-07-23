# Noise Reduction Configuration

This configuration file controls what gets logged vs. filtered out to ensure high-quality training data.

## Current Filters

### Health Check Spam
- **Issue**: Multiple health_check calls every few seconds
- **Solution**: Only log every 10 seconds, unless there's an error
- **Benefit**: Reduces 90%+ of health check noise

### Cart Polling
- **Issue**: Continuous getCart calls 
- **Solution**: Only log when cart actually changes or every 5 seconds
- **Benefit**: Eliminates redundant cart state logs

### Compilation Cycles
- **Issue**: Repeated compilation messages
- **Solution**: Only log compilation issues or every 30 seconds
- **Benefit**: Focuses on meaningful development events

### Rapid Fire Events
- **Issue**: Same event types firing rapidly
- **Solution**: Max 5 of same event type per 5 minutes
- **Benefit**: Prevents event spam while capturing patterns

## Quality Scoring

Each interaction gets a quality score (0-100):

### High Quality (75-100):
- User-initiated actions
- Voice commands with responses
- Tool usage with results
- Error resolution

### Medium Quality (50-74):
- System responses
- Background processing
- Status updates

### Low Quality (0-49):
- Health checks (filtered)
- Auto-refresh events
- Compilation cycles
- Session heartbeats

Only interactions with score ≥25 get logged for learning.

## Monitoring Commands

```bash
# Check noise reduction stats
npm run learning:noise

# Just show stats
npm run learning:noise -- --stats

# Just show config
npm run learning:noise -- --config

# Check overall learning data quality
npm run learning:stats
```

## Manual Adjustments

To adjust thresholds, edit `lib/noise-filter.js`:

```javascript
this.config = {
  healthCheckInterval: 10000,  // 10 seconds
  rapidFireWindow: 2000,       // 2 seconds  
  maxSameEventPer5Min: 5,      // Max events
  compilationThrottle: 30000,  // 30 seconds
};
```

## Expected Results

With noise filtering active:
- 80-90% reduction in log volume
- Higher quality training data
- Better signal-to-noise ratio
- Faster processing during export
