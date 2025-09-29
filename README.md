# StockMarket Predictor Chrome Extension

A powerful Chrome extension that intercepts WebSocket messages from stock market games, trains a statistical prediction model in real-time, and provides intelligent betting recommendations through a beautiful floating UI overlay.

## Features

- 🎯 **Real-time Predictions**: AI-powered recommendations (UP/DOWN/NO_BET) updated every round
- 📊 **Statistical Training**: Exponential decay weighting for recent data importance
- 💰 **Balance Tracking**: Simulates betting with 1% commission, tracks wins/losses/skips
- 🎨 **Beautiful UI**: Draggable, minimizable overlay with gradient styling
- 📈 **Session Analytics**: Win rate, profit/loss tracking, round history
- 📁 **Data Export**: Export session logs to CSV for analysis
- 🔒 **Privacy-First**: All processing local, no external requests
- ⚙️ **Configurable**: Adjustable training windows (20/50/100/200 rounds)

## Installation

### Step 1: Configure Host Permissions

Before loading the extension, you **must** configure the game URL in `manifest.json`:

1. Open `manifest.json` in a text editor
2. Find the two instances of `<GAME_ORIGIN>` (lines 11 and 16)
3. Replace with your game URL, for example:
   - `"https://example.com/*"` for all pages on example.com
   - `"https://game.example.com/stockmarket*"` for specific paths
   - `"*://*.example.com/*"` for all subdomains

**Example:**
```json
"host_permissions": [
  "https://yourgame.com/*"
],
"content_scripts": [
  {
    "matches": ["https://yourgame.com/*"],
    ...
  }
]
```

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the folder containing all extension files
5. The extension icon should appear in your toolbar

### Step 3: Verify Installation

1. Navigate to the stock market game page
2. Open DevTools Console (F12 → Console tab)
3. Look for these messages:
   ```
   [WS Hook] WebSocket successfully hooked
   [Predictor] Initializing StockMarket Predictor v1.0.0
   [Predictor] Page hook injected successfully
   [Predictor] UI created
   ```
4. You should see a floating overlay in the top-right corner

## Usage

### Starting the Predictor

1. Navigate to the game page (with stock market rounds)
2. The overlay appears automatically in the top-right
3. Click **"Start Predictor"** button
4. Wait for 10+ rounds to accumulate training data
5. Recommendations appear after sufficient data

### Understanding Recommendations

**UP** (Green): Model predicts stock will go up (positive percentage)  
**DOWN** (Red): Model predicts stock will go down (negative percentage)  
**NO_BET** (Yellow): Low confidence or high volatility - skip this round

Each recommendation includes:
- **Confidence %**: Probability strength (higher is better)
- **Mode**: Decision logic used (see below)

### Prediction Modes

| Mode | Trigger | Description |
|------|---------|-------------|
| **STANDARD** | Confidence > 55% | Normal operation, standard threshold |
| **AGGRESSIVE** | Confidence > 65% | Very high confidence, strong signal |
| **RECOVERY** | After 2+ losses | Requires 60%+ confidence to bet again |
| **NO_BET** | High volatility | Market too unpredictable, skip round |

### Session Statistics

- **Balance**: Current balance vs starting balance (default $10)
- **Win Rate**: Percentage of bets won (excludes skips)
- **W/L/S**: Wins / Losses / Skips count
- **Change**: Profit/loss percentage from starting balance

### Controls

- **Training Window Selector**: Choose lookback period (20/50/100/200 rounds)
  - Smaller = more reactive to recent trends
  - Larger = more stable, less noise
  
- **Reset Button**: Clear all session data (requires confirmation)

- **Export CSV**: Download session log with round-by-round details

- **Minimize Button**: Collapse/expand overlay (− / +)

- **Drag Header**: Click and drag to reposition overlay

## Testing

### Console Test Script

To test the extension without waiting for real game rounds, paste this into the browser console:

```javascript
// Test function
function sendTestMessage(finalValue, delay = 1000) {
  const history = Array(30).fill(0).map((_, i) => 
    Math.floor((finalValue / 30) * i + (Math.random() - 0.5) * 5)
  );
  history[history.length - 1] = finalValue;
  
  setTimeout(() => {
    window.postMessage({
      source: 'EXT_WS_HOOK',
      payload: JSON.stringify({
        type: 'stockmarket.lastResults',
        args: { history: [history] }
      })
    }, '*');
    console.log(`Test message sent: ${finalValue > 0 ? 'UP' : 'DOWN'} (${finalValue}%)`);
  }, delay);
}

// Send test sequence
sendTestMessage(45, 0);    // UP
sendTestMessage(-32, 2000);  // DOWN
sendTestMessage(28, 4000);   // UP
sendTestMessage(-15, 6000);  // DOWN

console.log('Test sequence started. Watch the overlay for recommendations.');
```

