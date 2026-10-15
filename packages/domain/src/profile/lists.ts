import type { Equipment, OvenType } from '../types.js';

export interface CiiuOption {
  code: string;
  label: string;
  /** Plural cotidiano para los textos («panaderías»). */
  plural: string;
  /** Palabras clave para la alternativa sin IA (en minúsculas, sin tildes). */
  keywords: string[];
}

/** Subconjunto de CIIU Rev. 4 frecuente en mipymes. Lista cerrada: el modelo solo puede elegir de acá. */
export const CIIU_OPTIONS: readonly CiiuOption[] = [
  {
    code: '1010',
    label: 'Procesamiento y conservación de carne',
    plural: 'carnicerías y procesadoras de carne',
    keywords: ['carniceria', 'embutidos', 'carne'],
  },
  {
    code: '1050',
    label: 'Elaboración de productos lácteos',
    plural: 'lácteos',
    keywords: ['queso', 'quesos', 'lacteos', 'yogur', 'leche'],
  },
  {
    code: '1061',
    label: 'Elaboración de productos de molinería',
    plural: 'molinos',
    keywords: ['molino', 'molineria', 'harina'],
  },
  {
    code: '1071',
    label: 'Elaboración de productos de panadería',
    plural: 'panaderías',
    keywords: ['panaderia', 'pan', 'panes', 'pasteleria', 'tortas', 'bizcochos'],
  },
  {
    code: '1073',
    label: 'Elaboración de cacao, chocolate y productos de confitería',
    plural: 'chocolaterías y confiterías',
    keywords: ['chocolate', 'chocolateria', 'cacao', 'bombones', 'confiteria'],
  },
  {
    code: '1079',
    label: 'Elaboración de otros productos alimenticios',
    plural: 'productoras de alimentos',
    keywords: ['alimentos', 'conservas', 'mermeladas', 'snacks'],
  },
  {
    code: '1104',
    label: 'Elaboración de bebidas no alcohólicas',
    plural: 'productoras de bebidas',
    keywords: ['jugos', 'bebidas', 'refrescos', 'agua embotellada'],
  },
  {
    code: '1410',
    label: 'Fabricación de prendas de vestir',
    plural: 'talleres de confección',
    keywords: ['confeccion', 'costura', 'taller textil', 'prendas'],
  },
  {
    code: '1811',
    label: 'Actividades de impresión',
    plural: 'imprentas',
    keywords: ['imprenta', 'impresion', 'serigrafia'],
  },
  {
    code: '3100',
    label: 'Fabricación de muebles',
    plural: 'mueblerías',
    keywords: ['muebles', 'carpinteria', 'muebleria'],
  },
  {
    code: '4520',
    label: 'Mantenimiento y reparación de vehículos',
    plural: 'talleres mecánicos',
    keywords: ['taller mecanico', 'mecanica', 'autos', 'motos'],
  },
  {
    code: '4711',
    label: 'Venta al por menor con predominio de alimentos (bodegas y minimercados)',
    plural: 'bodegas',
    keywords: ['bodega', 'minimercado', 'abarrotes', 'tienda de barrio'],
  },
  {
    code: '4721',
    label: 'Venta al por menor de alimentos en comercios especializados',
    plural: 'tiendas de alimentos',
    keywords: ['fruteria', 'verduleria', 'polleria', 'tienda de alimentos'],
  },
  {
    code: '4771',
    label: 'Venta al por menor de prendas de vestir',
    plural: 'tiendas de ropa',
    keywords: ['tienda de ropa', 'boutique', 'ropa'],
  },
  {
    code: '5510',
    label: 'Alojamiento para estancias cortas',
    plural: 'hospedajes',
    keywords: ['hostal', 'hotel', 'hospedaje', 'alojamiento'],
  },
  {
    code: '5610',
    label: 'Restaurantes y servicio móvil de comidas',
    plural: 'restaurantes',
    keywords: [
      'restaurante',
      'cevicheria',
      'picanteria',
      'comida',
      'menu',
      'pizzeria',
      'polleria a la brasa',
    ],
  },
  {
    code: '5630',
    label: 'Servicio de bebidas (cafeterías y bares)',
    plural: 'cafeterías',
    keywords: ['cafeteria', 'cafe', 'bar', 'juguera'],
  },
  {
    code: '6201',
    label: 'Programación informática',
    plural: 'estudios de software',
    keywords: ['software', 'programacion', 'desarrollo web'],
  },
  {
    code: '7410',
    label: 'Actividades especializadas de diseño',
    plural: 'estudios de diseño',
    keywords: ['diseno', 'diseno grafico', 'estudio de diseno'],
  },
  {
    code: '9601',
    label: 'Lavado y limpieza de prendas (lavanderías)',
    plural: 'lavanderías',
    keywords: ['lavanderia', 'tintoreria', 'lavado de ropa'],
  },
  {
    code: '9602',
    label: 'Peluquería y tratamientos de belleza',
    plural: 'peluquerías',
    keywords: ['peluqueria', 'salon de belleza', 'barberia', 'estetica'],
  },
];

export interface EquipmentOption {
  value: Equipment;
  label: string;
  /** Cómo se nombra en las explicaciones («tus refrigeradoras»). */
  possessive: string;
  keywords: string[];
}

export const EQUIPMENT_OPTIONS: readonly EquipmentOption[] = [
  {
    value: 'electric_oven',
    label: 'Horno eléctrico',
    possessive: 'tu horno eléctrico',
    keywords: ['horno electrico', 'horno es electrico', 'hornos electricos'],
  },
  {
    value: 'gas_oven',
    label: 'Horno a gas',
    possessive: 'tu horno a gas',
    keywords: ['horno a gas', 'horno de gas', 'horno es a gas'],
  },
  {
    value: 'refrigeration',
    label: 'Refrigeración (refrigeradoras, congeladoras, vitrinas)',
    possessive: 'tus refrigeradoras',
    keywords: [
      'refrigeradora',
      'refrigeradoras',
      'congeladora',
      'congeladoras',
      'heladera',
      'heladeras',
      'nevera',
      'freezer',
      'vitrina refrigerada',
      'camara de frio',
    ],
  },
  {
    value: 'lighting',
    label: 'Iluminación',
    possessive: 'tu iluminación',
    keywords: ['luces', 'iluminacion', 'focos', 'fluorescentes'],
  },
  {
    value: 'electric_water_heater',
    label: 'Termo eléctrico',
    possessive: 'tu termo eléctrico',
    keywords: ['termo', 'terma', 'calentador electrico', 'therma'],
  },
  {
    value: 'air_conditioning',
    label: 'Aire acondicionado',
    possessive: 'tu aire acondicionado',
    keywords: ['aire acondicionado', 'split', 'climatizador'],
  },
  {
    value: 'motors',
    label: 'Motores y máquinas (amasadoras, bombas, compresoras)',
    possessive: 'tus máquinas',
    keywords: ['amasadora', 'batidora industrial', 'bomba de agua', 'compresora', 'motor'],
  },
  {
    value: 'computers',
    label: 'Computadoras y equipos de oficina',
    possessive: 'tus computadoras',
    keywords: ['computadora', 'computadoras', 'laptop', 'impresora'],
  },
];

export interface OvenOption {
  value: OvenType;
  label: string;
}

export const OVEN_OPTIONS: readonly OvenOption[] = [
  { value: 'electric', label: 'Eléctrico' },
  { value: 'gas', label: 'A gas' },
  { value: 'diesel', label: 'A petróleo' },
  { value: 'none', label: 'No tengo horno' },
  { value: 'unknown', label: 'No sé' },
];
