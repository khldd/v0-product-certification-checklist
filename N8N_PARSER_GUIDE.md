# n8n AI Output Parser Guide

## Overview

These JavaScript code nodes parse and structure the AI agent's fusion output before sending the webhook response. They provide validation, error handling, and a clean, consistent output format.

## Files

1. **`n8n-parse-ai-output.js`** - Basic parser with validation
2. **`n8n-parse-ai-output-enhanced.js`** - Enhanced with confidence levels and recommendations
3. **`n8n-parse-ai-output-batch.js`** - Batch processing for multiple item pairs

## n8n Workflow Setup

### Single Item Fusion Workflow

```
┌─────────────────┐
│ Webhook Trigger │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract Items   │ (Get doc1_item and doc2_item from body)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Agent Node   │ (Use prompts from ai-fusion-prompts.md)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Code Node       │ ◄── Use n8n-parse-ai-output-enhanced.js
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Respond to      │
│ Webhook         │
└─────────────────┘
```

### Configuration

#### 1. Webhook Trigger Node
- **Method**: POST
- **Path**: `/webhook-test/8a1abe39-1ef4-4ec9-b9ab-8915c4b38dd6`
- **Response**: Immediately

#### 2. AI Agent Node
- **System Prompt**: Copy from `ai-fusion-prompts.md`
- **User Prompt**: 
```
Please analyze these checklist items:

Document 1: {{ JSON.stringify($json.body.doc1_items[0]) }}
Document 2: {{ JSON.stringify($json.body.doc2_items[0]) }}

Determine if they can be fused following the criteria in your system prompt.
```
- **Output Parser**: JSON
- **Temperature**: 0.3 (for consistency)

#### 3. Code Node (Parser)
- **Language**: JavaScript
- **Code**: Copy from `n8n-parse-ai-output-enhanced.js`

#### 4. Respond to Webhook Node
- **Response Body**: `{{ JSON.stringify($json) }}`
- **Response Headers**:
  - `Content-Type`: `application/json`
  - `Access-Control-Allow-Origin`: `*` (or your frontend URL)

## Output Examples

### Example 1: Not Fusable (from your test)

**AI Agent Raw Output:**
```json
{
  "output": "{\n  \"fusable\": false,\n  \"confidence\": 95,\n  \"reason\": \"The items address different compliance requirements...\",\n  \"fused_item\": null\n}"
}
```

**After Parser (Enhanced):**
```json
{
  "success": true,
  "timestamp": "2025-11-10T12:34:56.789Z",
  "fusion_decision": {
    "can_fuse": false,
    "confidence_score": 95,
    "confidence_level": "very_high",
    "should_auto_apply": false,
    "explanation": "The items address different compliance requirements: Document 1 is focused on the availability and currency of the 'BEB-Excel' (a data reporting form for organic processors), while Document 2 is checking whether all Migros-Bio branded products are certified and if the related product list is complete..."
  },
  "result": {
    "status": "not_fusable",
    "merged_item": null,
    "action": "Keep both items separate in the final checklist"
  },
  "metadata": {
    "ai_agent": "checklist-fusion-analyzer",
    "processed_at": "2025-11-10T12:34:56.789Z",
    "processing_duration_ms": null
  }
}
```

### Example 2: Fusable Items

**AI Agent Raw Output:**
```json
{
  "output": "{\"fusable\": true, \"confidence\": 92, \"reason\": \"Both verify license contract...\", \"fused_item\": {...}}"
}
```

**After Parser:**
```json
{
  "success": true,
  "timestamp": "2025-11-10T12:35:00.000Z",
  "fusion_decision": {
    "can_fuse": true,
    "confidence_score": 92,
    "confidence_level": "very_high",
    "should_auto_apply": true,
    "explanation": "Both verify license contract existence and validity. Same requirement, different wording."
  },
  "result": {
    "status": "fused",
    "merged_item": {
      "id": "fusion.a.contrat_licence",
      "section": "A. Contrat de licence",
      "question": "Le contrat de licence existe, est signé et valide",
      "status": "RN",
      "options": [...],
      "sources": {...}
    },
    "action": "Use this fused item in the final checklist"
  },
  "metadata": {
    "ai_agent": "checklist-fusion-analyzer",
    "processed_at": "2025-11-10T12:35:00.000Z",
    "processing_duration_ms": null
  }
}
```

