<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  children?: string | HTMLElement
  type?: 'button' | 'submit' | 'reset'
  className?: string
  id?: string
  disabled?: boolean
  onClick?: (...args: unknown[]) => void
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const {
  type = 'button',
  className = '',
  id,
  disabled = false,
  onClick,
  variant = 'primary',
  size = 'md',
} = defineProps<Props>()

const classNameBasedOnVariantAndSize = computed(() => {
  const variantClass =
    {
      primary: 'bg-blue-500 text-white',
      secondary: 'bg-gray-500 text-white',
      outline: 'border border-gray-500 text-gray-500',
    }[variant] || ''

  const sizeClass =
    {
      sm: 'px-2 py-1 text-sm rounded-md',
      md: 'px-4 py-2 text-md rounded-md',
      lg: 'px-6 py-3 text-lg rounded-md',
    }[size] || ''

  return `${variantClass} ${sizeClass} ${className}`.trim()
})
</script>

<template>
  <button
    :class="classNameBasedOnVariantAndSize"
    :type="type"
    :id="id"
    :disabled="disabled"
    @click="onClick"
  >
    <slot>{{ children }}</slot>
  </button>
</template>
