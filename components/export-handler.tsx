"use client"

import jsPDF from "jspdf"

interface ExportHandlerProps {
  data: any
  selections: Record<string, string>
  editingItems: Record<string, string>
}

export function ExportHandler({ data, selections, editingItems }: ExportHandlerProps) {
  const exportJSON = () => {
    const finalData = {
      timestamp: new Date().toISOString(),
      checklist: data,
      selections: selections,
      customEdits: editingItems,
    }

    const json = JSON.stringify(finalData, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `fused-checklist-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - 2 * margin
    let yPosition = margin

    // Helper to check if we need a new page
    const checkPageBreak = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
        return true
      }
      return false
    }

    // Helper to get the final text for an item
    const getFinalText = (itemKey: string, item: any, selection: string) => {
      // Use edited text if exists
      if (editingItems[itemKey]) {
        return editingItems[itemKey]
      }

      // Otherwise use selected option
      switch (selection) {
        case "keep_source_CH":
          return item.original_ch || item.fused_text || item.question
        case "keep_source_BS":
          return item.original_bs || item.fused_text || item.question
        case "keep_both":
          const bsText = item.original_bs || ""
          const chText = item.original_ch || ""
          if (bsText && chText) {
            return `BS: ${bsText} / CH: ${chText}`
          } else if (bsText) {
            return `BS: ${bsText}`
          } else if (chText) {
            return `CH: ${chText}`
          }
          return item.fused_text || item.question
        default:
          return item.fused_text || item.question
      }
    }

    // Header
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("Checklist d'audit Bio - Version Fusionnée", margin, yPosition)
    yPosition += 8

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100)
    doc.text(`Généré le: ${new Date().toLocaleDateString("fr-FR")}`, margin, yPosition)
    yPosition += 10

    doc.setTextColor(0)

    // Table header styling
    const colWidths = {
      section: 15,
      subsection: 45,
      question: 100,
      check: 15,
      notes: 15,
    }

    // Draw table header
    const drawTableHeader = () => {
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, yPosition, contentWidth, 7, "F")

      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")

      let xPos = margin + 2
      doc.text("Sect.", xPos, yPosition + 5)
      xPos += colWidths.section
      doc.text("Sous-section", xPos, yPosition + 5)
      xPos += colWidths.subsection
      doc.text("Exigence / Question", xPos, yPosition + 5)
      xPos += colWidths.question
      doc.text("OK", xPos, yPosition + 5)
      xPos += colWidths.check
      doc.text("Notes", xPos, yPosition + 5)

      yPosition += 7
      doc.setFont("helvetica", "normal")
    }

    drawTableHeader()

    // Process sections
    const sections = data.sections || {}
    Object.entries(sections)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([sectionId, section]: [string, any]) => {
        const subsections = section.subsections || {}

        Object.entries(subsections)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([subsectionName, items]: [string, any]) => {
            items.forEach((item: any, idx: number) => {
              const itemKey = `${sectionId}-${subsectionName}-${idx}`
              const selection = selections[itemKey] || "fusion"
              const questionText = getFinalText(itemKey, item, selection)

              // Estimate height needed for this row
              doc.setFontSize(8)
              const wrappedText = doc.splitTextToSize(questionText, colWidths.question - 4)
              const rowHeight = Math.max(7, wrappedText.length * 3.5 + 2)

              // Check if we need a new page
              if (checkPageBreak(rowHeight + 2)) {
                drawTableHeader()
              }

              // Draw row border
              doc.setDrawColor(200)
              doc.rect(margin, yPosition, contentWidth, rowHeight)

              // Draw vertical lines
              let xPos = margin + colWidths.section
              doc.line(xPos, yPosition, xPos, yPosition + rowHeight)
              xPos += colWidths.subsection
              doc.line(xPos, yPosition, xPos, yPosition + rowHeight)
              xPos += colWidths.question
              doc.line(xPos, yPosition, xPos, yPosition + rowHeight)
              xPos += colWidths.check
              doc.line(xPos, yPosition, xPos, yPosition + rowHeight)

              // Fill content
              doc.setFontSize(8)

              // Section ID (only show once per section, on first item)
              if (idx === 0 && subsectionName === Object.keys(subsections).sort()[0]) {
                doc.setFont("helvetica", "bold")
                doc.text(sectionId, margin + 2, yPosition + 4)
                doc.setFont("helvetica", "normal")
              }

              // Subsection (only show once per subsection)
              if (idx === 0) {
                const subText = doc.splitTextToSize(subsectionName, colWidths.subsection - 4)
                doc.text(subText, margin + colWidths.section + 2, yPosition + 4)
              }

              // Question text
              doc.text(wrappedText, margin + colWidths.section + colWidths.subsection + 2, yPosition + 4)

              // Source badge
              if (item.origine && item.origine.length > 0) {
                const badge = item.origine.join("/")
                doc.setFontSize(6)
                doc.setTextColor(100)
                doc.text(`(${badge})`, margin + colWidths.section + colWidths.subsection + 2, yPosition + rowHeight - 1)
                doc.setFontSize(8)
                doc.setTextColor(0)
              }

              yPosition += rowHeight
            })
          })
      })

    // Footer on each page
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" })
    }

    doc.save(`checklist-fusionne-${Date.now()}.pdf`)
  }

  return {
    exportJSON,
    exportPDF,
  }
}
