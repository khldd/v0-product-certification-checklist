# AI Agent Output Format Specification

## JSON Schema

See `fusion-output-schema.json` for the complete JSON Schema definition.

## Simplified Output Structure

```typescript
interface FusionOutput {
  fusable: boolean;              // Can these items be merged?
  confidence: number;            // 0-100 confidence score
  reason: string;                // Why fusable or not fusable
  fused_item: FusedItem | null;  // Merged item (null if not fusable)
}

interface FusedItem {
  id: string;                    // Format: "fusion.section.topic"
  section: string;               // Combined section name
  sous_section: string;          // Combined subsection (or "")
  question: string;              // Unified question
  status: "RN" | "RNE" | null;   // Most restrictive status
  options: Option[];             // Merged options
  notes: string | null;          // Combined notes
  page: string;                  // Format: "doc1: X, doc2: Y"
  sources: Sources;              // Original source tracking
}

interface Option {
  label: string;                 // Unified option text
  source: "doc1" | "doc2" | "both";
  original_doc1: string | null;  // Original doc1 wording
  original_doc2: string | null;  // Original doc2 wording
  checked: boolean | null;       // Checkbox state
}

interface Sources {
  doc1: SourceReference;
  doc2: SourceReference;
}

interface SourceReference {
  id: string;
  section: string;
  sous_section: string;
  question: string;
}
```

## Complete Examples

### Example 1: FUSABLE Items

**Input to AI:**
```json
{
  "doc1_item": {
    "id": "a.fiche-d-information-y-c-annexe",
    "section": "A. Généralités",
    "sous_section": "",
    "question": "Fiche d'information y c. annexe Le Formulaire de données d'exploitation pour entreprises de transformation Bio (BEB-Excel) Lors de l'audit d'admission le BEB-Excel doit être joint RNE",
    "status": null,
    "options": [
      {
        "label": "est disponible et actuel",
        "checked": null
      },
      {
        "label": "n'est plus (complétement) actuel",
        "checked": null
      }
    ],
    "notes": "L'entreprise doit tenir le BEB à jour.",
    "page": 1
  },
  "doc2_item": {
    "id": "a.generalites.beb_excel_disponible_et_a_jour",
    "section": "A",
    "sous_section": "Généralités",
    "question": "BEB-Excel disponible et à jour",
    "status": "RN",
    "options": [
      {
        "label": "Disponible et à jour",
        "checked": true
      },
      {
        "label": "Manquant ou périmé",
        "checked": false
      }
    ],
    "notes": null,
    "page": 1
  }
}
```

**Expected AI Output:**
```json
{
  "fusable": true,
  "confidence": 95,
  "reason": "Both items verify the availability and currency of the BEB-Excel form. Same requirement with equivalent options (available/current vs. missing/outdated). Core compliance check is identical.",
  "fused_item": {
    "id": "fusion.a.generalites.beb_excel",
    "section": "A. Généralités",
    "sous_section": "Généralités",
    "question": "BEB-Excel (Formulaire de données d'exploitation) est disponible et à jour",
    "status": "RN",
    "options": [
      {
        "label": "Disponible et à jour",
        "source": "both",
        "original_doc1": "est disponible et actuel",
        "original_doc2": "Disponible et à jour",
        "checked": null
      },
      {
        "label": "Manquant, périmé ou non à jour",
        "source": "both",
        "original_doc1": "n'est plus (complétement) actuel",
        "original_doc2": "Manquant ou périmé",
        "checked": null
      }
    ],
    "notes": "Doc1: L'entreprise doit tenir le BEB à jour. | Lors de l'audit d'admission le BEB-Excel doit être joint.",
    "page": "doc1: 1, doc2: 1",
    "sources": {
      "doc1": {
        "id": "a.fiche-d-information-y-c-annexe",
        "section": "A. Généralités",
        "sous_section": "",
        "question": "Fiche d'information y c. annexe Le Formulaire de données d'exploitation pour entreprises de transformation Bio (BEB-Excel) Lors de l'audit d'admission le BEB-Excel doit être joint RNE"
      },
      "doc2": {
        "id": "a.generalites.beb_excel_disponible_et_a_jour",
        "section": "A",
        "sous_section": "Généralités",
        "question": "BEB-Excel disponible et à jour"
      }
    }
  }
}
```

### Example 2: NOT FUSABLE Items

**Input to AI:**
```json
{
  "doc1_item": {
    "id": "a.fiche-d-information-y-c-annexe",
    "section": "A. Généralités",
    "sous_section": "",
    "question": "Fiche d'information y c. annexe Le Formulaire de données d'exploitation pour entreprises de transformation Bio (BEB-Excel) Lors de l'audit d'admission le BEB-Excel doit être joint RNE",
    "status": null,
    "options": [
      {
        "label": "est disponible et actuel",
        "checked": null
      },
      {
        "label": "n'est plus (complétement) actuel",
        "checked": null
      }
    ],
    "notes": "L'entreprise doit tenir le BEB à jour.",
    "page": 1
  },
  "doc2_item": {
    "id": "a.tous-les-produits-marques-migros-bio-sont-certifies-et-la",
    "section": "A. Produits Migros-Bio",
    "sous_section": "",
    "question": "Tous les produits marqués Migros-Bio sont certifiés et la liste de produits est",
    "status": "RN",
    "options": [
      {
        "label": "complète",
        "checked": false
      },
      {
        "label": "n'est pas complète",
        "checked": true
      }
    ],
    "notes": null,
    "page": 1
  }
}
```

