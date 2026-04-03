/** Utility function to trigger file downloads in the browser */
export function triggerDownload(filename: string, content: string, mimeType: string): void {

  // Create a blob from the content and trigger a download
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  // Set up the anchor element and trigger the download
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  // Clean up the object URL to free memory
  URL.revokeObjectURL(url)
}
