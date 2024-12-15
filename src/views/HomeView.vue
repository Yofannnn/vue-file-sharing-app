<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main>
    <div class="w-full h-svh flex justify-center items-center gap-2">
      <RouterLink to="/send" class="text-black border-2 border-black rounded-full px-6 py-2"
        >Send File</RouterLink
      >
      <RouterLink to="/receive" class="text-black border-2 border-black rounded-full px-6 py-2"
        >Receive File</RouterLink
      >
    </div>
  </main>
</template>
