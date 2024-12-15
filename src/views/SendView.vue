<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'
import QRReader from '@/components/QRReader.vue'
import QRGenerator from '@/components/QRGenerator.vue'
import BaseTextarea from '@/components/BaseTextarea.vue'
import AnimationLoader from '@/components/AnimationLoader.vue'
import { ref, onMounted, watch } from 'vue'
import { generateFilePreviewSenderSide, type FilePreviews } from '@/utils/filePreview'
import { useQRDecodedTextStore } from '@/stores/qr-decoded'
import { formatFileSize } from '@/utils/format-file-size'

const store = useQRDecodedTextStore()
const isScannerOpen = ref(false)
const senderPeer = ref<RTCPeerConnection | null>(null)
const dataChannel = ref<RTCDataChannel | null>(null)
const connected = ref(false)
const isConnecting = ref(false)
const connectionData = ref<string | null>(null)
const answerData = ref<string | null>(null)
const isLoading = ref(true)
const transferPercentage = ref<number>(0)
const transferSpeed = ref<number>(0)
const fileMetadata = ref<{ name: string; type: string; size: number } | null>(null)
const filePreviewsURL = ref<FilePreviews>({
  image: null,
  video: null,
  audio: null,
  pdf: null,
  text: null,
})

onMounted(async () => {
  senderPeer.value = new RTCPeerConnection()

  // Gather all ICE candidates
  const candidates: RTCIceCandidate[] = []
  senderPeer.value.onicecandidate = (event) => {
    if (event.candidate) {
      candidates.push(event.candidate)
    }
  }

  // Create data channel
  dataChannel.value = senderPeer.value.createDataChannel('file')
  dataChannel.value.onopen = () => {
    connected.value = true
    console.log('Data channel opened')
  }
  dataChannel.value.onclose = () => {
    console.log('Data channel closed')
  }

  // Create and set offer
  const offer = await senderPeer.value.createOffer()
  await senderPeer.value.setLocalDescription(offer)

  // Wait briefly to gather ICE candidates
  setTimeout(() => {
    connectionData.value = JSON.stringify({
      offer: senderPeer.value!.localDescription,
      candidates,
    })
    isLoading.value = false
  }, 1000)
})

function updateAnswerData(e: Event) {
  answerData.value = (e.target as HTMLTextAreaElement).value
}

// Handle answer and candidates from receiver
async function connectReceiver(form: HTMLFormElement | Event) {
  const formElement = form instanceof Event ? (form.target as HTMLFormElement) : form

  if (!formElement) return

  formElement.preventDefault?.()

  if (isConnecting.value) return

  if (!answerData.value || !senderPeer.value) {
    console.error('Answer or candidates are missing')
    return
  }

  const { answer, candidates } = JSON.parse(answerData.value || '')

  isConnecting.value = true

  try {
    // Set the remote description
    await senderPeer.value.setRemoteDescription(answer)

    // Add ICE candidates
    for (const candidate of candidates) {
      await senderPeer.value.addIceCandidate(candidate)
    }

    console.log('Receiver connected!')
  } catch (err) {
    console.error('Error connecting:', err)
  } finally {
    isConnecting.value = false
  }
}

let startTime: number
let bytesSent: number

