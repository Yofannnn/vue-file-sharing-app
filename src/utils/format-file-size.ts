export function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) return `${fileSize} bytes`
  if (fileSize < 1048576) return `${(fileSize / 1024).toFixed(2)} KB`
  if (fileSize < 1073741824) return `${(fileSize / 1048576).toFixed(2)} MB`
  return `${(fileSize / 1073741824).toFixed(2)} GB`
}
