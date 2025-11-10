// n8n Code Node: Batch Fusion Output Parser
// Use this when processing multiple item pairs at once

const items = $input.all();

// ========================================
// HELPER FUNCTIONS
// ========================================

const parseAIOutput = (output) => {
  try {
    if (typeof output === 'string') {
      return JSON.parse(output);
    }
    return output;
  } catch (error) {
    return null;
  }
};

const validateFusionOutput = (output) => {
  const errors = [];
  
  if (typeof output.fusable !== 'boolean') {
    errors.push('Invalid fusable field');
  }
  
  if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 100) {
    errors.push('Invalid confidence field');
  }
  
  if (!output.reason || typeof output.reason !== 'string') {
    errors.push('Missing or invalid reason');
  }
  
  if (output.fusable && output.fused_item === null) {
    errors.push('Fusable is true but fused_item is null');
  }
  
  if (!output.fusable && output.fused_item !== null) {
    errors.push('Fusable is false but fused_item is not null');
  }
  
  return errors;
};

const getConfidenceLevel = (score) => {
  if (score >= 90) return 'very_high';
  if (score >= 75) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'very_low';
};

// ========================================
// PROCESS ALL ITEMS
// ========================================

const processedResults = [];
const errors = [];
let fusableCount = 0;
let notFusableCount = 0;
let highConfidenceCount = 0;

items.forEach((item, index) => {
  const aiOutput = item.json.output;
  
  // Parse
  const parsed = parseAIOutput(aiOutput);
  if (!parsed) {
    errors.push({
      item_index: index,
      error: 'Failed to parse AI output',
      raw: aiOutput
    });
    return;
  }
  
  // Validate
  const validationErrors = validateFusionOutput(parsed);
  if (validationErrors.length > 0) {
    errors.push({
      item_index: index,
      error: 'Validation failed',
      validation_errors: validationErrors,
      parsed_output: parsed
    });
    return;
  }
  
  // Count statistics
  if (parsed.fusable) {
    fusableCount++;
  } else {
    notFusableCount++;
  }
  
  if (parsed.confidence >= 80) {
    highConfidenceCount++;
  }
  
  // Structure result
  const structuredResult = {
    item_index: index,
    doc1_item_id: item.json.doc1_item?.id || null,
    doc2_item_id: item.json.doc2_item?.id || null,
    
    fusion_decision: {
      can_fuse: parsed.fusable,
      confidence_score: parsed.confidence,
      confidence_level: getConfidenceLevel(parsed.confidence),
      should_auto_apply: parsed.fusable && parsed.confidence >= 80,
      explanation: parsed.reason
    },
    
    result: parsed.fusable ? {
      status: 'fused',
      merged_item: parsed.fused_item
    } : {
      status: 'not_fusable',
      merged_item: null
    }
  };
  
  processedResults.push(structuredResult);
});

// ========================================
// BUILD FINAL RESPONSE
// ========================================

const finalResponse = {
  success: errors.length === 0,
  timestamp: new Date().toISOString(),
  
  summary: {
    total_items_processed: items.length,
    successful: processedResults.length,
    failed: errors.length,
    
    fusion_stats: {
      fusable_pairs: fusableCount,
      not_fusable_pairs: notFusableCount,
      high_confidence_decisions: highConfidenceCount,
      fusion_rate: items.length > 0 ? ((fusableCount / items.length) * 100).toFixed(1) + '%' : '0%'
    }
  },
  
  results: processedResults,
  
  errors: errors.length > 0 ? errors : undefined,
  
  metadata: {
    ai_agent: 'checklist-fusion-analyzer',
    processed_at: new Date().toISOString(),
    batch_size: items.length
  }
};

// ========================================
// RETURN
// ========================================

return {
  json: finalResponse
};
