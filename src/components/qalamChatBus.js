// Opens the QalamChat widget from anywhere (e.g. the landing FAQ "Contact us" button) without loading its chunk.
export const QALAMCHAT_OPEN = 'qalamchat:open'
export const openQalamChat = () => window.dispatchEvent(new Event(QALAMCHAT_OPEN))
