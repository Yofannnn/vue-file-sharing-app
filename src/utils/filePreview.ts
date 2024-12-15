import type { Ref } from 'vue'

export interface FilePreviews {
  image: string | null
  video: string | null
  audio: string | null
  pdf: string | null
  text: string | null
}

export function generateFilePreviewSenderSide(file: File | Blob, previews: Ref<FilePreviews>) {
  const reader = new FileReader()

  reader.onload = (e) => {
    const result = e.target?.result as string
    if (file.type.startsWith('image')) previews.value.image = result
    else if (file.type.startsWith('video')) previews.value.video = result
    else if (file.type.startsWith('audio')) previews.value.audio = result
    else if (file.type === 'application/pdf') previews.value.pdf = result
    else if (file.type.startsWith('text') || file.type.startsWith('application/json')) previews.value.text = result
  }

  if (file.type.startsWith('text') || file.type.startsWith('application/json')) {
    reader.readAsText(file)
  } else {
    reader.readAsDataURL(file)
  }
}

export async function generateFilePreviewReceiverSide(file: Blob | string, filePreviews: Ref<FilePreviews>) {
  if (typeof file === 'string') return

  const fileType = file.type

  if (fileType.startsWith('image/')) {
    filePreviews.value.image = URL.createObjectURL(file)
  } else if (fileType.startsWith('video/')) {
    filePreviews.value.video = URL.createObjectURL(file)
  } else if (fileType.startsWith('audio/')) {
    filePreviews.value.audio = URL.createObjectURL(file)
  } else if (fileType === 'application/pdf') {
    filePreviews.value.pdf = URL.createObjectURL(file)
  } else if (fileType.startsWith('text/')) {
    const textContent = await file.text()
    filePreviews.value.text = textContent
  }
}
