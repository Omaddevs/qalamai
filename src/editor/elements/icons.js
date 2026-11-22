// The icon set of the Elements panel (Phosphor, MIT). Imported one by one so the bundle only
// carries these; a design stores the icon's name, and every style (line, bold, fill, duotone)
// comes from the same component.
import {
  Airplane, Alarm, ArrowCircleRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, ArrowsClockwise, At, Atom,
  Backpack, Bank, Barbell, Basketball, Bell, Bicycle, Book, BookOpen, Books, Briefcase, Buildings, Bus, Cake, Calculator,
  Calendar, CalendarCheck, Camera, Car, CaretRight, Certificate, Chalkboard, ChalkboardTeacher, ChartBar, ChartLine,
  ChartLineUp, ChartPie, ChatCircle, ChatsCircle, Check, CheckCircle, Clipboard, ClipboardText, Clock, Cloud, CloudSun,
  Code, Coffee, Coins, Compass, Cpu, Crown, CurrencyDollar, Database, Desktop, DeviceMobile, Drop, Envelope, Exam, Factory,
  Files, FileText, FilmStrip, Fire, FirstAid, Flag, Flask, Flower, Folder, Football, ForkKnife, Funnel, Gavel, Gear, Gift,
  Globe, GraduationCap, Handshake, Heart, Heartbeat, Hospital, Hourglass, House, IdentificationCard, Image, Info, Infinity,
  Key, Laptop, Leaf, Lightbulb, Lightning, Link, ListChecks, Lock, MagnifyingGlass, MapPin, MapTrifold, MathOperations,
  Medal, Megaphone, Microphone, Minus, Money, Moon, Mosque, Mountains, MusicNote, Notebook, PaintBrush, Palette,
  PaperPlaneTilt, Pause, Pen, Pencil, PencilSimple, Phone, Pill, Plant, Play, Plus, Presentation, PresentationChart,
  PuzzlePiece, Question, Receipt, Robot, Rocket, Ruler, Scales, Share, ShieldCheck, ShoppingCart, Smiley, Snowflake, Sparkle,
  Star, Stethoscope, Storefront, Student, Sun, Tag, Target, Timer, Train, Translate, Tree, TrendDown, TrendUp, Trophy, User,
  UserCircle, Users, UsersThree, Wallet, Warning, Waves, WifiHigh, X, XCircle,
} from '@phosphor-icons/react'

export const ICONS = {
  Airplane, Alarm, ArrowCircleRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, ArrowsClockwise, At, Atom,
  Backpack, Bank, Barbell, Basketball, Bell, Bicycle, Book, BookOpen, Books, Briefcase, Buildings, Bus, Cake, Calculator,
  Calendar, CalendarCheck, Camera, Car, CaretRight, Certificate, Chalkboard, ChalkboardTeacher, ChartBar, ChartLine,
  ChartLineUp, ChartPie, ChatCircle, ChatsCircle, Check, CheckCircle, Clipboard, ClipboardText, Clock, Cloud, CloudSun,
  Code, Coffee, Coins, Compass, Cpu, Crown, CurrencyDollar, Database, Desktop, DeviceMobile, Drop, Envelope, Exam, Factory,
  Files, FileText, FilmStrip, Fire, FirstAid, Flag, Flask, Flower, Folder, Football, ForkKnife, Funnel, Gavel, Gear, Gift,
  Globe, GraduationCap, Handshake, Heart, Heartbeat, Hospital, Hourglass, House, IdentificationCard, Image, Info, Infinity,
  Key, Laptop, Leaf, Lightbulb, Lightning, Link, ListChecks, Lock, MagnifyingGlass, MapPin, MapTrifold, MathOperations,
  Medal, Megaphone, Microphone, Minus, Money, Moon, Mosque, Mountains, MusicNote, Notebook, PaintBrush, Palette,
  PaperPlaneTilt, Pause, Pen, Pencil, PencilSimple, Phone, Pill, Plant, Play, Plus, Presentation, PresentationChart,
  PuzzlePiece, Question, Receipt, Robot, Rocket, Ruler, Scales, Share, ShieldCheck, ShoppingCart, Smiley, Snowflake, Sparkle,
  Star, Stethoscope, Storefront, Student, Sun, Tag, Target, Timer, Train, Translate, Tree, TrendDown, TrendUp, Trophy, User,
  UserCircle, Users, UsersThree, Wallet, Warning, Waves, WifiHigh, X, XCircle,
}

/** Topics shown as sections; names double as English search words. */
export const ICON_GROUPS = [
  ['education', 'GraduationCap Student Chalkboard ChalkboardTeacher Book BookOpen Books Notebook Pencil PencilSimple Exam Certificate Atom Flask Calculator MathOperations Ruler Backpack Translate Lightbulb'],
  ['business', 'Briefcase ChartBar ChartLine ChartPie ChartLineUp TrendUp TrendDown Target Handshake Money CurrencyDollar Coins Wallet Bank Storefront ShoppingCart Tag Receipt PresentationChart Presentation Megaphone Buildings Factory Scales Gavel Trophy Medal Crown'],
  ['tech', 'Laptop Desktop DeviceMobile Cpu Database Cloud WifiHigh Code Robot Gear Lock ShieldCheck Key Rocket MagnifyingGlass Funnel'],
  ['comm', 'Envelope Phone ChatCircle ChatsCircle PaperPlaneTilt Bell At Share Link Users User UsersThree UserCircle IdentificationCard'],
  ['nature', 'Sun Moon CloudSun Leaf Tree Plant Flower Drop Mountains Waves Snowflake Fire Lightning'],
  ['travel', 'Airplane Car Bus Train Bicycle MapPin MapTrifold Compass House Hospital Mosque Coffee ForkKnife Cake Gift'],
  ['health', 'FirstAid Heartbeat Pill Stethoscope Barbell Football Basketball'],
  ['media', 'MusicNote Microphone Camera Image FilmStrip PaintBrush Palette Pen Play Pause'],
  ['time', 'Calendar CalendarCheck Clock Timer Hourglass Alarm'],
  ['symbols', 'Heart Star Smiley Sparkle Check CheckCircle X XCircle Plus Minus Info Question Warning Flag PuzzlePiece Infinity ListChecks Clipboard ClipboardText Files FileText Folder'],
  ['arrows', 'ArrowRight ArrowLeft ArrowUp ArrowDown ArrowUpRight ArrowCircleRight ArrowsClockwise CaretRight'],
].map(([id, names]) => ({ id, names: names.split(' ') }))

export const ICON_WEIGHTS = ['regular', 'bold', 'fill', 'duotone', 'light', 'thin']

/** "ArrowCircleRight" → "arrow circle right" (for search). */
export const iconWords = (name) => name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