### Expected Results

1. After first message: Overlay shows "INSUFFICIENT_DATA" (need 10+ rounds)
2. Continue sending messages until 10+ rounds accumulated
3. Recommendations should start appearing
4. Win/loss tracking updates when you have a previous recommendation

### Advanced Testing

See `test_messages.js` for comprehensive test suites including:
- Pattern testing (alternating, trends, volatility)
- Win/loss verification
- Mode triggering (STANDARD, AGGRESSIVE, RECOVERY)
- Stress testing (rapid messages)

## How It Works

### WebSocket Hooking

The extension uses a two-part injection system:

1. **page_hook.js** (Page Context):
   - Runs in the same context as the game
   - Wraps native `WebSocket` constructor
   - Intercepts incoming messages without blocking them
   - Forwards messages via `window.postMessage()`

2. **content_script.js** (Extension Context):
   - Listens for messages from page_hook.js
   - Parses and processes game data
   - Isolated from page JavaScript for security

This approach is necessary because content scripts cannot directly access `window.WebSocket` modified by the page.

### Message Parsing

The extension looks for messages with this structure:

```json
{
  "type": "stockmarket.lastResults",
  "args": {
    "history": [
      [0, 5, 10, 15, ..., 45],  // ← First array (RULE: use this one)
      [...],                     // Other historical data
      [...]
    ]
  }
}
```

**Extraction Rule:**
1. Get `args.history[0]` (first array)
2. Get last element: `history[0][history[0].length - 1]`
3. This is the final round percentage
4. Positive = UP, Negative = DOWN

### Statistical Trainer Algorithm

The trainer uses **exponentially weighted probabilities** to give recent rounds more importance:

#### 1. Weight Calculation
```javascript
weight = Math.exp(recencyAlpha * i)
// i = index (0 to windowSize-1)
// recencyAlpha = 0.05 (default)
// Recent rounds have higher weights
```

#### 2. Probability Calculation
```javascript
pUp = (sum of weights for UP rounds) / (sum of all weights)
pDown = (sum of weights for DOWN rounds) / (sum of all weights)
```

#### 3. Volatility Calculation
```javascript
volatility = sqrt(variance of magnitudes)
// High volatility = unpredictable market
```

#### 4. Decision Logic
```
IF losing_streak >= 2:
  mode = RECOVERY
  required_confidence = 0.60
  
IF volatility > 15:
  recommendation = NO_BET
  mode = NO_BET
  
ELSE IF max(pUp, pDown) > 0.65:
  recommendation = UP or DOWN (higher probability)
  mode = AGGRESSIVE
  
ELSE IF max(pUp, pDown) > required_confidence:
  recommendation = UP or DOWN
  mode = STANDARD
  
ELSE:
  recommendation = NO_BET
```

### Balance Tracking

The extension simulates betting with realistic calculations:

**Win:**
```
profit = (magnitude / 100) × betAmount × (1 - commission)
profit = (magnitude / 100) × $1 × 0.99

Example: 45% move, $1 bet
profit = (45 / 100) × $1 × 0.99 = $0.4455
```

**Loss:**
```
loss = betAmount
loss = $1
```

**Skip (NO_BET):**
```
change = $0
```

The balance updates after each round based on whether the prediction was correct.

### Session Persistence

State is saved to `chrome.storage.local` after every update, including:
- Full round history (last 500 rounds if > 1000 accumulated)
- Current balance and stats
- Session log (all rounds with results)
- User preferences (training window, running state)

State is automatically restored when you reload the page.

## Configuration

Edit the `CONFIG` object in `content_script.js` to customize behavior:

```javascript
const CONFIG = {
  defaultBalance: 10,              // Starting balance ($)
  defaultBetAmount: 1,             // Bet size per round ($)
  defaultTrainingWindow: 50,       // Lookback period (rounds)
  volatilityThreshold: 15,         // Skip if volatility > this
  confidenceThreshold: 0.55,       // Minimum confidence (55%)
  commission: 0.01,                // 1% fee on wins
  recencyAlpha: 0.05               // Exponential decay rate
};
```

### Parameter Effects

- **Higher volatilityThreshold**: More willing to bet in uncertain markets
- **Lower confidenceThreshold**: More aggressive betting (more recommendations)
- **Higher recencyAlpha**: More reactive to recent trends (less stable)
- **Larger trainingWindow**: Smoother predictions, less reactive

## File Structure

