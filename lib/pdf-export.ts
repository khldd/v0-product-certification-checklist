/**
 * PDF Export Utility - ProCert Style Checklist
 *
 * Generates a PDF that matches the exact format of ProCert certification checklists
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ChecklistItem {
  id: string
  section: string
  sous_section?: string
  question: string
  status?: string
  options?: Array<{
    label: string
    checked?: boolean
  }>
  notes?: string
  references?: string[]
  page?: number | string
  merged_item?: any
}

interface FusionResult {
  fusion_id?: string
  doc1_items?: ChecklistItem[]
  doc2_items?: ChecklistItem[]
  merged_item?: ChecklistItem
  type?: string
  decision?: string
}

interface ExportData {
  acceptedFusions: FusionResult[]
  rejectedFusions?: FusionResult[]
  unfusedItems: ChecklistItem[]
  metadata?: {
    date?: string
    company?: string
    auditor?: string
  }
}

/**
 * Group items by section for organized display
 */
function groupBySection(items: ChecklistItem[]) {
  const sections: Record<string, ChecklistItem[]> = {}

  items.forEach(item => {
    const sectionKey = item.section || 'Other'
    if (!sections[sectionKey]) {
      sections[sectionKey] = []
    }
    sections[sectionKey].push(item)
  })

  return sections
}

/**
 * Add ProCert-style header to PDF
 */
function addHeader(doc: jsPDF, metadata?: any) {
  const pageWidth = doc.internal.pageSize.width

  // ProCert title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ProCert', 14, 20)

  // Checklist title (centered)
  doc.setFontSize(14)
  doc.text("Checklist d'audit", pageWidth / 2, 20, { align: 'center' })
  doc.text('pour entreprise Bio', pageWidth / 2, 26, { align: 'center' })

  // Info boxes
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  // Date and location box
  doc.rect(14, 32, pageWidth / 2 - 16, 24)
  doc.text('Date, lieu :', 16, 37)

  // Auditor box
  doc.rect(pageWidth / 2 - 2, 32, pageWidth / 2 - 12, 24)
  doc.text('Auditeur(rice) :', pageWidth / 2, 37)

  // Company info box
  doc.rect(14, 56, pageWidth / 2 - 16, 12)
  doc.text('Entreprise :', 16, 61)
  if (metadata?.company) {
    doc.text(metadata.company, 40, 61)
  }

  // Audited person box
  doc.rect(pageWidth / 2 - 2, 56, pageWidth / 2 - 12, 12)
  doc.text('Personne(s) auditée(s), avec fonction :', pageWidth / 2, 61)
  if (metadata?.auditor) {
    doc.text(metadata.auditor, pageWidth / 2 + 70, 61)
  }

  // Product exploitation type
  doc.rect(14, 68, pageWidth - 28, 10)
  doc.text("L'exploitation produit :", 16, 73)
  doc.text('selon directive bio suivante :', pageWidth - 80, 73)

  // Checkboxes for product types
  const checkboxY = 78
  doc.rect(16, checkboxY, 3, 3)
  doc.text('exclusivement des produits bio', 21, checkboxY + 2.5)

  doc.rect(90, checkboxY, 3, 3)
  doc.text('produits bio et conventionnels', 95, checkboxY + 2.5)

  doc.rect(16, checkboxY + 5, 3, 3)
  doc.text("d'autres produits sous label :", 21, checkboxY + 7.5)

  // Bio ordinance checkbox
  doc.rect(pageWidth - 80, checkboxY, 3, 3)
  doc.text('selon ordonnance bio CH', pageWidth - 75, checkboxY + 2.5)

  // Audit type
  doc.text("Type d'audit :", 16, checkboxY + 13)
  doc.rect(45, checkboxY + 10, 3, 3)
  doc.text('Première certification', 50, checkboxY + 13)
  doc.rect(95, checkboxY + 10, 3, 3)
  doc.text('Recertification', 100, checkboxY + 13)

  return 100 // Return Y position where content should start
}

/**
 * Add footer to PDF
 */
function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')

  // Footer line
  doc.setDrawColor(0)
  doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)

  // Footer text
  doc.text(`Original: ProCert`, 14, pageHeight - 10)
  doc.text('☐ Des explications sont obligatoires', 60, pageHeight - 10)
  doc.text('Distributeur: copie sur demande', 130, pageHeight - 10)
  doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - 30, pageHeight - 10)

  // ProCert contact info
  doc.text('ProCert     Marktgasse 65     3011 Bern', 14, pageHeight - 6)
  doc.text('Tel: 031/ 560 67 67', 100, pageHeight - 6)
  doc.text('produkte@procert.ch', pageWidth - 45, pageHeight - 6)
}

