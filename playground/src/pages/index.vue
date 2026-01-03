<!-- eslint-disable vue/multi-word-component-names -->
<script lang="ts" setup>
const auth = useAuthStore()
// auth.client.signIn.email({
//   email: 'bonoself@gmail.com',
//   // name: 'binobino',
//   password: 'asas1212',
// })
</script>

<template>
  <div>
    {{ auth.state }}
  </div>
</template>

<style lang="scss" scoped>
</style>
