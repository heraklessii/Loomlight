// Built-in palettes (colour lists, credited in THIRD-PARTY-NOTICES.txt).

import { parseHex, type Packed } from './color'

export interface PaletteDef {
  id: string
  name: string
  author: string
  colors: string[]
}

export const PALETTES: PaletteDef[] = [
  {
    id: 'endesga32',
    name: 'Endesga 32',
    author: 'ENDESGA',
    colors: [
      '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
      '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
      '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
      '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'
    ]
  },
  {
    id: 'pico8',
    name: 'PICO-8',
    author: 'Lexaloffle',
    colors: [
      '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'
    ]
  },
  {
    id: 'sweetie16',
    name: 'Sweetie 16',
    author: 'GrafxKid',
    colors: [
      '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
      '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'
    ]
  },
  {
    id: 'db16',
    name: 'DawnBringer 16',
    author: 'DawnBringer',
    colors: [
      '#140c1c', '#442434', '#30346d', '#4e4a4e', '#854c30', '#346524', '#d04648', '#757161',
      '#597dce', '#d27d2c', '#8595a1', '#6daa2c', '#d2aa99', '#6dc2ca', '#dad45e', '#deeed6'
    ]
  },
  {
    id: 'gray8',
    name: 'Grayscale 8',
    author: 'Loomlight',
    colors: ['#000000', '#242424', '#494949', '#6d6d6d', '#929292', '#b6b6b6', '#dbdbdb', '#ffffff']
  }
]

export const DEFAULT_PALETTE_ID = 'endesga32'

export function paletteColors(id: string): Packed[] {
  const def = PALETTES.find((p) => p.id === id) ?? PALETTES[0]
  return def.colors.map((c) => parseHex(c)!)
}