```
stockmarket-predictor/
├── manifest.json           # Extension configuration (Manifest v3)
├── page_hook.js           # WebSocket interceptor (page context)
├── content_script.js      # Main logic + UI (content script)
├── popup.html             # Extension popup (toolbar icon)
├── README.md              # This file
├── INSTALL_GUIDE.txt      # Quick start guide
├── test_messages.js       # Testing utilities
├── FILE_LIST.txt          # File inventory
└── icons/                 # Extension icons (create these)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Troubleshooting

### Extension not appearing in toolbar

- Check that all files are in the same folder
- Verify Developer mode is enabled in `chrome://extensions/`
- Look for error messages in the Extensions page
- Ensure `manifest.json` is valid JSON (no trailing commas)

### No WebSocket messages detected

**Console shows:** `[WS Hook] WebSocket successfully hooked`  
**But no round data appears**

- Verify you replaced `<GAME_ORIGIN>` in manifest.json with correct URL
- Check that the game actually uses WebSocket (look for `ws://` or `wss://` in Network tab)
- Inspect message structure in Network → WS tab to confirm format matches expected structure
- Try reloading the extension after changing manifest.json

### Recommendations not appearing

**Overlay says:** "Waiting..." or "INSUFFICIENT_DATA"

- Need 10+ rounds of data before predictions start
- Click "Start Predictor" if button shows "Start"
- Check console for error messages
- Verify WebSocket messages are being received (should see "[Predictor] Round complete" messages)

### Balance calculations seem wrong

- Verify `commission` setting in CONFIG (default 1%)
- Check that magnitude is extracted correctly (should be absolute value of final percentage)
- Remember: wins use magnitude-based profit, losses use flat betAmount
- Export CSV to review round-by-round calculations

### UI not draggable

- Click and hold the purple header bar (not the content area)
- Ensure you're not clicking buttons in the header (like minimize button)
- Try refreshing the page to reset UI state

### Performance issues with many rounds

- History is automatically trimmed (keeps last 500 when > 1000 rounds)
- Reduce training window to 20 or 50 for faster processing
- Clear session data with Reset button

## Security & Privacy

- **Read-Only**: Extension only observes WebSocket messages, never modifies them
- **No External Requests**: All processing happens locally in your browser
- **No Data Collection**: Nothing is sent to external servers
- **Local Storage Only**: Uses `chrome.storage.local` (stays on your device)
- **Open Source**: All code is visible and auditable

## Advanced Usage

### Custom Trainer Implementation

To implement your own prediction algorithm:

1. Locate the `generateRecommendation()` function in `content_script.js`
2. Replace the statistical logic with your approach
3. Maintain the same return structure:
```javascript
state.lastRecommendation = {
  recommendation: 'UP' | 'DOWN' | 'NO_BET',
  confidence: 0.0 to 1.0,
  mode: 'YOUR_MODE_NAME',
  pUp: probability,
  pDown: probability,
  volatility: number
};
```

### TensorFlow.js Integration

For machine learning predictions:

1. Add TensorFlow.js to `manifest.json`:
```json
"content_scripts": [{
  "js": [
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs",
    "content_script.js"
  ]
}]
```

2. Train a model on historical data
3. Replace `generateRecommendation()` with model predictions
4. Consider storing model weights in `chrome.storage.local`

## Limitations

- **Minimum Data**: Requires 10+ rounds before generating predictions
- **Direction Only**: Predicts UP/DOWN, not magnitude of change
- **No Guarantee**: Past performance does not guarantee future results
- **Game-Specific**: Designed for specific WebSocket message format
- **Single Game**: Only works on configured domain (set in manifest.json)

## Disclaimer

⚠️ **IMPORTANT: This extension is for educational purposes only.**

- This tool is designed to demonstrate statistical analysis and Chrome extension development
- Gambling and betting carry significant financial risk
- Past patterns do not guarantee future outcomes
- The creators assume no responsibility for financial losses
- Always gamble responsibly and within your means
- Check local laws regarding gambling and automated betting tools

## Version History

**v1.0.0** (Initial Release)
- WebSocket message interception
- Statistical trainer with exponential decay
- Real-time recommendations with confidence scores
- Balance tracking with commission
- Draggable UI overlay
- Session persistence
- CSV export functionality
- Multiple prediction modes

## Support

For issues, questions, or contributions:

1. Check this README first
2. Review INSTALL_GUIDE.txt for setup help
3. Test with `test_messages.js` to isolate issues
4. Check browser console for error messages
5. Verify manifest.json configuration

---

**Built with ❤️ for learning and experimentation**

Happy trading! 📈
