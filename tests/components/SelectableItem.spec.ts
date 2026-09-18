import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SelectableItem, { SELECTABLE_ITEM_HEIGHT } from '@/components/common/SelectableItem.vue'

describe('SelectableItem', () => {
  it('renders label', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'My Playlist', selected: false },
    })
    expect(wrapper.find('.selectable-item__label').text()).toBe('My Playlist')
  })

  it('renders subtitle when provided', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'My Playlist', subtitle: '12 tracks', selected: false },
    })
    expect(wrapper.find('.selectable-item__subtitle').text()).toBe('12 tracks')
  })

  it('does not render subtitle element when not provided', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'My Playlist', selected: false },
    })
    expect(wrapper.find('.selectable-item__subtitle').exists()).toBe(false)
  })

  it('checkbox reflects selected prop — true', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: true },
    })
    const checkbox = wrapper.find<HTMLInputElement>('input[type="checkbox"]').element
    expect(checkbox.checked).toBe(true)
  })

  it('checkbox reflects selected prop — false', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: false },
    })
    const checkbox = wrapper.find<HTMLInputElement>('input[type="checkbox"]').element
    expect(checkbox.checked).toBe(false)
  })

  it('clicking the row emits toggle', async () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: false },
    })
    await wrapper.find('.selectable-item').trigger('click')
    expect(wrapper.emitted('toggle')).toBeTruthy()
  })

  it('selected row has accent background class', () => {
    const wrapper = mount(SelectableItem, {
      props: { label: 'A', selected: true },
    })
    expect(wrapper.find('.selectable-item').classes()).toContain('selectable-item--selected')
  })

  // The row is a click target, so dragging across a list of them must not highlight text.
  it('opts out of text selection', () => {
    const wrapper = mount(SelectableItem, { props: { label: 'A', selected: false } })
    expect(wrapper.find('.selectable-item').classes()).toContain('no-text-select')
  })

  // jsdom performs no layout, so a rendered height cannot be asserted. Binding the height
  // inline is what makes the pairing observable: the number ScrollableList is handed and the
  // number the row renders at are the same constant.
  it('renders at the height it publishes', () => {
    const wrapper = mount(SelectableItem, { props: { label: 'A', selected: false } })
    expect(wrapper.find('.selectable-item').attributes('style')).toContain(
      `height: ${SELECTABLE_ITEM_HEIGHT}px`,
    )
  })

  // A floor would let a long artist list wrap the subtitle onto a second line and push the
  // row past the pitch the virtualiser lays rows out at. The height is exact, not a minimum.
  it('fixes the height rather than setting a floor', () => {
    const wrapper = mount(SelectableItem, { props: { label: 'A', selected: false } })
    expect(wrapper.find('.selectable-item').attributes('style')).not.toContain('min-height')
  })

  // Truncated text is unreachable without this; the row has no other affordance for it.
  it('exposes the full label and subtitle via title', () => {
    const artists = 'Bowie, Eno, Fripp, Visconti, Alomar, Davis, Murray, Garson'
    const wrapper = mount(SelectableItem, {
      props: { label: 'Station to Station', subtitle: artists, selected: false },
    })
    expect(wrapper.find('.selectable-item__label').attributes('title')).toBe('Station to Station')
    expect(wrapper.find('.selectable-item__subtitle').attributes('title')).toBe(artists)
  })

})
