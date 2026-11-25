// Design «kind» values are stored as stable Uzbek ids ('Taqdimot', 'Kurs işi' …) in saved designs;
// these helpers show them in the interface language.
import { t } from './index.js'

const KIND_KEYS = {
  Taqdimot: 'kind.slideshow',
  Prezentatsiya: 'kind.presentation',
  Referat: 'kind.essay',
  'Kurs işi': 'kind.coursework',
  'Diplom işi': 'kind.thesis',
  Dissertatsiya: 'kind.dissertation',
  Dars: 'kind.lesson',
  'Dars işlanma': 'kind.lessonPlan',
  'Biznes reja': 'kind.businessPlan',
  'Biznes taqdimot': 'kind.businessDeck',
  Hisobot: 'kind.report',
  Taklifnoma: 'kind.invitation',
  Portfolio: 'kind.portfolio',
  Logo: 'kind.logo',
  'Link in Bio': 'kind.bio',
  Rezyume: 'kind.resume',
  'Mustaqil iş': 'wt.mustaqil',
  'Laboratoriya işi': 'wt.lab',
  'Bitiruv malakaviy işi': 'wt.bmi',
}

export const kindLabel = (kind) => (KIND_KEYS[kind] ? t(KIND_KEYS[kind]) : kind ?? '')