### Example 3: Validation Error

**When AI returns invalid output:**
```json
{
  "success": false,
  "error": "AI output validation failed",
  "validation_errors": [
    "Missing or invalid field: confidence (must be number)",
    "Inconsistent: fusable=true but fused_item is null"
  ],
  "raw_output": {
    "fusable": true,
    "confidence": "high",
    "reason": "...",
    "fused_item": null
  }
}
```

## Confidence Levels

The parser automatically categorizes confidence scores:

| Score Range | Level | Auto-Apply? | Description |
|-------------|-------|-------------|-------------|
| 90-100 | `very_high` | ✅ Yes | Clear match or clear non-match |
| 75-89 | `high` | ✅ Yes | Strong evidence for decision |
| 60-74 | `medium` | ❌ No | Moderate confidence, review recommended |
| 40-59 | `low` | ❌ No | Uncertain, manual review required |
| 0-39 | `very_low` | ❌ No | Very uncertain, likely error |

## Frontend Integration

### Using the Structured Response

```typescript
// In your Next.js app (page.tsx)

const response = await fetch("https://karim.n8nkk.tech/webhook-test/...", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ doc1_items, doc2_items })
});

const result = await response.json();

if (!result.success) {
  console.error("Fusion failed:", result.error);
  return;
}

// Check if items can be fused
if (result.fusion_decision.can_fuse) {
  console.log(`✅ Items can be fused (${result.fusion_decision.confidence_score}% confidence)`);
  
  // Use the fused item
  const fusedItem = result.result.merged_item;
  
  // Auto-apply if high confidence
  if (result.fusion_decision.should_auto_apply) {
    setFusedData(fusedItem);
  } else {
    // Show to user for review
    showReviewDialog(fusedItem, result.fusion_decision.explanation);
  }
} else {
  console.log(`❌ Items cannot be fused: ${result.fusion_decision.explanation}`);
  // Keep items separate
}
```

## Error Handling

The parser handles these error scenarios:

1. **Invalid JSON**: AI returns malformed JSON string
2. **Missing fields**: Required fields not present
3. **Type mismatches**: Wrong data types
4. **Logic inconsistencies**: fusable=true but fused_item=null
5. **Confidence out of range**: Not 0-100

All errors return a structured error response with details.

## Testing

### Test in n8n

1. Go to your workflow
2. Click "Execute Workflow"
3. Use this test payload:

```json
{
  "doc1_items": [{
    "id": "test-1",
    "section": "A. Test",
    "question": "Test question 1"
  }],
  "doc2_items": [{
    "id": "test-2",
    "section": "A. Test",
    "question": "Test question 2"
  }]
}
```

4. Check the Code Node output
5. Verify the webhook response

## Batch Processing

For processing multiple pairs, use `n8n-parse-ai-output-batch.js`:

**Output includes summary statistics:**
```json
{
  "success": true,
  "summary": {
    "total_items_processed": 45,
    "successful": 43,
    "failed": 2,
    "fusion_stats": {
      "fusable_pairs": 38,
      "not_fusable_pairs": 5,
      "high_confidence_decisions": 40,
      "fusion_rate": "84.4%"
    }
  },
  "results": [...]
}
```

## Customization

### Adjust Auto-Apply Threshold

In the code, change this line:
```javascript
should_auto_apply: parsed.fusable && parsed.confidence >= 80
```

To require higher confidence:
```javascript
should_auto_apply: parsed.fusable && parsed.confidence >= 90
```

### Add Processing Duration

Track timing:
```javascript
const startTime = Date.now();
// ... processing ...
const duration = Date.now() - startTime;

// In metadata:
processing_duration_ms: duration
```

### Add Custom Fields

Extend the response:
```javascript
const finalResponse = {
  // ... existing fields ...
  
  custom: {
    workflow_id: $workflow.id,
    execution_id: $execution.id,
    processed_by: "fusion-agent-v1"
  }
};
```
