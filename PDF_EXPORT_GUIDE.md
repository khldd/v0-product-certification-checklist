# PDF Export Documentation

## Overview

The fusion results can now be exported in multiple formats, with **two PDF layout options** to choose from based on your needs.

## Export Formats Available

### 1. 📄 PDF (Detailed Format)

**Use Case:** Complete documentation with all details

**Layout:**
```
═══════════════════════════════════════
  Fused Certification Checklist
  Generated: Nov 10, 2025, 10:30 AM
  Total Items: 4 | Fused: 3 | Separate: 1
═══════════════════════════════════════

1. AI Fused
   10:30 AM | Confidence: 92% (very_high)
   ─────────────────────────────────────
   Section: A.1.1
   Subsection: Product Certification
   
   Question:
   Is the product certified according to 
   relevant standards?
   
   Status: Mandatory
   
   Options:
   • Yes (from both)
   • No (from both)
   • Not Applicable (from doc2)
   
   Notes:
   Combined requirement from both documents.
   Certification must be valid.
   
   Page: 5
   ─────────────────────────────────────

2. Manual
   10:32 AM
   ─────────────────────────────────────
   Section: A.2.3
   
   Question:
   License agreement must be signed and valid.
   
   Status: Conditional
   
   Options:
   • Signed
   • Pending
   
   ─────────────────────────────────────
```

**Features:**
- ✅ Full item details (section, question, status, options, notes)
- ✅ Confidence scores for AI fusions
- ✅ Timestamps
- ✅ Multi-page support with page numbers
- ✅ Clear visual separators
- ✅ Source tracking for options
- ✅ Highlighted notes (yellow background)

**Function:**
```typescript
exportFusionResultsAsPDF(results, 'my-checklist.pdf')
```

### 2. 📊 PDF (Table Format)

**Use Case:** Quick overview, compact format

**Layout:**
```
═══════════════════════════════════════════════════════
        Fused Certification Checklist
        Generated: Nov 10, 2025, 10:30 AM
═══════════════════════════════════════════════════════

┌────┬──────────┬─────────┬───────────────┬──────────┬────────────┬─────────┐
│ #  │ Type     │ Section │ Question/Item │ Status   │ Confidence │ Options │
├────┼──────────┼─────────┼───────────────┼──────────┼────────────┼─────────┤
│ 1  │ AI Fused │ A.1.1   │ Is the prod...│Mandatory │ 92%        │ 3       │
├────┼──────────┼─────────┼───────────────┼──────────┼────────────┼─────────┤
│ 2  │ Manual   │ A.2.3   │ License agr...│Condition.│ -          │ 2       │
├────┼──────────┼─────────┼───────────────┼──────────┼────────────┼─────────┤
│ 3  │ Separate │ N/A     │ 2 items kep...│ -        │ -          │ 0       │
├────┼──────────┼─────────┼───────────────┼──────────┼────────────┼─────────┤
│ 4  │ AI Fused │ C.2.1   │ Product des...│Mandatory │ 88%        │ 4       │
└────┴──────────┴─────────┴───────────────┴──────────┴────────────┴─────────┘

                        Page 1 of 1
```

**Features:**
- ✅ Compact table layout
- ✅ All items visible at a glance
- ✅ Sortable columns (in future)
- ✅ Green header
- ✅ Alternating row colors
- ✅ Auto-pagination if needed
- ✅ Questions truncated to 100 chars

**Function:**
```typescript
exportFusionResultsAsTable(results, 'checklist-table.pdf')
```

### 3. 💾 JSON Export

**Use Case:** Data backup, API integration, re-import

**Format:**
```json
[
  {
    "type": "ai_fused",
    "timestamp": "2024-11-10T10:30:00.000Z",
    "doc1_items": [...],
    "doc2_items": [...],
    "merged_item": {
      "section": "A.1.1",
      "subsection": "Product Certification",
      "question": "Is the product certified?",
      "status": "Mandatory",
      "options": [
        { "label": "Yes", "source": "both" },
        { "label": "No", "source": "both" }
      ],
      "notes": "Combined requirement",
      "page": "5"
    },
    "decision": "ai_fused",
    "confidence": 92,
    "confidence_level": "very_high"
  },
  ...
]
```

**Features:**
- ✅ Complete data structure
- ✅ All metadata preserved
- ✅ Source items included
- ✅ Machine-readable
- ✅ Can be re-imported

**Function:**
```typescript
exportAsJSON(results, 'results.json')
```

### 4. 📋 Copy to Clipboard

**Use Case:** Quick paste into emails, documents

**Format:**
```
FUSED CERTIFICATION CHECKLIST
══════════════════════════════════════════════════

Generated: Nov 10, 2025, 10:30:00 AM
Total Items: 4

1. AI FUSED
────────────────────────────────────────
Section: A.1.1
Subsection: Product Certification
Question: Is the product certified?
Status: Mandatory
Options:
  • Yes
  • No
  • Not Applicable
Notes: Combined requirement
Confidence: 92% (very_high)

2. MANUAL
────────────────────────────────────────
Section: A.2.3
Question: License agreement must be signed
Status: Conditional
Options:
  • Signed
  • Pending
```

**Features:**
- ✅ Plain text format
- ✅ Easy to paste
- ✅ Readable structure
- ✅ All key details included

**Function:**
```typescript
copyToClipboard(results)
```

## Export Button Locations

### In FusionResultsList Component