// Send file
function sendFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file && dataChannel.value) {
    if (dataChannel.value.readyState !== 'open') {
      return
    }

    // Generate file preview
    generateFilePreviewSenderSide(file, filePreviewsURL)

    const metadata = { name: file.name, size: file.size, type: file.type }
    fileMetadata.value = metadata
    dataChannel.value.send(JSON.stringify(metadata))

    let CHUNK_SIZE = 16 * 1024 // 16 KB per chunk
    const MAX_BUFFER_SIZE = 64 * 1024 // 64 KB buffer limit to start pausing
    let offset = 0

    // Initialize speed tracking
    startTime = Date.now()
    bytesSent = 0

    const reader = new FileReader()

    // Function to read and send the next chunk
    function readNextChunk() {
      const slice = file?.slice(offset, offset + CHUNK_SIZE)
      reader.readAsArrayBuffer(slice as Blob)
    }

    reader.onload = async () => {
      if (reader.result instanceof ArrayBuffer) {
        const buffer = reader.result

        // Handle backpressure (pause sending if the buffer is full)
        await waitForBuffer(dataChannel.value as RTCDataChannel, MAX_BUFFER_SIZE)

        dataChannel.value!.send(buffer)
        bytesSent += CHUNK_SIZE
        offset += CHUNK_SIZE

        const progress = Math.min((offset / file.size) * 100, 100).toFixed(2)
        transferPercentage.value = Number(progress)

        // Adjust chunk size dynamically every second
        if (Date.now() - startTime >= 1000) {
          const elapsedTime = (Date.now() - startTime) / 1000 // seconds
          const speed = bytesSent / elapsedTime // bytes per second
          transferSpeed.value = speed

          // Adjust chunk size dynamically
          if (speed > 512 * 1024) {
            CHUNK_SIZE = Math.min(CHUNK_SIZE * 2, 256 * 1024) // Increase to a max of 256KB
          } else if (speed < 128 * 1024) {
            CHUNK_SIZE = Math.max(CHUNK_SIZE / 2, 16 * 1024) // Decrease to a minimum of 16KB
          }

          // Reset speed tracking
          startTime = Date.now()
          bytesSent = 0
        }

        if (offset < file.size) {
          readNextChunk()
        } else {
          console.log('File transfer complete!')
        }
      }
    }

    reader.onerror = () => {
      console.error('Error reading file:', reader.error)
    }

    readNextChunk()
  }
}

// Utility to pause sending if buffer is too full
function waitForBuffer(dataChannel: RTCDataChannel, maxBufferSize: number) {
  return new Promise<void>((resolve) => {
    const checkBuffer = () => {
      if (dataChannel.bufferedAmount < maxBufferSize) {
        resolve()
      } else {
        console.warn(`BufferedAmount (${dataChannel.bufferedAmount}) exceeds limit (${maxBufferSize}), pausing...`)
        setTimeout(checkBuffer, 50) // Check every 50ms
      }
    }
    checkBuffer()
  })
}

function copyToClipboard() {
  if (connectionData.value) {
    navigator.clipboard.writeText(connectionData.value)
  }
}

// Watch the store's qrDecodedText to update `answerData`
watch(
  () => store.qrDecodedText,
  () => (answerData.value = store.qrDecodedText),
  { immediate: true },
)

// Automatically invoking connectReceiver
watch(answerData, (newAnswer) => {
  if (newAnswer) {
    const formAnswerData = document.querySelector('#formAnswerData') as HTMLFormElement

    if (formAnswerData) {
      connectReceiver(formAnswerData) // Pass the form directly
    }
  }
})
</script>

