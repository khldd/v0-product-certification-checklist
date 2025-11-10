// Parse extracted text from PDF into structured checklist items

export interface ParsedChecklistItem {
  id: string
  section: string
  sous_section: string
  question: string
}

export interface ParsedChecklist {
  checklist_unifiee: ParsedChecklistItem[]
  metadata: {
    filename: string
    source: string
  }
}

export function parseChecklistText(extractedText: string, filename: string): ParsedChecklist {
  const items: ParsedChecklistItem[] = []
  
  console.log("[Parser] Starting parse for:", filename)
  console.log("[Parser] Text length:", extractedText.length)
  
  // Remove the outer quotes if present
  let text = extractedText
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1)
  }
  
  // Replace escaped newlines with actual newlines
  text = text.replace(/\\n/g, '\n')
  
  // Split into lines
  const lines = text.split('\n')
  console.log("[Parser] Total lines:", lines.length)
  
  let currentSection = ''
  let currentSubsection = ''
  let itemCounter = 0
  
  // Pattern to detect section headers (A., B., C., etc.)
  const sectionPattern = /^([A-Z])\.\s+(.+)$/
  
  // Pattern to detect checklist items with [ ] or [X] or [pa]
  const checklistPattern = /^\s*(\[[\sXpa]*\])\s*(.+)$/
  
  // Pattern to detect subsections (descriptive text before checklist items)
  const subsectionPattern = /^(.+?):\s*$/
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) continue
    
    // Check for section header
    const sectionMatch = line.match(sectionPattern)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      currentSubsection = sectionMatch[2].trim()
      console.log("[Parser] Found section:", currentSection, "-", currentSubsection)
      continue
    }
    
    // Check for subsection
    const subsectionMatch = line.match(subsectionPattern)
    if (subsectionMatch && line.length < 150) {
      currentSubsection = subsectionMatch[1].trim()
      console.log("[Parser] Found subsection:", currentSubsection)
      continue
    }
    
    // Check for checklist item
    const checklistMatch = line.match(checklistPattern)
    if (checklistMatch) {
      let question = checklistMatch[2].trim()
      
      // Skip very short items, page markers, or ProCert references
      if (question.length < 10 || 
          question.includes('Page ') || 
          question.toLowerCase().includes('procert') ||
          question.includes('Des explications sont obligatoires')) {
        continue
      }
      
      // Collect multi-line questions (next lines that are indented or continuations)
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        // If next line doesn't start with [ ] and is not a section/subsection, it's a continuation
        if (nextLine && 
            !nextLine.match(/^\[[\sXpa]*\]/) && 
            !nextLine.match(/^[A-Z]\./) &&
            nextLine.length > 0 &&
            nextLine.length < 200) {
          question += ' ' + nextLine
          i++
        } else {
          break
        }
      }
      
      itemCounter++
      const id = `${currentSection.toLowerCase()}.${slugify(currentSubsection)}.${slugify(question.substring(0, 50))}_${itemCounter}`
      
      items.push({
        id,
        section: currentSection || 'Other',
        sous_section: currentSubsection || 'General',
        question: question.trim()
      })
    }
  }
  
  console.log("[Parser] Parsed total items:", items.length)
  
  return {
    checklist_unifiee: items,
    metadata: {
      filename,
      source: filename
    }
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 60)
}
