# PDF Export - Quick Reference

## 🚀 One-Click Exports

```
┌─────────────────────────────────────────────────┐
│               EXPORT OPTIONS                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  📄 PDF (Detailed)     →  Full documentation   │
│     • All item details                          │
│     • Section, question, options, notes        │
│     • Confidence scores & timestamps           │
│     • Multi-page with page numbers             │
│     • File: fusion-checklist.pdf               │
│                                                 │
│  📊 PDF (Table)        →  Quick overview       │
│     • Compact table layout                     │
│     • All items at a glance                    │
│     • Green header, alternating rows           │
│     • 7 columns (#, Type, Section, etc.)       │
│     • File: fusion-checklist-table.pdf         │
│                                                 │
│  💾 JSON               →  Data backup          │
│     • Complete data structure                  │
│     • All metadata preserved                   │
│     • Machine-readable                         │
│     • File: fusion-results.json                │
│                                                 │
│  📋 Clipboard          →  Quick share          │
│     • Plain text format                        │
│     • Paste anywhere                           │
│     • Instant copy                             │
│     • Copies to clipboard                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 📋 PDF Detailed Example

```
════════════════════════════════════════════
    Fused Certification Checklist
    Generated: Nov 10, 2025, 10:30 AM
    Total Items: 3 | Fused: 2 | Separate: 1
════════════════════════════════════════════

1. AI Fused
   10:30 AM | Confidence: 92% (very_high)
   ────────────────────────────────────────
   Section: A.1.1
   Question: Is the product certified?
   Status: Mandatory
   Options:
   • Yes (from both)
   • No (from both)
   Notes: [Yellow highlight] Combined req.
   ────────────────────────────────────────

2. Manual
   10:32 AM
   ────────────────────────────────────────
   Section: A.2.3
   Question: License agreement required
   Status: Conditional
   Options:
   • Signed
   • Pending
   ────────────────────────────────────────

                Page 1 of 1
```

## 📊 PDF Table Example

```
┌────┬──────────┬─────────┬───────────────┬──────────┬──────┬────┐
│ #  │ Type     │ Section │ Question      │ Status   │Conf. │Opt.│
├────┼──────────┼─────────┼───────────────┼──────────┼──────┼────┤
│ 1  │ AI Fused │ A.1.1   │Is product...  │Mandatory │ 92%  │ 2  │
│ 2  │ Manual   │ A.2.3   │License agr... │Condition.│  -   │ 2  │
│ 3  │ Separate │ N/A     │2 items sep... │    -     │  -   │ 0  │
└────┴──────────┴─────────┴───────────────┴──────────┴──────┴────┘
```

## 💻 Usage

### From UI
1. Process fusions → Results accumulate
2. Scroll to bottom of results list
3. Click desired export button
4. File downloads automatically!

### From Code
```typescript
import { 
  exportFusionResultsAsPDF,
  exportFusionResultsAsTable,
  exportAsJSON,
  copyToClipboard 
} from '@/lib/export-utils'

// Use any format
exportFusionResultsAsPDF(fusionResults)
exportFusionResultsAsTable(fusionResults)
exportAsJSON(fusionResults)
copyToClipboard(fusionResults)
```

## 🎨 Colors

**Detailed PDF:**
- Black text on white
- Gray metadata
- Green status
- Yellow notes background
- Gray separators

**Table PDF:**
- Green header (76, 175, 80)
- White header text
- Light gray alternating rows

## 📁 Files

- `lib/export-utils.ts` - Export functions
- `components/fusion-results-list.tsx` - Export buttons

## ⚡ Quick Tips

✅ **Multi-page:** Auto-adds pages when needed
✅ **Custom names:** Pass filename as 2nd parameter
✅ **All browsers:** Works in Chrome, Firefox, Safari
✅ **No setup:** Just click and download!

## 🎯 When to Use

| Format     | Best For                        |
|------------|---------------------------------|
| Detailed   | Final docs, compliance, archive |
| Table      | Quick review, summaries, mgmt   |
| JSON       | Backup, re-import, integration  |
| Clipboard  | Email, notes, quick share       |

## 🚀 Live Now!

Visit `http://localhost:3001` to try it!

