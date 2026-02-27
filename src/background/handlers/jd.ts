import { getJobContext, saveJobContext } from '../storage'
import type { RuntimeMessage } from '@/types/messages'

type JDMessage =
  | Extract<RuntimeMessage, { type: 'SAVE_JD' }>
  | Extract<RuntimeMessage, { type: 'GET_JD' }>

export async function handleJDMessages(
  message: JDMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  if (message.type === 'SAVE_JD') {
    await saveJobContext(message.payload)
    sendResponse({ success: true })
  } else if (message.type === 'GET_JD') {
    const jd = await getJobContext()
    sendResponse({ type: 'GET_JD_RESPONSE', payload: jd })
  }
}