<template>
  <AnimationLoader v-if="isLoading" />
  <div v-else class="flex justify-center items-center p-2 w-full flex-col">
    <h1 class="mt-3 mb-8 text-center font-semibold text-4xl">Send File</h1>
    <div v-if="!connected" class="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
      <div class="col-span-1 flex flex-col items-center gap-2 border border-black px-2 py-4 rounded-2xl h-fit">
        <p>Scan this QR code with the receiver to connect or paste the connection string below at the receiver.</p>
        <QRGenerator :value="connectionData || ''" :class="'w-full'" />
        <BaseButton @click="copyToClipboard" class="w-full">Copy Connection String</BaseButton>
      </div>
      <div class="col-span-1 flex flex-col items-center gap-2 border border-black px-2 py-4 rounded-2xl h-fit">
        <p>Paste connection string from receiver or scan QR code at Receiver.</p>
        <QRReader v-if="isScannerOpen" class="w-full" />
        <BaseButton @click="isScannerOpen = !isScannerOpen" class="w-full">{{ isScannerOpen ? 'Close Scanner' : 'Open Scanner' }}</BaseButton>
        <form @submit="connectReceiver" class="w-full grid gap-2" id="formAnswerData">
          <BaseTextarea
            placeholder="Paste Answer Connection String Here"
            name="answer"
            class="w-full min-h-[150px]"
            :input="updateAnswerData"
            :value="answerData || ''"
            v-model="answerData"
          ></BaseTextarea>
          <BaseButton type="submit">Connect</BaseButton>
        </form>
      </div>
    </div>

    <div v-if="connected" class="w-full grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
      <div class="col-span-1">
        <label
          v-if="connected"
          class="w-full flex flex-col gap-5 cursor-pointer items-center justify-center border-2 border-dashed border-gray-300 bg-white py-6 rounded-lg shadow-lg"
          for="file"
        >
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="" viewBox="0 0 24 24" class="h-20 fill-gray-600">
              <path
                fill=""
                d="M10 1C9.73478 1 9.48043 1.10536 9.29289 1.29289L3.29289 7.29289C3.10536 7.48043 3 7.73478 3 8V20C3 21.6569 4.34315 23 6 23H7C7.55228 23 8 22.5523 8 22C8 21.4477 7.55228 21 7 21H6C5.44772 21 5 20.5523 5 20V9H10C10.5523 9 11 8.55228 11 8V3H18C18.5523 3 19 3.44772 19 4V9C19 9.55228 19.4477 10 20 10C20.5523 10 21 9.55228 21 9V4C21 2.34315 19.6569 1 18 1H10ZM9 7H6.41421L9 4.41421V7ZM14 15.5C14 14.1193 15.1193 13 16.5 13C17.8807 13 19 14.1193 19 15.5V16V17H20C21.1046 17 22 17.8954 22 19C22 20.1046 21.1046 21 20 21H13C11.8954 21 11 20.1046 11 19C11 17.8954 11.8954 17 13 17H14V16V15.5ZM16.5 11C14.142 11 12.2076 12.8136 12.0156 15.122C10.2825 15.5606 9 17.1305 9 19C9 21.2091 10.7909 23 13 23H20C22.2091 23 24 21.2091 24 19C24 17.1305 22.7175 15.5606 20.9844 15.122C20.7924 12.8136 18.858 11 16.5 11Z"
                clip-rule="evenodd"
                fill-rule="evenodd"
              ></path>
            </svg>
          </div>
          <div>
            <span class="font-normal text-gray-600">Click or Drop to upload file.</span>
          </div>
          <input type="file" id="file" class="hidden" @change="sendFile" :disabled="!connected" />
        </label>
        <h5 v-if="transferPercentage === 100" class="text-green-600 text-center font-semibold text-lg mt-4">
          Success to send file. Select new file to sending again
        </h5>
      </div>

      <div v-if="transferPercentage > 0" class="col-span-1 px-2 py-4 border border-black rounded-2xl">
        <img v-if="filePreviewsURL.image" :src="filePreviewsURL.image" :alt="filePreviewsURL.image" class="w-full" />
        <video v-if="filePreviewsURL.video" :src="filePreviewsURL.video" controls class="w-full"></video>
        <audio v-if="filePreviewsURL.audio" :src="filePreviewsURL.audio" controls class="w-full"></audio>
        <iframe v-if="filePreviewsURL.pdf" :src="filePreviewsURL.pdf" class="w-full min-h-[200px]"></iframe>
        <pre v-if="filePreviewsURL.text" v-html="filePreviewsURL.text" class="w-full"></pre>

        <div v-if="transferPercentage > 0 && transferPercentage < 100" class="mt-4 w-full flex flex-col items-center text-center gap-2">
          <div class="flex justify-between w-full items-center">
            <span class="max-w-[60%] text-nowrap truncate">
              {{ fileMetadata?.name }}
            </span>
            <span>{{ formatFileSize(fileMetadata?.size || 0) }}</span>
          </div>
          <div class="relative w-full h-[8px] rounded-full overflow-hidden bg-gray-300">
            <div class="bg-green-500 h-full" :style="`width: ${transferPercentage}%`"></div>
          </div>
          <div class="flex justify-between w-full items-center">
            <span>Sending - {{ formatFileSize(transferSpeed) }}/s</span>
            <span>{{ transferPercentage }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
