import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface FusionResult {
  type: string
  timestamp: string
  doc1_items: any[]
  doc2_items: any[]
  merged_item?: any
  decision: string
  confidence?: number
  confidence_level?: string
  reason?: string
}

export function exportFusionResultsAsPDF(results: FusionResult[], filename: string = 'fusion-checklist.pdf') {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 20

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Fused Certification Checklist', pageWidth / 2, yPosition, { align: 'center' })
  
  yPosition += 10
  
  // Metadata
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' })
  doc.text(`Total Items: ${results.length}`, pageWidth / 2, yPosition + 5, { align: 'center' })
  
  const fusedCount = results.filter(r => r.type === 'ai_fused' || r.type === 'manual').length
  const separateCount = results.filter(r => r.type === 'kept_separate').length
  doc.text(`Fused: ${fusedCount} | Kept Separate: ${separateCount}`, pageWidth / 2, yPosition + 10, { align: 'center' })
  
  yPosition += 20

  // Process each result
  results.forEach((result, index) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      doc.addPage()
      yPosition = 20
    }

    // Result header
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    
    const resultIcon = result.type === 'ai_fused' ? '🤖' : result.type === 'manual' ? '✍️' : '📋'
    const resultType = result.type === 'ai_fused' ? 'AI Fused' : result.type === 'manual' ? 'Manual' : 'Kept Separate'
    
    doc.text(`${index + 1}. ${resultType}`, 15, yPosition)
    
    // Timestamp and confidence
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    const timestamp = new Date(result.timestamp).toLocaleTimeString()
    let metaText = timestamp
    if (result.confidence) {
      metaText += ` | Confidence: ${result.confidence}% (${result.confidence_level})`
    }
    doc.text(metaText, 15, yPosition + 5)
    doc.setTextColor(0, 0, 0)
    
    yPosition += 12

    if (result.type === 'kept_separate') {
      // Show both separate items with full details
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Document 1 Items:', 20, yPosition)
      yPosition += 6
      
      // Doc 1 items
      result.doc1_items.forEach((item: any, idx: number) => {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        if (item.section) {
          doc.text(`${item.section}`, 25, yPosition)
          yPosition += 5
        }
        
        doc.setFont('helvetica', 'normal')
        if (item.question) {
          const questionLines = doc.splitTextToSize(item.question, pageWidth - 50)
          doc.text(questionLines, 25, yPosition)
          yPosition += questionLines.length * 4 + 2
        }
        
        if (item.status) {
          doc.setFontSize(8)
          doc.text(`Status: ${item.status}`, 25, yPosition)
          yPosition += 4
        }
        
        if (item.options && item.options.length > 0) {
          doc.setFontSize(8)
          doc.text('Options:', 25, yPosition)
          yPosition += 4
          item.options.forEach((opt: any) => {
            const optLabel = opt.label || opt.text || opt
            doc.text(`• ${optLabel}`, 30, yPosition)
            yPosition += 3
          })
          yPosition += 2
        }
        
        yPosition += 3
      })
      
      yPosition += 3
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Document 2 Items:', 20, yPosition)
      yPosition += 6
      
      // Doc 2 items
      result.doc2_items.forEach((item: any, idx: number) => {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        if (item.section) {
          doc.text(`${item.section}`, 25, yPosition)
          yPosition += 5
        }
        
        doc.setFont('helvetica', 'normal')
        if (item.question) {
          const questionLines = doc.splitTextToSize(item.question, pageWidth - 50)
          doc.text(questionLines, 25, yPosition)
          yPosition += questionLines.length * 4 + 2
        }
        
        if (item.status) {
          doc.setFontSize(8)
          doc.text(`Status: ${item.status}`, 25, yPosition)
          yPosition += 4
        }
        
        if (item.options && item.options.length > 0) {
          doc.setFontSize(8)
          doc.text('Options:', 25, yPosition)
          yPosition += 4
          item.options.forEach((opt: any) => {
            const optLabel = opt.label || opt.text || opt
            doc.text(`• ${optLabel}`, 30, yPosition)
            yPosition += 3
          })
          yPosition += 2
        }
        
        yPosition += 3
      })
      
      if (result.reason) {
        yPosition += 2
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(150, 75, 0)
        doc.text('Reason for keeping separate:', 20, yPosition)
        yPosition += 5
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(8)
        const reasonLines = doc.splitTextToSize(result.reason, pageWidth - 40)
        doc.text(reasonLines, 25, yPosition)
        yPosition += reasonLines.length * 4 + 3
      }
    } else if (result.merged_item) {
      // Show merged item details
      const item = result.merged_item

      // Section
      if (item.section) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`Section: ${item.section}`, 20, yPosition)
        yPosition += 6
      }

      // Subsection
      if (item.subsection) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text(`Subsection: ${item.subsection}`, 20, yPosition)
        yPosition += 6
      }

      // Question
      if (item.question) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('Question:', 20, yPosition)
        yPosition += 5
        const questionLines = doc.splitTextToSize(item.question, pageWidth - 40)
        doc.text(questionLines, 25, yPosition)
        yPosition += questionLines.length * 5 + 3
      }

      // Status
      if (item.status) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 100, 0)
        doc.text(`Status: ${item.status}`, 20, yPosition)
        doc.setTextColor(0, 0, 0)
        yPosition += 6
      }

      // Options
      if (item.options && item.options.length > 0) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text('Options:', 20, yPosition)
        yPosition += 5
        
        item.options.forEach((opt: any) => {
          const optLabel = opt.label || opt.text || opt
          const optSource = opt.source ? ` (from ${opt.source})` : ''
          doc.setFontSize(8)
          doc.text(`• ${optLabel}${optSource}`, 25, yPosition)
          yPosition += 4
        })
        yPosition += 2
      }

      // Notes
      if (item.notes) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.setFillColor(255, 255, 200)
        doc.rect(20, yPosition - 3, pageWidth - 40, 2, 'F')
        doc.text('Notes:', 20, yPosition + 2)
        yPosition += 6
        const notesLines = doc.splitTextToSize(item.notes, pageWidth - 45)
        doc.text(notesLines, 25, yPosition)
        yPosition += notesLines.length * 4 + 2
      }

      // Page reference
      if (item.page) {
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(`Page: ${item.page}`, 20, yPosition)
        doc.setTextColor(0, 0, 0)
        yPosition += 5
      }
    }

    // Separator line
    doc.setDrawColor(200, 200, 200)
    doc.line(15, yPosition + 2, pageWidth - 15, yPosition + 2)
    yPosition += 8
  })

  // Footer on last page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Save the PDF
  doc.save(filename)
}

