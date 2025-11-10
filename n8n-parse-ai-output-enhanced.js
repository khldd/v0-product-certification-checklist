// n8n Code Node: Enhanced AI Fusion Output Parser
// Use this for single item pair fusion

const aiOutput = $input.first().json.output;

// ========================================
// 1. PARSE AI OUTPUT
// ========================================
let parsedOutput;
try {
  if (typeof aiOutput === 'string') {
    parsedOutput = JSON.parse(aiOutput);
  } else {
    parsedOutput = aiOutput;
  }
} catch (error) {
  return {
    json: {
      success: false,
      error: "Invalid JSON from AI agent",
      error_details: error.message,
      raw_output: aiOutput
    }
  };
}

// ========================================
// 2. VALIDATE STRUCTURE
// ========================================
const validationErrors = [];

if (typeof parsedOutput.fusable !== 'boolean') {
  validationErrors.push('Missing or invalid field: fusable (must be boolean)');
}

if (typeof parsedOutput.confidence !== 'number') {
  validationErrors.push('Missing or invalid field: confidence (must be number)');
} else if (parsedOutput.confidence < 0 || parsedOutput.confidence > 100) {
  validationErrors.push('Confidence must be between 0 and 100');
}

if (!parsedOutput.reason || typeof parsedOutput.reason !== 'string') {
  validationErrors.push('Missing or invalid field: reason (must be string)');
}

// Check fusable logic consistency
if (parsedOutput.fusable === true && parsedOutput.fused_item === null) {
  validationErrors.push('Inconsistent: fusable=true but fused_item is null');
}

if (parsedOutput.fusable === false && parsedOutput.fused_item !== null) {
  validationErrors.push('Inconsistent: fusable=false but fused_item is not null');
}

if (validationErrors.length > 0) {
  return {
    json: {
      success: false,
      error: "AI output validation failed",
      validation_errors: validationErrors,
      raw_output: parsedOutput
    }
  };
}

// ========================================
// 3. DETERMINE CONFIDENCE LEVEL
// ========================================
const getConfidenceLevel = (score) => {
  if (score >= 90) return 'very_high';
  if (score >= 75) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'very_low';
};

// ========================================
// 4. STRUCTURE FINAL RESPONSE
// ========================================
const finalResponse = {
  // High-level status
  success: true,
  timestamp: new Date().toISOString(),
  
  // Fusion decision
  fusion_decision: {
    can_fuse: parsedOutput.fusable,
    confidence_score: parsedOutput.confidence,
    confidence_level: getConfidenceLevel(parsedOutput.confidence),
    should_auto_apply: parsedOutput.fusable && parsedOutput.confidence >= 80,
    explanation: parsedOutput.reason
  },
  
  // Result data
  result: parsedOutput.fusable ? {
    status: 'fused',
    merged_item: parsedOutput.fused_item,
    action: 'Use this fused item in the final checklist'
  } : {
    status: 'not_fusable',
    merged_item: null,
    action: 'Keep both items separate in the final checklist'
  },
  
  // Metadata
  metadata: {
    ai_agent: 'checklist-fusion-analyzer',
    processed_at: new Date().toISOString(),
    processing_duration_ms: null // Can be calculated if you track start time
  }
};

// ========================================
// 5. RETURN STRUCTURED RESPONSE
// ========================================
return {
  json: finalResponse
};
