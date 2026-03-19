const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'March Madness Bet Tracker API' });
});

app.post('/api/parse-slip', async (req, res) => {
  const { image, mediaType } = req.body;

  if (!image || !mediaType) {
    return res.status(400).json({ error: 'Missing image or mediaType' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing ANTHROPIC_API_KEY' });
  }

  const SYSTEM_PROMPT = `You are a sports bet slip parser for the 2026 NCAA March Madness tournament.

Analyze the screenshot and extract ALL bets. Separate straight bets from parlays.

Return ONLY a JSON object in this exact format — no markdown, no backticks:
{
  "bets": [
    {
      "team": "team name",
      "opponent": "opponent name if visible",
      "game": "game description",
      "betType": "Moneyline | Spread | Total | Other",
      "odds": "+150 or -110 etc",
      "stake": 25.00,
      "potentialPayout": 62.50
    }
  ],
  "parlays": [
    {
      "sportsbook": "DraftKings",
      "stake": 10.00,
      "potentialPayout": 150.00,
      "legs": [
        { "team": "Duke", "betType": "Moneyline", "odds": "-150" },
        { "team": "Florida", "betType": "Spread -3.5", "odds": "-110" }
      ]
    }
  ]
}

NCAA 2026 tournament teams: Duke, Siena, Ohio State, TCU, Michigan State, North Dakota State, Louisville, South Florida, Kansas, Cal Baptist, St Johns, Northern Iowa, UConn, Furman, UCLA, UCF, Arizona, LIU, Villanova, Utah State, Gonzaga, Kennesaw State, BYU, Texas, Arkansas, Hawaii, Wisconsin, High Point, Purdue, Queens, Miami FL, Missouri, Michigan, Howard, Georgia, Saint Louis, Iowa State, Tennessee State, Kentucky, Santa Clara, Alabama, Hofstra, Texas Tech, Akron, Virginia, Wright State, Tennessee, Miami Ohio, Florida, Prairie View, Iowa, Clemson, Houston, Idaho, Saint Marys, Texas A and M, Illinois, Penn, North Carolina, VCU, Nebraska, Troy, Vanderbilt, McNeese.

Rules:
- A parlay has multiple legs and a combined payout. A straight bet is a single game.
- If there are no parlays, return "parlays": []
- If there are no straight bets, return "bets": []
- Return JSON only. No explanation, no markdown, no backticks.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image }
            },
            {
              type: 'text',
              text: 'Parse all bets and parlays from this screenshot. Return the JSON object only.'
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('Anthropic API error:', err);
    res.status(500).json({ error: 'Failed to contact Anthropic API' });
  }
});

app.listen(PORT, () => {
  console.log(`March Madness Bet Tracker API running on port ${PORT}`);
});
