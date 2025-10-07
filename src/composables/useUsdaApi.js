// src/composables/useUsdaApi.js
const API_BASE = 'https://api.nal.usda.gov/fdc/v1'
const API_KEY =
  import.meta.env.VITE_USDA_API_KEY ||
  'xDBucrEQOlMjsZmB57a79O72NFRbjst9jEpf0uUQ' 

console.log('[FDC] key present?', !!API_KEY, 'length:', API_KEY?.length || 0)

function getN(foodNutrients, id) {
  const x = (foodNutrients || []).find(
    n => n?.nutrient?.number == id || n?.nutrient?.id == id || n?.nutrientNumber == id
  )
  return typeof x?.amount === 'number'
    ? x.amount
    : typeof x?.value === 'number'
    ? x.value
    : 0
}

function round1(n) {
  const v = Number(n)
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : 0
}

function per100FromLabel(food) {
  const ln = food?.labelNutrients || {}
  let perServing = {
    kcal:      ln?.calories?.value ?? 0,
    carbs_g:   ln?.carbohydrates?.value ?? 0,
    protein_g: ln?.protein?.value ?? 0,
    fat_g:     ln?.fat?.value ?? 0,
  }


  let gramPerServing = 0
  const unit = (food?.servingSizeUnit || '').toLowerCase()
  const size = Number(food?.servingSize)

  if (size && unit === 'g') gramPerServing = size
  else if (size && unit === 'ml') gramPerServing = size 
  else if (size && unit === 'oz') gramPerServing = size * 28.3495
  else if (size && unit.replace(/\s+/g, '') === 'floz') gramPerServing = size * 29.5735
  else {
    const text = (food?.householdServingFullText || '').toLowerCase()
    const m = text.match(/([\d.]+)\s*(g|ml|oz|fl\s*oz)/)
    if (m) {
      const qty = parseFloat(m[1])
      const u = m[2].replace(/\s+/g, '')
      if (u === 'g') gramPerServing = qty
      else if (u === 'ml') gramPerServing = qty
      else if (u === 'oz') gramPerServing = qty * 28.3495
      else if (u === 'floz') gramPerServing = qty * 29.5735
    }
  }

  if (!gramPerServing) return null
  if (!(perServing.kcal || perServing.carbs_g || perServing.protein_g || perServing.fat_g)) return null

  const k = 100 / gramPerServing
  return {
    kcal:      round1(perServing.kcal * k),
    carbs_g:   round1(perServing.carbs_g * k),
    protein_g: round1(perServing.protein_g * k),
    fat_g:     round1(perServing.fat_g * k),
  }
}

async function fetchDetailPer100(fdcId) {
  const url = new URL(`${API_BASE}/food/${fdcId}`)
  url.searchParams.set('api_key', API_KEY)
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const food = await res.json()
  return per100FromLabel(food)
}

async function doSearch(query, pageSize, dataTypesCsv) {
  const url = new URL(`${API_BASE}/foods/search`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('query', query)
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('dataType', dataTypesCsv)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`USDA API ${res.status} ${res.statusText} — ${text.slice(0,160)}`)
  }

  const json = await res.json()
  const foods = json.foods || []

  const items = await Promise.all(
    foods.slice(0, pageSize).map(async f => {
      let kcal      = getN(f.foodNutrients, '1008')
      let carbs_g   = getN(f.foodNutrients, '1005')
      let protein_g = getN(f.foodNutrients, '1003')
      let fat_g     = getN(f.foodNutrients, '1004')

      if (!(kcal || carbs_g || protein_g || fat_g)) {
        const fromLabel = per100FromLabel(f)
        if (fromLabel) {
          ({ kcal, carbs_g, protein_g, fat_g } = fromLabel)
        } else {
          const detail = await fetchDetailPer100(f.fdcId)
          if (detail) ({ kcal, carbs_g, protein_g, fat_g } = detail)
        }
      }

      const name =
        f.description ||
        f.lowercaseDescription ||
        f.ingredients ||
        `FDC ${f.fdcId}`

      return {
        name,
        fdcId: f.fdcId,
        per100: {
          kcal:      round1(kcal),
          carbs_g:   round1(carbs_g),
          protein_g: round1(protein_g),
          fat_g:     round1(fat_g),
        }
      }
    })
  )

  return items.filter(x =>
    x.per100.kcal || x.per100.carbs_g || x.per100.protein_g || x.per100.fat_g
  )
}


export async function searchFoods(query, pageSize = 20) {
  if (!API_KEY) throw new Error('Missing VITE_USDA_API_KEY')

  let items = await doSearch(query, pageSize, 'Foundation,SR Legacy')
  if (!items.length) {
    items = await doSearch(query, pageSize, 'Branded')
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items.slice(0, pageSize)
}