```
┌──────────────────────────────────────────────┐
│ Fusion Results                  [Clear All]  │
│ 3 fused • 1 separate • 4 total               │
├──────────────────────────────────────────────┤
│                                              │
│ [Results list here...]                       │
│                                              │
├──────────────────────────────────────────────┤
│ Export Options                               │
│ ┌──────────────────────────────────────────┐ │
│ │ [📄 PDF Detailed] [📊 PDF Table]        │ │
│ │ [💾 JSON] [📋 Copy to Clipboard]        │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

## Usage Examples

### From UI
1. Process multiple fusion decisions
2. Review accumulated results
3. Click desired export button
4. File downloads automatically (or clipboard copied)

### Programmatically

```typescript
import { 
  exportFusionResultsAsPDF, 
  exportFusionResultsAsTable,
  exportAsJSON,
  copyToClipboard 
} from '@/lib/export-utils'

// Detailed PDF
exportFusionResultsAsPDF(fusionResults, 'checklist-detailed.pdf')

// Table PDF
exportFusionResultsAsTable(fusionResults, 'checklist-table.pdf')

// JSON
exportAsJSON(fusionResults, 'backup.json')

// Clipboard
copyToClipboard(fusionResults)
```

## PDF Styling Details

### Detailed PDF

**Typography:**
- Title: 18pt Helvetica Bold
- Headers: 12pt Helvetica Bold
- Body: 10pt Helvetica Normal
- Metadata: 9pt Gray
- Notes: 9pt Italic

**Colors:**
- Headers: Black
- Metadata: Gray (100, 100, 100)
- Status: Green (0, 100, 0)
- Notes background: Yellow (255, 255, 200)
- Separators: Light gray (200, 200, 200)

**Layout:**
- Margins: 15pt left/right
- Line spacing: 5-6pt
- Section spacing: 8pt
- Auto page breaks at 60pt from bottom

### Table PDF

**Colors:**
- Header: Green (76, 175, 80)
- Header text: White (255, 255, 255)
- Alternate rows: Light gray (245, 245, 245)

**Column Widths:**
- #: 10pt
- Type: 20pt
- Section: 20pt
- Question: 70pt (truncated if needed)
- Status: 20pt
- Confidence: 20pt
- Options: 15pt

**Total width:** 175pt (fits A4 portrait)

## File Naming Conventions

### Default Names
- Detailed PDF: `fusion-checklist.pdf`
- Table PDF: `fusion-checklist-table.pdf`
- JSON: `fusion-results.json`

### Custom Names
```typescript
// With custom filename
exportFusionResultsAsPDF(results, 'CH-BS-merged-2024-11-10.pdf')
exportFusionResultsAsTable(results, 'summary-table.pdf')
exportAsJSON(results, 'backup-20241110.json')
```

### Recommended Naming Pattern
```
[Doc1]_[Doc2]_fused_[YYYY-MM-DD]_[format].pdf

Examples:
- CH_BS_fused_2024-11-10_detailed.pdf
- CH_BS_fused_2024-11-10_table.pdf
- CH_BS_fused_2024-11-10.json
```

## Browser Compatibility

✅ **Chrome/Edge:** Full support
✅ **Firefox:** Full support
✅ **Safari:** Full support
⚠️ **IE11:** Not supported (modern browsers only)

## PDF Generation Library

**Library:** jsPDF + jspdf-autotable
**License:** MIT
**Size:** ~150KB (gzipped)

**Installation:**
```bash
npm install jspdf jspdf-autotable
```

## Customization Guide

### Change PDF Title
```typescript
// In lib/export-utils.ts
doc.text('Your Custom Title Here', pageWidth / 2, yPosition, { align: 'center' })
```

### Change Colors
```typescript
// Header color (RGB)
doc.setFillColor(76, 175, 80)  // Green
// Change to blue:
doc.setFillColor(33, 150, 243)
```

### Add Logo
```typescript
// Add before title
const logoData = 'data:image/png;base64,...'
doc.addImage(logoData, 'PNG', 15, 10, 30, 30)
```

### Custom Fonts
```typescript
// Add custom font
doc.addFont('CustomFont.ttf', 'CustomFont', 'normal')
doc.setFont('CustomFont')
```

## Performance Notes

- **Small datasets** (<10 items): Instant
- **Medium datasets** (10-50 items): <1 second
- **Large datasets** (50-100 items): 1-2 seconds
- **Very large** (100+ items): 2-5 seconds

**Recommendation:** For 100+ items, show loading indicator

## Error Handling

```typescript
try {
  exportFusionResultsAsPDF(results)
} catch (error) {
  console.error('PDF export failed:', error)
  alert('Failed to generate PDF. Please try again.')
}
```

## Future Enhancements

### Planned Features
- [ ] Excel export (.xlsx format)
- [ ] Word export (.docx format)
- [ ] Custom templates
- [ ] Batch export (multiple selections)
- [ ] Email integration
- [ ] Cloud save (Google Drive, Dropbox)
- [ ] Print preview
- [ ] PDF password protection
- [ ] Digital signatures

### Custom Template Support
```typescript
// Future API
exportFusionResultsAsPDF(results, {
  template: 'corporate',
  logo: logoUrl,
  colors: {
    primary: '#1976d2',
    secondary: '#757575'
  },
  footer: 'Confidential - Internal Use Only'
})
```

## Troubleshooting

### PDF doesn't download
- Check browser pop-up blocker
- Try different browser
- Check console for errors

### PDF looks wrong
- Clear browser cache
- Update jsPDF library
- Check page orientation settings

### Large files
- Reduce number of items
- Use table format instead of detailed
- Compress images if added

### Clipboard doesn't work
- Browser needs HTTPS or localhost
- Check clipboard permissions
- Use Firefox/Chrome (better support)

## Related Files

- `lib/export-utils.ts` - Export functions
- `components/fusion-results-list.tsx` - Export buttons
- `package.json` - jsPDF dependencies

