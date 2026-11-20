import {
  Presentation,
  FileText,
  GraduationCap,
  FileStack,
  CaseSensitive,
  Languages,
  Palette,
  ScanSearch,
  PenLine,
  PartyPopper,
} from 'lucide-react'
import { localize } from './i18n/index.js'

// Pastel band + gradient tile colours (same palette as the reference design)
export const COLORS = {
  purple: { band: '#f1ebfe', from: '#c9acfb', to: '#9a6af5' },
  sky: { band: '#e2f1fd', from: '#86cdf8', to: '#3d9ff0' },
  indigo: { band: '#e9ebfd', from: '#a2adf9', to: '#6474ec' },
  red: { band: '#fde5e5', from: '#fb8a8a', to: '#e5484d' },
  teal: { band: '#dbf6ef', from: '#4ddcbc', to: '#12b398' },
  green: { band: '#e3f6e1', from: '#9be09a', to: '#52bf63' },
  orange: { band: '#fde8e0', from: '#fca587', to: '#f26b4b' },
  amber: { band: '#fdf0d8', from: '#fcd07c', to: '#f5a524' },
  pink: { band: '#fde4eb', from: '#f98fae', to: '#e8456f' },
  emerald: { band: '#ddf4e6', from: '#6fd598', to: '#2bb069' },
  blue: { band: '#e3ebfd', from: '#7aa2f7', to: '#2f5bff' },
}

export const APPS = [
  {
    id: 'prezentatsiya',
    icon: Presentation,
    color: 'purple',
    command: '/prezentatsiya',
  },
  {
    id: 'referat',
    icon: FileText,
    color: 'sky',
    command: '/referat',
  },
  {
    id: 'kursishi',
    icon: GraduationCap,
    color: 'indigo',
    command: '/kursishi',
  },
  {
    id: 'pdf',
    icon: FileStack,
    color: 'red',
    command: '/pdf',
  },
  {
    id: 'alifbo',
    icon: CaseSensitive,
    color: 'teal',
    command: '/alifbo',
    badge: 15,
  },
  {
    id: 'tarjima',
    icon: Languages,
    color: 'green',
    command: '/tarjima',
  },
  {
    id: 'muharrir',
    icon: Palette,
    color: 'orange',
    command: '/muharrir',
  },
  {
    id: 'plagiat',
    icon: ScanSearch,
    color: 'amber',
    command: '/plagiat',
    badge: 7,
  },
  {
    id: 'qaytayozish',
    icon: PenLine,
    color: 'pink',
    command: '/qaytayozish',
  },
  {
    id: 'taklifnoma',
    icon: PartyPopper,
    color: 'emerald',
    command: '/taklifnoma',
    soon: true,
  },
]

// Texts live in src/i18n/msg/apps.js.
for (const app of APPS) localize(app, `apps.${app.id}`, app.id === 'alifbo' || app.id === 'taklifnoma' ? ['name', 'desc', 'about'] : ['name', 'desc', 'about', 'placeholder'])
