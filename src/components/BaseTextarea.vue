<script setup lang="ts">
interface Props {
  className?: string
  id?: string
  name?: string
  placeholder?: string
  value?: string
  input?: (event: Event) => void
  readonly?: boolean
}

const { className, id, name, placeholder, value, readonly } = defineProps<Props>()

const combineClassNames =
  className + 'resize-y min-h-[120px] p-2 block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm'
</script>

<template>
  <textarea :class="combineClassNames" :id="id" :name="name" :placeholder="placeholder" :value="value" :readonly="readonly" @input="input" />
</template>