export function exportFusionResultsAsTable(results: FusionResult[], filename: string = 'fusion-checklist-table.pdf') {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Fused Certification Checklist', pageWidth / 2, 15, { align: 'center' })
  
  // Metadata
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 22, { align: 'center' })

  // Prepare table data
  const tableData = results.map((result, index) => {
    const type = result.type === 'ai_fused' ? 'AI Fused' : result.type === 'manual' ? 'Manual' : 'Separate'
    const section = result.merged_item?.section || 'N/A'
    const question = result.merged_item?.question || `${result.doc1_items.length + result.doc2_items.length} items kept separate`
    const status = result.merged_item?.status || '-'
    const confidence = result.confidence ? `${result.confidence}%` : '-'
    const options = result.merged_item?.options?.length || 0

    return [
      (index + 1).toString(),
      type,
      section,
      question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      status,
      confidence,
      options.toString()
    ]
  })

  // Generate table
  autoTable(doc, {
    startY: 28,
    head: [['#', 'Type', 'Section', 'Question/Item', 'Status', 'Confidence', 'Options']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [76, 175, 80],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      2: { cellWidth: 20 },
      3: { cellWidth: 70 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 },
      6: { cellWidth: 15 },
    },
  })

  // Save the PDF
  doc.save(filename)
}

export function exportAsJSON(results: FusionResult[], filename: string = 'fusion-results.json') {
  const dataStr = JSON.stringify(results, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function copyToClipboard(results: FusionResult[]) {
  let text = 'FUSED CERTIFICATION CHECKLIST\n'
  text += '═'.repeat(50) + '\n\n'
  text += `Generated: ${new Date().toLocaleString()}\n`
  text += `Total Items: ${results.length}\n\n`

  results.forEach((result, index) => {
    const type = result.type === 'ai_fused' ? 'AI FUSED' : result.type === 'manual' ? 'MANUAL' : 'KEPT SEPARATE'
    text += `${index + 1}. ${type}\n`
    text += `${'─'.repeat(40)}\n`

    if (result.type !== 'kept_separate' && result.merged_item) {
      const item = result.merged_item
      if (item.section) text += `Section: ${item.section}\n`
      if (item.subsection) text += `Subsection: ${item.subsection}\n`
      if (item.question) text += `Question: ${item.question}\n`
      if (item.status) text += `Status: ${item.status}\n`
      if (item.options && item.options.length > 0) {
        text += `Options:\n`
        item.options.forEach((opt: any) => {
          const optLabel = opt.label || opt.text || opt
          text += `  • ${optLabel}\n`
        })
      }
      if (item.notes) text += `Notes: ${item.notes}\n`
    } else {
      text += `Items kept separate (${result.doc1_items.length + result.doc2_items.length} total)\n`
      if (result.reason) text += `Reason: ${result.reason}\n`
    }

    if (result.confidence) {
      text += `Confidence: ${result.confidence}% (${result.confidence_level})\n`
    }
    
    text += '\n'
  })

  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied to clipboard!')
  })
}
