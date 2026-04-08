import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import DashboardView from '@/components/dashboard/DashboardView.vue'
import { createPinia, setActivePinia } from 'pinia'

// Stub child cards so DashboardView test is isolated
const StubCard = defineComponent({ template: '<div />' })

describe('DashboardView', () => {
    let pinia: ReturnType<typeof createPinia>

    beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })
  
  it('renders all three cards', () => {
    const wrapper = mount(DashboardView, {
      global: {
        stubs: {
          IOCard: StubCard,
          LibraryCard: StubCard,
          WorkspaceCard: StubCard,
          RouterLink: true,
        },
      },
    })
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.find('.dashboard__grid').exists()).toBe(true)
    // Three stub card divs rendered inside the grid
    expect(wrapper.findAll('.dashboard__grid > div').length).toBe(3)
  })
})