**Expected AI Output:**
```json
{
  "fusable": false,
  "confidence": 98,
  "reason": "Items check fundamentally different requirements. Doc1 verifies BEB-Excel operational form availability. Doc2 verifies Migros-Bio product certification completeness. Different domains (operational documentation vs. product certification), different audit objectives, no semantic overlap.",
  "fused_item": null
}
```

### Example 3: Partial Match (Low Confidence)

**Input to AI:**
```json
{
  "doc1_item": {
    "id": "c.les-materiaux-d-emballage",
    "section": "C. Matériaux d'emballage",
    "question": "Les matériaux d'emballage respectent les directives Bio Suisse",
    "status": "RN",
    "options": [
      {
        "label": "respectent les directives",
        "checked": null
      },
      {
        "label": "ne respectent pas les directives",
        "checked": null
      }
    ]
  },
  "doc2_item": {
    "id": "d.emballage-bio-suisse-approuve",
    "section": "D. Déclaration",
    "question": "L'emballage a été approuvé par Bio Suisse",
    "status": "RN",
    "options": [
      {
        "label": "Approuvé",
        "checked": null
      },
      {
        "label": "Pas d'approbation",
        "checked": null
      }
    ]
  }
}
```

**Expected AI Output:**
```json
{
  "fusable": false,
  "confidence": 60,
  "reason": "Related but distinct requirements. Doc1 checks general compliance with Bio Suisse packaging guidelines. Doc2 specifically verifies formal approval status. While related to packaging, these are separate verification steps - one checks adherence to rules, the other checks official authorization. Merging would conflate compliance with approval.",
  "fused_item": null
}
```

## Batch Processing Output Format

For processing multiple item pairs at once:

```json
{
  "fusion_results": [
    {
      "doc1_item_id": "a.item-1",
      "doc2_item_id": "a.item-match",
      "match_score": 95,
      "fusable": true,
      "confidence": 92,
      "reason": "...",
      "fused_item": { /* ... */ }
    },
    {
      "doc1_item_id": "a.item-2",
      "doc2_item_id": "b.item-different",
      "match_score": 35,
      "fusable": false,
      "confidence": 88,
      "reason": "...",
      "fused_item": null
    },
    {
      "doc1_item_id": "a.item-3",
      "doc2_item_id": null,
      "match_score": 0,
      "fusable": false,
      "confidence": 100,
      "reason": "No matching item found in doc2",
      "fused_item": null
    }
  ],
  "summary": {
    "total_doc1_items": 45,
    "total_doc2_items": 52,
    "fusable_pairs": 38,
    "unfusable_pairs": 7,
    "unmatched_doc1_items": 7,
    "unmatched_doc2_items": 14,
    "average_confidence": 87.5
  }
}
```

## Validation Rules

The AI agent output MUST satisfy these rules:

1. **fusable field**:
   - ✅ Must be boolean (true/false)
   - ✅ If true, fused_item must be object
   - ✅ If false, fused_item must be null

2. **confidence field**:
   - ✅ Must be number between 0 and 100
   - ✅ Higher = more confident in decision
   - ✅ Typically >80 for clear cases

3. **fused_item.id**:
   - ✅ Must start with "fusion."
   - ✅ Format: "fusion.section.topic_slug"
   - ✅ Use lowercase, hyphens/underscores

4. **fused_item.status**:
   - ✅ Use most restrictive from sources
   - ✅ RN > RNE > null
   - ✅ null if both sources are null

5. **fused_item.options**:
   - ✅ Merge equivalent options
   - ✅ Keep distinct options separate
   - ✅ Track source for each option

6. **fused_item.sources**:
   - ✅ Must include both doc1 and doc2
   - ✅ Preserve original IDs
   - ✅ Keep exact original question text

## n8n Configuration

### In your AI Agent node:

1. **System Prompt**: Use the system prompt from `ai-fusion-prompts.md`

2. **Output Parser**: Set to "JSON"

3. **JSON Schema**: Upload `fusion-output-schema.json`

4. **Validation**: Enable strict mode

5. **Error Handling**: Return null fused_item if parsing fails

### Testing the Output:

```javascript
// n8n Code Node to validate output
const output = $json.output;

// Validate structure
if (typeof output.fusable !== 'boolean') {
  throw new Error('Invalid fusable field');
}

if (output.confidence < 0 || output.confidence > 100) {
  throw new Error('Confidence must be 0-100');
}

if (output.fusable && !output.fused_item) {
  throw new Error('Fusable=true requires fused_item');
}

if (!output.fusable && output.fused_item !== null) {
  throw new Error('Fusable=false requires fused_item=null');
}

if (output.fused_item && !output.fused_item.id.startsWith('fusion.')) {
  throw new Error('Fused item ID must start with "fusion."');
}

return output;
```

## Summary

Use this output format to ensure:
- ✅ Consistent, parseable responses
- ✅ Full traceability to source documents
- ✅ Clear fusion decisions with reasoning
- ✅ Easy integration with frontend display
- ✅ Validation and error handling
