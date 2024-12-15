<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'
import QRReader from '@/components/QRReader.vue'
import QRGenerator from '@/components/QRGenerator.vue'
import BaseTextarea from '@/components/BaseTextarea.vue'
import { ref, onMounted, watch } from 'vue'
import { generateFilePreviewReceiverSide } from '@/utils/filePreview'
import { useQRDecodedTextStore } from '@/stores/qr-decoded'
import { formatFileSize } from '@/utils/format-file-size'

const store = useQRDecodedTextStore()
const peerConnection = ref<RTCPeerConnection | null>(null)
const receivedFile = ref<{ name: string; type: string; size: number } | null>(null)
const receivedFileUrl = ref<string | null>(null)
const connected = ref(false)
const offerData = ref<string | null>('')
const candidateValue = ref('')
const answerData = ref<string | null>(null)
const isScannerOpen = ref(false)
const transferPercentage = ref<number>(0)
const transferSpeed = ref<number>(0)
const filePreviewsURL = ref({
  image: null,
  video: null,
  audio: null,
  pdf: null,
  text: null,
})

onMounted(() => {
  peerConnection.value = new RTCPeerConnection()

  peerConnection.value.ondatachannel = (event) => {
    const channel = event.channel

    channel.onopen = () => {
      connected.value = true
      console.log('Data channel opened')
    }

    const fileBuffer: Uint8Array[] = [] // Store chunks
    let receivedFileSize = 0
    let receivedBytes = 0
    let receiverStartTime = Date.now()

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const metadata = JSON.parse(event.data)
        receivedFile.value = metadata
        receivedBytes = 0 // Reset counter
        // receivedFileSize = 0
        // fileBuffer = [] // Reset buffer for the new file
      } else {
        receivedBytes += event.data.byteLength

        // Calculate and log speed
        if (Date.now() - receiverStartTime >= 1000) {
          const elapsedTime = (Date.now() - receiverStartTime) / 1000 // seconds
          const speed = receivedBytes / elapsedTime // bytes per second
          transferSpeed.value = speed

          // Reset speed tracking
          receiverStartTime = Date.now()
          receivedBytes = 0
        }

        // Binary data (chunk)
        fileBuffer.push(new Uint8Array(event.data))
        receivedFileSize += event.data.byteLength

        // Calculate progress
        const progress = Math.min((receivedFileSize / receivedFile.value!.size) * 100, 100).toFixed(2)
        transferPercentage.value = Number(progress)

        // Check if file is fully received
        if (receivedFileSize === receivedFile.value?.size) {
          const blob = new Blob(fileBuffer, { type: receivedFile.value.type })
          receivedFileUrl.value = URL.createObjectURL(blob)
          console.log('File fully received!')

          // Optionally generate preview
          await generateFilePreviewReceiverSide(blob, filePreviewsURL)
        }
      }
    }

    channel.onclose = () => {
      console.log('Data channel closed')
    }
  }

  // Gather all ICE candidates
  const candidates: RTCIceCandidate[] = []
  peerConnection.value.onicecandidate = (event) => {
    if (event.candidate) {
      candidates.push(event.candidate)
    }
  }
  candidateValue.value = JSON.stringify(candidates)
})

function updateOfferData(e: Event) {
  offerData.value = (e.target as HTMLTextAreaElement).value
}

// Set offer and create answer
async function connectSender(form: HTMLFormElement | Event) {
  const formElement = form instanceof Event ? (form.target as HTMLFormElement) : form

  if (!formElement) return

  formElement.preventDefault?.()

  if (!offerData.value || !peerConnection.value) {
    console.error('Offer data is missing')
    return
  }

  const { offer, candidates: senderCandidates } = JSON.parse(offerData.value)
  await peerConnection.value.setRemoteDescription(offer)

  for (const candidate of senderCandidates) {
    await peerConnection.value.addIceCandidate(candidate)
  }

  const answer = await peerConnection.value.createAnswer()
  await peerConnection.value.setLocalDescription(answer)

  const response = {
    answer: peerConnection.value.localDescription,
    candidates: JSON.parse(candidateValue.value),
  }

  answerData.value = JSON.stringify(response)
}

function copyToClipboard() {
  if (answerData.value) {
    navigator.clipboard.writeText(answerData.value)
  }
}

