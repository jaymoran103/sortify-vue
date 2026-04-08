import type { Component } from 'vue'

/** Generic filter function — consumers define domain-specific matching logic */
export type FilterFn<T> = (item: T, query: string) => boolean

/** Sort option for SelectDropdown — consumers define their own sort menus */
export interface SortOption<T> {
  key: string
  label: string
  compareFn: (a: T, b: T) => number
}

/** Context menu / dropdown menu entries */
export interface MenuItem {
  label: string
  action: () => void
}

export interface MenuDivider {
  divider: true
}

export type MenuEntry = MenuItem | MenuDivider

/** Modal configuration passed to useModal().open() */
export interface ModalConfig {
  component: Component
  props?: Record<string, unknown>
  className?: string
}

/** Notification/toast for non-blocking feedback */
export interface ToastConfig {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}