// JSON Schema for OpenAI Structured Outputs
// Defines the structure for Value Finds analysis with three output formats

export const VALUE_FINDS_SCHEMA = {
  type: "object",
  properties: {
    high_value_badges: {
      type: "array",
      description: "3-5 games with strongest edges to badge on game cards",
      items: {
        type: "object",
        properties: {
          game_id: { 
            type: "string",
            description: "Unique game identifier (training_key or unique_id)"
          },
          recommended_pick: { 
            type: "string",
            description: "Brief pick recommendation (e.g., 'Bears -4.5', 'Over 47.5')"
          },
          confidence: { 
            type: "integer", 
            minimum: 1, 
            maximum: 10,
            description: "Confidence score from 1-10"
          },
          tooltip_text: { 
            type: "string",
            description: "One sentence explaining the edge for tooltip display"
          }
        },
        required: ["game_id", "recommended_pick", "confidence", "tooltip_text"],
        additionalProperties: false
      }
    },
    page_header: {
      type: "object",
      description: "Content for page header section at top of NFL/CFB pages",
      properties: {
        summary_text: { 
          type: "string",
          description: "2-3 paragraph overview of today's betting landscape, key themes, weather impacts, public betting trends"
        },
        compact_picks: {
          type: "array",
          description: "3-5 top picks shown as compact widgets in header",
          items: {
            type: "object",
            properties: {
              game_id: { 
                type: "string",
                description: "Unique game identifier"
              },
              matchup: { 
                type: "string",
                description: "Game matchup (e.g., 'Bills @ Chiefs')"
              },
              pick: { 
                type: "string",
                description: "Compact pick text (e.g., 'Chiefs -3.5')"
              }
            },
            required: ["game_id", "matchup", "pick"],
            additionalProperties: false
          }
        }
      },
      required: ["summary_text", "compact_picks"],
      additionalProperties: false
    },
    editor_cards: {
      type: "array",
      description: "3-5 full detail cards for Editors Picks page (can overlap with badges)",
      items: {
        type: "object",
        properties: {
          game_id: { 
            type: "string",
            description: "Unique game identifier"
          },
          matchup: { 
            type: "string",
            description: "Game matchup (e.g., 'Bills @ Chiefs')"
          },
          bet_type: { 
            type: "string", 
            enum: ["spread", "ml", "ou"],
            description: "Type of bet: spread, moneyline (ml), or over/under (ou)"
          },
          recommended_pick: { 
            type: "string",
            description: "Full pick recommendation with line (e.g., 'Kansas City Chiefs -3.5')"
          },
          confidence: { 
            type: "integer", 
            minimum: 1, 
            maximum: 10,
            description: "Confidence score from 1-10"
          },
          key_factors: { 
            type: "array", 
            items: { type: "string" },
            minItems: 3,
            maxItems: 5,
            description: "3-5 concise bullet points explaining the edge"
          },
          explanation: { 
            type: "string",
            description: "2-3 sentences providing detailed reasoning with specific data points"
          }
        },
        required: ["game_id", "matchup", "bet_type", "recommended_pick", "confidence", "key_factors", "explanation"],
        additionalProperties: false
      }
    },
    total_games_analyzed: { 
      type: "integer",
      description: "Total number of games reviewed in the analysis"
    }
  },
  required: ["high_value_badges", "page_header", "editor_cards", "total_games_analyzed"],
  additionalProperties: false
};

