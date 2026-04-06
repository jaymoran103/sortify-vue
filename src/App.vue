<script setup lang="ts">
import { RouterView } from 'vue-router'
import BaseModal from '@/components/common/BaseModal.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
</script>

<template>
  <RouterView />
  <BaseModal />
  <ContextMenu />
</template>

<style scoped>
</style>
