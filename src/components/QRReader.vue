<script setup lang="ts">
import { QrcodeStream } from 'vue-qrcode-reader'
import { useQRDecodedTextStore } from '@/stores/qr-decoded'

const store = useQRDecodedTextStore()
const setDecodedText = store.setQRDecodedText

const onDecode = (result: string) => {
  setDecodedText(result)
}

const onInit = async (promise: Promise<void>) => {
  try {
    await promise
    console.log('Camera initialized')
  } catch (error) {
    console.error('Camera initialization failed:', error)
  }
}

const onError = (error: Error) => {
  console.error('QR Code Reader Error:', error)
}

function onDetect(detectedCodes: { rawValue: string; [key: string]: unknown }[]) {
  const rawValue = detectedCodes.map((code) => code.rawValue)[0]
  setDecodedText(rawValue)
}
</script>

<template>
  <div class="w-[400px] px-2 pb-6">
    <h1 class="text-center">QR Code Scanner</h1>
    <QrcodeStream @decode="onDecode" @init="onInit" @error="onError" @detect="onDetect" :formats="['qr_code']" :paused="false" />
  </div>
</template>
