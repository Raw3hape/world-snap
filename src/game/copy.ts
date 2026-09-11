export const copy = {
  title: 'World Snap',
  subtitle: 'Собери мир из стран',
  toTable: 'Начать',
  hint: 'Положи страну на её место',
  miss: 'Не та широта',
  snap: 'Есть.',
  complete: 'Мир собран',
  replay: 'Ещё раз',
  loading: 'Собираем мир…',
  error: 'Не загрузилось.',
  search: 'Найти страну',
  all: 'Все',
  count: (n: number, total: number) => `${n} из ${total}`,
} as const

export const continentRu: Record<string, string> = {
  all: 'Все',
  Europe: 'Европа',
  Asia: 'Азия',
  Africa: 'Африка',
  'North America': 'Северная Америка',
  'South America': 'Южная Америка',
  Oceania: 'Океания',
  Antarctica: 'Антарктида',
}
