# Fusion UI Components

This document describes the new fusion result display and manual editing UI components.

## Overview

The fusion system now supports two display modes:

1. **AI Fusion Results** - Shows the AI's decision with confidence scores
2. **Manual Fusion Editor** - Allows users to manually create merged items

## Components

### 1. FusionResultDisplay

**Location:** `components/fusion-result-display.tsx`

**Purpose:** Display the AI fusion analysis results with visual indicators and action buttons.

**Features:**
- ✅ Fusion decision display (can fuse / cannot fuse)
- ✅ Confidence score with color-coded badges
- ✅ Confidence levels: very_high (90-100%), high (75-89%), medium (60-74%), low (40-59%), very_low (0-39%)
- ✅ AI explanation text (expandable)
- ✅ Side-by-side source item comparison
- ✅ Fused item preview (when fusable)
- ✅ Action buttons (Accept/Manual Edit/Keep Separate)

**Props:**
```typescript
interface FusionResultDisplayProps {
  fusionResponse: {
    success: boolean
    fusion_decision: {
      can_fuse: boolean           // AI decision
      confidence_score: number    // 0-100
      confidence_level: string    // "very_high" | "high" | "medium" | "low" | "very_low"
      should_auto_apply: boolean  // Recommended auto-application
      explanation: string         // AI reasoning
    }
    result: {
      status: string              // "fusable" | "not_fusable"
      merged_item: any | null     // Fused item (if fusable)
      action: string              // Recommended action
    }
    metadata?: {
      processed_at?: string
    }
  }
  doc1Selected: any[]             // Selected items from document 1
  doc2Selected: any[]             // Selected items from document 2
  onManualFuse: () => void        // Open manual editor
  onKeepSeparate: () => void      // Keep items separate
}
```

**Visual Design:**

**When Fusable (can_fuse = true):**
- Green background with checkmark ✓
- Shows confidence badge
- Displays merged item preview with all details
- Buttons: "Accept Fused Item" (green), "Keep Separate" (gray)

**When Not Fusable (can_fuse = false):**
- Orange background with X mark ✗
- Shows confidence badge
- Displays AI explanation
- Buttons: "Manual Fusion Editor" (blue), "Keep Separate" (green, recommended)

**Confidence Colors:**
- 🟢 Very High (90-100%): Green
- 🔵 High (75-89%): Blue
- 🟡 Medium (60-74%): Yellow
- 🟠 Low (40-59%): Orange
- 🔴 Very Low (0-39%): Red

### 2. ManualFusionEditor

**Location:** `components/manual-fusion-editor.tsx`

**Purpose:** Full-screen modal editor for manually creating fused checklist items.

**Features:**
- ✅ Side-by-side source item display (Doc 1 vs Doc 2)
- ✅ Editable merged item fields:
  - Section (e.g., "A.1.2")
  - Subsection (optional)
  - Question/Item text (required)
  - Status (e.g., "Mandatory")
  - Options (selectable from both documents)
  - Notes (optional)
- ✅ Option selection with source tracking
- ✅ Live preview of merged item
- ✅ Validation (required fields)
- ✅ Save/Cancel actions

**Props:**
```typescript
interface ManualFusionEditorProps {
  doc1Items: any[]                // Items from document 1
  doc2Items: any[]                // Items from document 2
  suggestedMerge?: any | null     // AI suggested merge (pre-fill)
  onSave: (mergedItem: any) => void
  onCancel: () => void
}
```

**Merged Item Structure:**
```typescript
{
  section: string               // "A.1.2"
  subsection: string            // "Product Description"
  question: string              // Merged question text
  status: string                // "Mandatory", "Conditional", etc.
  options: Array<{
    label: string
    source: 'doc1' | 'doc2'
    original_doc1?: string
    original_doc2?: string
  }>
  notes: string                 // Additional notes
  fusion_metadata: {
    manually_created: true
    created_at: string          // ISO timestamp
    source_doc1_items: number
    source_doc2_items: number
  }
}
```

## Integration in app/page.tsx

### State Management

```typescript
const [fusionResponse, setFusionResponse] = useState<any>(null)
const [showManualEditor, setShowManualEditor] = useState(false)
const [fusedData, setFusedData] = useState<any>(null)
```

### Workflow

1. **User clicks "Fuse Documents"**
   - Sends selected items to fusion webhook
   - Webhook returns structured response with `fusion_decision`

2. **Display FusionResultDisplay**
   - Shows AI analysis and decision
   - User can:
     - Accept fusion (if fusable)
     - Open manual editor
     - Keep items separate

3. **Manual Fusion (optional)**
   - Opens `ManualFusionEditor` modal
   - User creates custom merged item
   - Saved item added to `fusedData`

4. **Final Result**
   - Either AI-fused item or manually created item
   - Displayed in center panel (Fused Checklist)

### Handler Functions

```typescript
// Called when "Manual Fusion Editor" button clicked
const handleManualFuse = () => {
  setShowManualEditor(true)
}

// Called when manual fusion is saved
const handleSaveManualFusion = (mergedItem: any) => {
  console.log("[v0] Manual fusion saved:", mergedItem)
  setFusedData({
    sections: {
      "Manual Fusions": {
        subsections: {
          "User Created": [mergedItem]
        }
      }
    }
  })
  setShowManualEditor(false)
  setFusionResponse(null)
}

// Called when "Keep Separate" button clicked
const handleKeepSeparate = () => {
  console.log("[v0] Keeping items separate")
  setFusionResponse(null)
  // Items remain in their original documents
}
```

## Response Format Detection

