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
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 10

    // Title
    doc.setFontSize(16)
    doc.text("Fused Certification Checklist", pageWidth / 2, yPosition, { align: "center" })
    yPosition += 10

    // Timestamp
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: "center" })
    yPosition += 8

    doc.setTextColor(0)

    // Sections
    const sections = data.sections || {}
    Object.entries(sections).forEach(([sectionId, section]: [string, any]) => {
      // Section Title
      if (yPosition > pageHeight - 40) {
        doc.addPage()
        yPosition = 10
      }

      doc.setFontSize(12)
      doc.setFont(undefined, "bold")
      doc.text(sectionId, 10, yPosition)
      yPosition += 6

      doc.setFontSize(10)
      doc.setFont(undefined, "normal")

      // Items
      section.items?.forEach((item: any, idx: number) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage()
          yPosition = 10
        }

        const itemKey = `${sectionId}-${idx}`
        const selectedText = editingItems[itemKey] || item.fused

        const lines = doc.splitTextToSize(`• ${selectedText}`, pageWidth - 20)
        doc.text(lines, 10, yPosition)
        yPosition += lines.length * 4 + 2
      })

      yPosition += 4
    })

    doc.save(`fused-checklist-${Date.now()}.pdf`)
  }

  return {
    exportJSON,
    exportPDF,
  }
}
