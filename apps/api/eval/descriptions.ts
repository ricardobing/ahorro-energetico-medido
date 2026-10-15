import type { Country, Equipment, OvenType } from '@ppam/domain';

/**
 * 40 descripciones SINTÉTICAS (sin nombres ni teléfonos reales) con la respuesta correcta.
 * `null` = el texto no lo dice y lo correcto es dejarlo vacío. Los montos escritos con palabras
 * («mil doscientos») no cuentan: el dominio exige cifras para no inventar.
 */
export interface EvalCase {
  id: string;
  country: Country;
  description: string;
  expected: {
    ciiu: string | null;
    equipment: Equipment[];
    ovenType: OvenType | null;
    budgetAmount: number | null;
    hoursPerWeek: number | null;
  };
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'ines',
    country: 'PE',
    description:
      'Tengo una panadería en Arequipa, somos 6. El horno es eléctrico y tenemos dos refrigeradoras. Este trimestre puedo poner unos 1200 soles y 4 horas por semana.',
    expected: {
      ciiu: '1071',
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      budgetAmount: 1200,
      hoursPerWeek: 4,
    },
  },
  {
    id: 'pan_gas',
    country: 'PE',
    description:
      'Panadería de barrio en Cusco. Horneamos con horno a gas y tenemos una congeladora para la masa.',
    expected: {
      ciiu: '1071',
      equipment: ['gas_oven', 'refrigeration'],
      ovenType: 'gas',
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'pan_bo',
    country: 'BO',
    description:
      'Somos una panadería en El Alto, usamos un horno a gas y dos heladeras. Podemos invertir 2.000 bolivianos.',
    expected: {
      ciiu: '1071',
      equipment: ['gas_oven', 'refrigeration'],
      ovenType: 'gas',
      budgetAmount: 2000,
      hoursPerWeek: null,
    },
  },
  {
    id: 'pan_palabras',
    country: 'PE',
    description:
      'Pastelería familiar, horno eléctrico. Tenemos unos mil quinientos soles para mejoras y dos horas a la semana.',
    expected: {
      ciiu: '1071',
      equipment: ['electric_oven'],
      ovenType: 'electric',
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'pan_petroleo',
    country: 'PE',
    description:
      'Hacemos pan francés todos los días con un horno a petróleo. Tenemos una amasadora y una vitrina refrigerada.',
    expected: {
      ciiu: '1071',
      equipment: ['refrigeration', 'motors'],
      ovenType: 'diesel',
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'pan_sin_horno',
    country: 'PE',
    description:
      'Vendemos pan que compramos a otra panadería, no tenemos horno. Solo una refrigeradora para las tortas.',
    expected: {
      ciiu: '1071',
      equipment: ['refrigeration'],
      ovenType: 'none',
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'cafe',
    country: 'PE',
    description:
      'Somos una cafetería chica en el centro, tenemos una vitrina refrigerada y una máquina de café.',
    expected: {
      ciiu: '5630',
      equipment: ['refrigeration'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'cafe_horas',
    country: 'BO',
    description:
      'Cafetería en Cochabamba con aire acondicionado y dos refrigeradores. Puedo dedicar 3 horas por semana.',
    expected: {
      ciiu: '5630',
      equipment: ['refrigeration', 'air_conditioning'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: 3,
    },
  },
  {
    id: 'resto',
    country: 'PE',
    description:
      'Restaurante de menú en Lima, cocinamos a gas y tenemos una cámara de frío. Presupuesto de 3500 soles.',
    expected: {
      ciiu: '5610',
      equipment: ['refrigeration'],
      ovenType: null,
      budgetAmount: 3500,
      hoursPerWeek: null,
    },
  },
  {
    id: 'cevicheria',
    country: 'PE',
    description: 'Cevichería en Chiclayo. Dos congeladoras y luces fluorescentes en todo el local.',
    expected: {
      ciiu: '5610',
      equipment: ['refrigeration', 'lighting'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'pizzeria',
    country: 'PE',
    description:
      'Pizzería con horno eléctrico y una refrigeradora. Puedo poner 800 soles y 5 horas a la semana.',
    expected: {
      ciiu: '5610',
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      budgetAmount: 800,
      hoursPerWeek: 5,
    },
  },
  {
    id: 'polleria',
    country: 'PE',
    description: 'Pollería a la brasa en Trujillo, el horno es a leña y tenemos tres congeladoras.',
    expected: {
      ciiu: '5610',
      equipment: ['refrigeration'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'bodega',
    country: 'PE',
    description:
      'Tengo una bodega de abarrotes, con dos refrigeradoras de bebidas y una congeladora de helados.',
    expected: {
      ciiu: '4711',
      equipment: ['refrigeration'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'minimercado',
    country: 'BO',
    description:
      'Minimercado en Santa Cruz con aire acondicionado, freezer y luces LED. Tenemos Bs 5.000 para este año.',
    expected: {
      ciiu: '4711',
      equipment: ['refrigeration', 'lighting', 'air_conditioning'],
      ovenType: null,
      budgetAmount: 5000,
      hoursPerWeek: null,
    },
  },
  {
    id: 'fruteria',
    country: 'PE',
    description: 'Frutería y verdulería en un mercado, tenemos una cámara de frío.',
    expected: {
      ciiu: '4721',
      equipment: ['refrigeration'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'carniceria',
    country: 'PE',
    description: 'Carnicería con dos congeladoras y una sierra eléctrica. Podemos poner 1.500 soles.',
    expected: {
      ciiu: '1010',
      equipment: ['refrigeration', 'motors'],
      ovenType: null,
      budgetAmount: 1500,
      hoursPerWeek: null,
    },
  },
  {
    id: 'quesos',
    country: 'PE',
    description: 'Hacemos quesos y yogur en Cajamarca. Tenemos una cámara de frío y una bomba de agua.',
    expected: {
      ciiu: '1050',
      equipment: ['refrigeration', 'motors'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'molino',
    country: 'BO',
    description: 'Molino de harina de quinua, con motores grandes. Trabajamos 6 días.',
    expected: { ciiu: '1061', equipment: ['motors'], ovenType: null, budgetAmount: null, hoursPerWeek: null },
  },
  {
    id: 'chocolate',
    country: 'PE',
    description:
      'Chocolatería artesanal: tostamos cacao en un horno eléctrico y guardamos los bombones en una vitrina refrigerada.',
    expected: {
      ciiu: '1073',
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'mermeladas',
    country: 'PE',
    description: 'Hacemos mermeladas y conservas, cocinamos con gas. Puedo dedicarle 2 horas por semana.',
    expected: { ciiu: '1079', equipment: [], ovenType: null, budgetAmount: null, hoursPerWeek: 2 },
  },
  {
    id: 'jugos',
    country: 'BO',
    description: 'Embotellamos jugos naturales, tenemos una refrigeradora industrial y una compresora.',
    expected: {
      ciiu: '1104',
      equipment: ['refrigeration', 'motors'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'confeccion',
    country: 'PE',
    description:
      'Taller de confección en Gamarra con 8 máquinas de coser y fluorescentes. Presupuesto: 2500 soles.',
    expected: {
      ciiu: '1410',
      equipment: ['lighting'],
      ovenType: null,
      budgetAmount: 2500,
      hoursPerWeek: null,
    },
  },
  {
    id: 'imprenta',
    country: 'PE',
    description: 'Imprenta chica: dos impresoras grandes, una computadora y aire acondicionado.',
    expected: {
      ciiu: '1811',
      equipment: ['air_conditioning', 'computers'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'muebles',
    country: 'BO',
    description:
      'Carpintería de muebles, usamos una compresora y luces. Le puedo dedicar 4 horas a la semana.',
    expected: {
      ciiu: '3100',
      equipment: ['lighting', 'motors'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: 4,
    },
  },
  {
    id: 'taller',
    country: 'PE',
    description: 'Taller mecánico de motos con compresora y focos. Tenemos 600 soles.',
    expected: {
      ciiu: '4520',
      equipment: ['lighting', 'motors'],
      ovenType: null,
      budgetAmount: 600,
      hoursPerWeek: null,
    },
  },
  {
    id: 'boutique',
    country: 'PE',
    description: 'Tienda de ropa en un centro comercial, con muchas luces y aire acondicionado.',
    expected: {
      ciiu: '4771',
      equipment: ['lighting', 'air_conditioning'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'hostal',
    country: 'PE',
    description:
      'Hostal de 10 habitaciones en Cusco, cada una con terma eléctrica. Podemos invertir 4.000 soles.',
    expected: {
      ciiu: '5510',
      equipment: ['electric_water_heater'],
      ovenType: null,
      budgetAmount: 4000,
      hoursPerWeek: null,
    },
  },
  {
    id: 'hotel_bo',
    country: 'BO',
    description:
      'Hotel chico en Sucre con termos eléctricos, refrigeradoras en la cocina y aire acondicionado en el lobby.',
    expected: {
      ciiu: '5510',
      equipment: ['refrigeration', 'electric_water_heater', 'air_conditioning'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'software',
    country: 'PE',
    description: 'Estudio de desarrollo web, somos 5 con laptops y aire acondicionado.',
    expected: {
      ciiu: '6201',
      equipment: ['air_conditioning', 'computers'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'diseno',
    country: 'PE',
    description: 'Estudio de diseño gráfico con tres computadoras y una impresora.',
    expected: {
      ciiu: '7410',
      equipment: ['computers'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'lavanderia',
    country: 'PE',
    description:
      'Lavandería con 4 lavadoras industriales, una secadora a gas y una terma eléctrica. 1 hora por semana.',
    expected: {
      ciiu: '9601',
      equipment: ['electric_water_heater', 'motors'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: 1,
    },
  },
  {
    id: 'peluqueria',
    country: 'BO',
    description:
      'Peluquería y salón de belleza, usamos secadoras, una terma y luces todo el día. Tenemos 900 bolivianos.',
    expected: {
      ciiu: '9602',
      equipment: ['lighting', 'electric_water_heater'],
      ovenType: null,
      budgetAmount: 900,
      hoursPerWeek: null,
    },
  },
  {
    id: 'barberia',
    country: 'PE',
    description: 'Barbería de barrio, con aire acondicionado.',
    expected: {
      ciiu: '9602',
      equipment: ['air_conditioning'],
      ovenType: null,
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'sin_rubro',
    country: 'PE',
    description: 'Tenemos un negocio familiar con una refrigeradora y luces. Podemos poner 500 soles.',
    expected: {
      ciiu: null,
      equipment: ['refrigeration', 'lighting'],
      ovenType: null,
      budgetAmount: 500,
      hoursPerWeek: null,
    },
  },
  {
    id: 'telefono',
    country: 'PE',
    description: 'Panadería en Puno, horno eléctrico. Mi número es 987 654 321 por si acaso.',
    expected: {
      ciiu: '1071',
      equipment: ['electric_oven'],
      ovenType: 'electric',
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'mil_palabras',
    country: 'BO',
    description: 'Restaurante en La Paz con cocina a gas. Tenemos como dos mil bolivianos y poco tiempo.',
    expected: { ciiu: '5610', equipment: [], ovenType: null, budgetAmount: null, hoursPerWeek: null },
  },
  {
    id: 'empleados_no_monto',
    country: 'PE',
    description: 'Somos 12 en una panadería con horno a gas. Abrimos 7 días.',
    expected: {
      ciiu: '1071',
      equipment: ['gas_oven'],
      ovenType: 'gas',
      budgetAmount: null,
      hoursPerWeek: null,
    },
  },
  {
    id: 'decimal',
    country: 'PE',
    description: 'Cafetería con heladera y luces. Le dedico 1,5 horas por semana y tengo 350 soles.',
    expected: {
      ciiu: '5630',
      equipment: ['refrigeration', 'lighting'],
      ovenType: null,
      budgetAmount: 350,
      hoursPerWeek: 1.5,
    },
  },
  {
    id: 'mixto',
    country: 'PE',
    description:
      'Panadería y cafetería: horno eléctrico, dos vitrinas refrigeradas y aire acondicionado. 3 horas por semana.',
    expected: {
      ciiu: '1071',
      equipment: ['electric_oven', 'refrigeration', 'air_conditioning'],
      ovenType: 'electric',
      budgetAmount: null,
      hoursPerWeek: 3,
    },
  },
  {
    id: 'ingles',
    country: 'PE',
    description: 'Bakery en Miraflores, electric oven y freezer. Budget 1000 soles.',
    expected: {
      ciiu: '1071',
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      budgetAmount: 1000,
      hoursPerWeek: null,
    },
  },
];