/**
 * Export checklist to PDF in ProCert format
 */
export async function exportChecklistToPDF(data: ExportData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height

  // Add header
  let currentY = addHeader(doc, data.metadata)
  currentY += 5

  // Combine all items:
  // 1. Accepted fusions → show merged item
  // 2. Rejected fusions → show original doc1 + doc2 items separately
  // 3. Unfused items → show as-is
  const allItems: ChecklistItem[] = []

  // Add accepted fusions (show merged item only)
  data.acceptedFusions.forEach(fusion => {
    if (fusion.merged_item) {
      allItems.push(fusion.merged_item)
    }
  })

  // Add rejected fusions (show original items separately)
  if (data.rejectedFusions) {
    data.rejectedFusions.forEach(fusion => {
      // Add all doc1 items
      if (fusion.doc1_items) {
        fusion.doc1_items.forEach(item => {
          allItems.push({
            ...item,
            notes: item.notes ? `${item.notes} [Rejected Fusion]` : '[Rejected Fusion]'
          })
        })
      }
      // Add all doc2 items
      if (fusion.doc2_items) {
        fusion.doc2_items.forEach(item => {
          allItems.push({
            ...item,
            notes: item.notes ? `${item.notes} [Rejected Fusion]` : '[Rejected Fusion]'
          })
        })
      }
    })
  }

  // Add unfused items
  allItems.push(...data.unfusedItems)

  // Group by section
  const sections = groupBySection(allItems)
  const sectionKeys = Object.keys(sections).sort()

  let pageNumber = 1
  const totalPages = Math.ceil(allItems.length / 15) // Rough estimate

  // Process each section
  sectionKeys.forEach((sectionKey, sectionIndex) => {
    const items = sections[sectionKey]

    // Section header
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(240, 240, 240)
    doc.rect(14, currentY, pageWidth - 28, 8, 'F')
    doc.text(sectionKey, 16, currentY + 5)
    currentY += 10

    // Process items in this section
    items.forEach((item, itemIndex) => {
      // Check if we need a new page
      if (currentY > pageHeight - 40) {
        addFooter(doc, pageNumber, totalPages)
        doc.addPage()
        pageNumber++
        currentY = addHeader(doc, data.metadata)
        currentY += 5
      }

      // Draw checkbox
      doc.setFontSize(9)
      doc.rect(16, currentY, 3, 3)

      // Draw question text
      doc.setFont('helvetica', 'normal')
      const questionText = item.question || 'No question'
      const splitQuestion = doc.splitTextToSize(questionText, 100)
      doc.text(splitQuestion, 21, currentY + 2.5)

      const questionHeight = splitQuestion.length * 4

      // Draw notes column (right side with light background)
      if (item.notes || item.references) {
        doc.setFillColor(250, 250, 240)
        doc.rect(120, currentY - 1, pageWidth - 134, questionHeight + 2, 'F')

        let notesY = currentY + 2.5

        // Add references if any
        if (item.references && item.references.length > 0) {
          doc.setFont('helvetica', 'bold')
          doc.text(item.references.join(', '), 122, notesY)
          notesY += 4
        }

        // Add notes
        if (item.notes) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          const splitNotes = doc.splitTextToSize(item.notes, pageWidth - 136)
          doc.text(splitNotes, 122, notesY)
        }
      }

      currentY += Math.max(questionHeight, 6) + 2

      // Add options if any
      if (item.options && item.options.length > 0) {
        item.options.forEach((option, optIdx) => {
          doc.rect(18, currentY, 3, 3)
          if (option.checked) {
            doc.text('✓', 18.5, currentY + 2.5)
          }
          doc.setFontSize(8)
          const optionText = doc.splitTextToSize(option.label, 95)
          doc.text(optionText, 23, currentY + 2.5)
          currentY += Math.max(optionText.length * 3.5, 5)
        })
        currentY += 2
      }

      // Draw line separator
      doc.setDrawColor(200)
      doc.line(14, currentY, pageWidth - 14, currentY)
      currentY += 3
    })

    currentY += 5
  })

  // Add footer to last page
  addFooter(doc, pageNumber, totalPages)

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `ProCert_Checklist_Fused_${timestamp}.pdf`

  // Save PDF
  doc.save(filename)

  console.log(`[PDF Export] Generated: ${filename}`)
}