// Watch the store's qrDecodedText to update `offerData`
watch(
  () => store.qrDecodedText,
  () => (offerData.value = store.qrDecodedText),
  { immediate: true },
)

// Automatically invoking connectSender
watch(offerData, () => {
  if (offerData.value) {
    const formOfferData = document.querySelector('#formOfferData') as HTMLFormElement
    if (formOfferData) {
      connectSender(formOfferData)
    }
  }
})
</script>

<template>
  <div class="p-2 flex flex-col justify-center items-center w-full">
    <h1 class="mt-3 mb-8 text-center font-semibold text-4xl">Receiver</h1>

    <div v-if="!answerData && !connected" class="w-full sm:w-[550px] grid gap-2 border border-black px-2 py-4 rounded-2xl">
      <p class="text-center">Paste connection string from sender or scan QR code.</p>
      <QRReader v-if="isScannerOpen" class="w-full" />
      <BaseButton @click="isScannerOpen = !isScannerOpen" class="w-full">{{ isScannerOpen ? 'Close Scanner' : 'Open Scanner' }}</BaseButton>
      <form @submit="connectSender" class="w-full grid gap-2" id="formOfferData">
        <BaseTextarea
          placeholder="Paste Offer Connection String Here"
          class="w-full min-h-[150px]"
          :input="updateOfferData"
          :value="offerData || ''"
          v-model="offerData"
        ></BaseTextarea>
        <BaseButton type="submit">Connect</BaseButton>
      </form>
    </div>

    <div v-if="answerData && !connected" class="w-full sm:w-[550px] grid gap-2 border border-black px-2 py-4 rounded-2xl">
      <p class="text-center">Scan this QR code with the sender to connect or paste the connection string below at the sender.</p>
      <QRGenerator :value="answerData || ''" :class="'w-full'" />
      <BaseButton @click="copyToClipboard">Copy Connection String</BaseButton>
    </div>

    <div v-if="connected" class="w-full sm:w-[550px] flex flex-col items-center text-center gap-4 px-2 py-4 border border-black rounded-2xl h-fit">
      <p v-if="transferPercentage < 1">Waiting for file...</p>

      <div v-if="transferPercentage !== 100 && transferPercentage > 0" class="flex flex-col items-center gap-2 w-full text-center">
        <div class="flex justify-between w-full items-center">
          <span class="max-w-[60%] text-nowrap truncate">{{ receivedFile?.name }}</span>
          <span>{{ formatFileSize(receivedFile?.size || 0) }}</span>
        </div>
        <div class="relative w-full h-[8px] rounded-full overflow-hidden bg-gray-300">
          <div class="bg-green-500 h-full" :style="`width: ${transferPercentage}%`"></div>
        </div>
        <div class="flex justify-between w-full items-center">
          <span class="text-sm">Loading - {{ formatFileSize(transferSpeed) }}/s</span>
          <span>{{ transferPercentage }}%</span>
        </div>
      </div>

      <img v-if="filePreviewsURL.image" :src="filePreviewsURL.image" :alt="filePreviewsURL.image" class="w-full" />
      <video v-if="filePreviewsURL.video" :src="filePreviewsURL.video" controls class="w-full"></video>
      <audio v-if="filePreviewsURL.audio" :src="filePreviewsURL.audio" controls class="w-full"></audio>
      <iframe v-if="filePreviewsURL.pdf" :src="filePreviewsURL.pdf" class="w-full min-h-[200px]"></iframe>
      <pre v-if="filePreviewsURL.text" v-html="filePreviewsURL.text" class="w-full"></pre>

      <div v-if="receivedFile && transferPercentage === 100" class="w-full">
        <div class="mb-6 -mt-2 flex justify-between w-full items-center">
          <span class="max-w-[60%] text-nowrap truncate">{{ receivedFile.name }}</span>
          <span>{{ formatFileSize(receivedFile.size) }}</span>
        </div>
        <a
          v-if="receivedFileUrl"
          :href="receivedFileUrl"
          :download="receivedFile.name"
          class="w-full inline-block px-6 py-2 rounded-lg border border-black hover:bg-black hover:text-white transition duration-200 ease-in-out"
          >Download File</a
        >
      </div>
    </div>
  </div>
</template>