The `handleFuse` function now detects the response format:

```typescript
const rawData = await response.json()

if (rawData.fusion_decision) {
  // NEW FORMAT - Use FusionResultDisplay
  setFusionResponse(rawData)
  setFusedData(null)
} else {
  // OLD FORMAT - Use FusedChecklistDisplay
  const transformedData = transformWebhookResponse(rawData)
  setFusedData(transformedData)
  setFusionResponse(null)
}
```

This ensures backward compatibility with existing fusion workflows.

## UI Flow Diagram

```
┌─────────────────┐
│ User selects    │
│ items & clicks  │
│ "Fuse"          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fusion Webhook  │
│ (AI Analysis)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ FusionResultDisplay                 │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✓ Items Can Be Fused            │ │
│ │ Confidence: 85% (high)          │ │
│ │ AI Explanation: ...             │ │
│ │                                 │ │
│ │ [Accept] [Keep Separate]        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ OR                                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✗ Items Cannot Be Fused         │ │
│ │ Confidence: 60% (medium)        │ │
│ │ AI Explanation: ...             │ │
│ │                                 │ │
│ │ [Manual Editor] [Keep Separate] │ │
│ └─────────────────────────────────┘ │
└──────────┬──────────────────────────┘
           │
           ├──[Accept]──────────────────┐
           │                            │
           ├──[Manual Editor]───────┐   │
           │                        │   │
           │              ┌─────────▼───▼──────┐
           │              │ ManualFusionEditor  │
           │              │                     │
           │              │ [Edit fields...]    │
           │              │ [Save] [Cancel]     │
           │              └─────────┬───────────┘
           │                        │
           │                        │
           ▼                        ▼
     ┌─────────────────────────────────┐
     │ Fused Item Added to Checklist   │
     │ (Displayed in center panel)     │
     └─────────────────────────────────┘
```

## Styling Guide

### Color Scheme

- **Document 1**: Blue (`bg-blue-50`, `border-blue-300`, `text-blue-900`)
- **Document 2**: Red (`bg-red-50`, `border-red-300`, `text-red-900`)
- **Fused/Merged**: Green (`bg-green-50`, `border-green-300`, `text-green-900`)
- **Confidence Levels**: Green (very_high/high) → Yellow (medium) → Orange/Red (low/very_low)
- **Not Fusable**: Orange (`bg-orange-50`, `border-orange-300`, `text-orange-800`)

### Typography

- **Headers**: `text-xl` or `text-lg`, `font-bold`
- **Body text**: `text-sm` or `text-base`
- **Labels**: `text-xs`, `font-semibold`
- **Muted text**: `text-slate-600` or `text-slate-400`

### Spacing

- **Panel padding**: `p-4` or `p-6`
- **Card spacing**: `space-y-3` or `space-y-4`
- **Button gaps**: `gap-3`
- **Grid gaps**: `gap-4` or `gap-6`

## Testing Checklist

### FusionResultDisplay

- [ ] Displays correctly when `can_fuse = true`
- [ ] Displays correctly when `can_fuse = false`
- [ ] Confidence badges show correct colors
- [ ] AI explanation is expandable/collapsible
- [ ] Source items display side-by-side
- [ ] Merged item preview shows all fields
- [ ] "Accept" button works
- [ ] "Manual Editor" button opens modal
- [ ] "Keep Separate" button clears display

### ManualFusionEditor

- [ ] Modal opens full-screen
- [ ] Source items display correctly
- [ ] All input fields are editable
- [ ] Option checkboxes work
- [ ] Preview updates in real-time
- [ ] Required field validation works
- [ ] "Save" button creates merged item
- [ ] "Cancel" button closes modal
- [ ] Saved item has correct structure

## Future Enhancements

### Potential Features

1. **Batch Fusion**: Process multiple item pairs at once
2. **Fusion History**: Track all fusion decisions and allow undo
3. **Templates**: Save common fusion patterns
4. **Export**: Download fused checklist as PDF/Excel
5. **Confidence Threshold**: Allow users to set auto-apply threshold
6. **Diff View**: Highlight differences between source items
7. **Notes**: Allow users to add notes to fusion decisions
8. **Conflict Resolution**: Better UI for handling conflicting options
9. **Search/Filter**: Find specific items in large checklists
10. **Keyboard Shortcuts**: Quick actions for power users

## Troubleshooting

### FusionResultDisplay not showing

**Issue:** Center panel shows "Select items and click Fuse" even after fusion
**Solution:** Check that `fusionResponse` state is set correctly in `handleFuse`

### Manual editor not saving

**Issue:** Clicking "Save" doesn't add item to fusedData
**Solution:** Verify `handleSaveManualFusion` is updating state correctly

### Confidence badge wrong color

**Issue:** Badge color doesn't match confidence level
**Solution:** Check `getConfidenceColor()` function mapping

### Options not selectable

**Issue:** Checkboxes in manual editor don't work
**Solution:** Verify `toggleOption()` function and `selectedOptions` state

### Old format still using FusedChecklistDisplay

**Issue:** New fusion format not detected
**Solution:** Check webhook response has `fusion_decision` field

## Related Files

- `app/page.tsx` - Main integration
- `components/fusion-result-display.tsx` - AI result viewer
- `components/manual-fusion-editor.tsx` - Manual editing modal
- `components/fused-checklist-display.tsx` - Old format display (kept for backward compatibility)
- `n8n-parse-ai-output-enhanced.js` - n8n response parser
- `FUSION_OUTPUT_FORMAT.md` - Response format documentation
- `N8N_PARSER_GUIDE.md` - Parser usage guide

