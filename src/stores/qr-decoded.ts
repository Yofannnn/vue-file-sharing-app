import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useQRDecodedTextStore = defineStore('qr-decoded-text', () => {
  const qrDecodedText = ref<string | null>('')
  const setQRDecodedText = (decodedText: string) => (qrDecodedText.value = decodedText)

  return { qrDecodedText, setQRDecodedText }
})
