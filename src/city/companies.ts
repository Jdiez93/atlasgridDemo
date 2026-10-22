export type Emblem = 'bar' | 'dot' | 'chevron' | 'ring';
export interface Company {
  id: string;
  name: string;
  /** Texto corto para la cartelería del muelle. */
  short: string;
  color: string;
  accent: string;
  emblem: Emblem;
}
/** Empresas ficticias de terceros. Colores cálidos/variados: sin azul royal. */
export const COMPANIES: readonly Company[] = [
  {
    id: 'nordline',
    name: 'NORDLINE',
    short: 'NL',
    color: '#E4572E',
    accent: '#FFE3D6',
    emblem: 'chevron',
  },
  {
    id: 'cargovia',
    name: 'CARGOVIA',
    short: 'CV',
    color: '#2A9D8F',
    accent: '#D8F3EF',
    emblem: 'bar',
  },
  {
    id: 'halcyon',
    name: 'HALCYON RETAIL',
    short: 'HR',
    color: '#E9A820',
    accent: '#3A2A00',
    emblem: 'ring',
  },
  {
    id: 'oakridge',
    name: 'OAKRIDGE MARKET',
    short: 'OM',
    color: '#3E8E41',
    accent: '#E3F5E1',
    emblem: 'dot',
  },
  {
    id: 'sunvale',
    name: 'SUNVALE GROCERS',
    short: 'SG',
    color: '#F28C28',
    accent: '#FFF0DC',
    emblem: 'dot',
  },
  {
    id: 'brightway',
    name: 'BRIGHTWAY FREIGHT',
    short: 'BF',
    color: '#8E5BD0',
    accent: '#EFE5FB',
    emblem: 'chevron',
  },
  {
    id: 'meridian',
    name: 'MERIDIAN FOODS',
    short: 'MF',
    color: '#C23B5A',
    accent: '#FBE3E9',
    emblem: 'ring',
  },
  {
    id: 'tidewater',
    name: 'TIDEWATER SUPPLY',
    short: 'TS',
    color: '#2F9BB3',
    accent: '#DDF2F7',
    emblem: 'bar',
  },
  {
    id: 'ironbridge',
    name: 'IRONBRIDGE STEEL',
    short: 'IB',
    color: '#7C8697',
    accent: '#EEF1F5',
    emblem: 'chevron',
  },
  {
    id: 'pelican',
    name: 'PELICAN PARCEL',
    short: 'PP',
    color: '#E0679A',
    accent: '#FCE6EF',
    emblem: 'dot',
  },
  {
    id: 'ardent',
    name: 'ARDENT PHARMA',
    short: 'AP',
    color: '#69B54E',
    accent: '#E8F6E0',
    emblem: 'ring',
  },
  {
    id: 'kestrel',
    name: 'KESTREL AIR CARGO',
    short: 'KA',
    color: '#D64545',
    accent: '#FCE4E4',
    emblem: 'bar',
  },
];
