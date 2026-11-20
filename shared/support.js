// QalamChat: what a message is about. Ids are stored; labels live in src/i18n/msg/chat.js (chat.topic.<id>).
export const SUPPORT_TOPICS = ['question', 'partnership', 'complaint', 'idea', 'support', 'payment']

export const SUPPORT_MESSAGE_MAX = 2000

/** "How do we reach you?" fields sent with every message: a name and a phone or an email. */
export const CONTACT_LIMITS = { name: 120, phone: 32, email: 160 }
export const PHONE_RE = /^\+?[0-9 ()-]{7,32}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
