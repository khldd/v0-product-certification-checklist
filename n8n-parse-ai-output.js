// n8n Code Node: Parse and Structure AI Fusion Output
// Place this AFTER the AI Agent node and BEFORE the webhook response

// Get the AI agent output
const aiOutput = $input.first().json.output;

// Parse the JSON string if it's a string
let parsedOutput;
try {
  if (typeof aiOutput === 'string') {
    parsedOutput = JSON.parse(aiOutput);
  } else {
    parsedOutput = aiOutput;
  }
} catch (error) {
  // If parsing fails, return error response
  return {
    json: {
      success: false,
      error: "Failed to parse AI output",
      raw_output: aiOutput
    }
  };
}

// Validate required fields
const isValid = (
  typeof parsedOutput.fusable === 'boolean' &&
  typeof parsedOutput.confidence === 'number' &&
  typeof parsedOutput.reason === 'string'
);

if (!isValid) {
  return {
    json: {
      success: false,
      error: "Invalid AI output structure",
      missing_fields: {
        fusable: typeof parsedOutput.fusable !== 'boolean',
        confidence: typeof parsedOutput.confidence !== 'number',
        reason: typeof parsedOutput.reason !== 'string'
      },
      raw_output: parsedOutput
    }
  };
}

// Validate confidence range
if (parsedOutput.confidence < 0 || parsedOutput.confidence > 100) {
  parsedOutput.confidence = Math.max(0, Math.min(100, parsedOutput.confidence));
}

// Validate fusable logic
if (parsedOutput.fusable && parsedOutput.fused_item === null) {
  parsedOutput.fusable = false;
  parsedOutput.reason += " [Auto-corrected: fusable=true but fused_item is null]";
}

if (!parsedOutput.fusable && parsedOutput.fused_item !== null) {
  parsedOutput.fused_item = null;
  parsedOutput.reason += " [Auto-corrected: fusable=false but fused_item was not null]";
}

// Structure the final response
const structuredResponse = {
  success: true,
  timestamp: new Date().toISOString(),
  fusion_analysis: {
    fusable: parsedOutput.fusable,
    confidence: parsedOutput.confidence,
    confidence_level: parsedOutput.confidence >= 80 ? 'high' : 
                      parsedOutput.confidence >= 60 ? 'medium' : 'low',
    reason: parsedOutput.reason
  },
  result: parsedOutput.fusable ? {
    type: 'fused',
    fused_item: parsedOutput.fused_item
  } : {
    type: 'not_fusable',
    recommendation: 'Keep items separate in final checklist'
  },
  metadata: {
    ai_model: 'fusion-agent',
    processing_date: new Date().toISOString()
  }
};

return {
  json: structuredResponse
};
