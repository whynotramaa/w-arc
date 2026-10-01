export const FONT_GROUPS: { label: string; fonts: string[] }[] = [
  {
    label: 'Hand-drawn',
    fonts: [
      'Virgil', 'Architects Daughter', 'Gloria Hallelujah', 'Patrick Hand', 'Gaegu', 'Kalam', 'Caveat',
      'Permanent Marker', 'Cabin Sketch', 'Rubik Doodle Shadow', 'Rubik Scribble', 'Fuzzy Bubbles',
      'Delicious Handrawn', 'Short Stack', 'Walter Turncoat', 'Gochi Hand', 'Indie Flower', 'Schoolbell', 'Coming Soon',
    ],
  },
  { label: 'Sans', fonts: ['Inter', 'Geist', 'Plus Jakarta Sans', 'Manrope', 'Poppins', 'Syne'] },
  { label: 'Serif', fonts: ['Instrument Serif', 'Playfair Display'] },
  { label: 'Mono', fonts: ['Geist Mono', 'JetBrains Mono', 'Space Mono'] },
  { label: 'Display', fonts: ['Jaro'] },
]

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  FONT_GROUPS.flatMap(g => g.fonts)
    .filter(f => f !== 'Virgil')
    .map(f => `family=${f.replace(/ /g, '+')}`)
    .join('&') +
  '&display=swap'
