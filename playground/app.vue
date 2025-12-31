<template>
  <div>
    <h1>openwrangler playground</h1>
    <button @click="test">Test Bindings</button>
    <pre>{{ result }}</pre>
  </div>
</template>

<script setup lang="ts">
const result = ref('')

async function test() {
  const res = await $fetch('/api/test')
  result.value = JSON.stringify(res, null, 2)
}
</script>
