import { getSettings, saveSettings } from '../storage'
import type { RuntimeMessage } from '@/types/messages'

type SettingsMessage =
  | Extract<RuntimeMessage, { type: 'GET_SETTINGS' }>
  | Extract<RuntimeMessage, { type: 'SAVE_SETTINGS' }>

export async function handleSettingsMessages(
  message: SettingsMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  if (message.type === 'GET_SETTINGS') {
    const settings = await getSettings()
    sendResponse({ type: 'GET_SETTINGS_RESPONSE', payload: settings })
  } else if (message.type === 'SAVE_SETTINGS') {
    await saveSettings(message.payload)
    sendResponse({ success: true })
  }
}
