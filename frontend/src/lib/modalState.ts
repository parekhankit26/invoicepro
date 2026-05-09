// Global modal state — tells AIAssistant to hide when any modal is open
let modalCount = 0
const listeners: Array<(open: boolean) => void> = []

export const modalState = {
  open() {
    modalCount++
    listeners.forEach(fn => fn(modalCount > 0))
  },
  close() {
    modalCount = Math.max(0, modalCount - 1)
    listeners.forEach(fn => fn(modalCount > 0))
  },
  subscribe(fn: (open: boolean) => void) {
    listeners.push(fn)
    return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1) }
  }
}
