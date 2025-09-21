<template>
  <div class="container py-4">
    <h1 class="text-center mb-4">Interactive Tables</h1>

    <div class="row g-4 justify-content-center">
      <!-- ========== Recipes Card ========== -->
      <div class="col-12 col-lg-6 d-flex">
        <div class="card shadow-sm w-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h2 class="card-title h5 mb-0">Recipes</h2>

              <!-- Toolbar: global search + CSV + PDF -->
              <div class="d-flex align-items-center gap-2 ms-2 flex-shrink-0">
                <label class="sr-only" for="recipes-search">Global search (Recipes)</label>
                <span class="p-input-icon-left search-wrap">
                  <i class="pi pi-search" aria-hidden="true" />
                  <InputText
                    id="recipes-search"
                    v-model="recipeGlobal"
                    placeholder="Global search (Recipes)"
                    aria-label="Global search recipes"
                  />
                </span>

                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  @click="exportRecipesCSV"
                  title="Export recipes as CSV"
                >
                  Export CSV
                </button>

                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  @click="exportRecipesPDF"
                  title="Export recipes as PDF"
                >
                  PDF (Recipes)
                </button>
              </div>
            </div>

            <DataTable
              :value="recipes"
              dataKey="id"
              :loading="loading.recipes"
              :paginator="true"
              v-model:first="recipesFirst"
              :rows="recipesRows"
              :rowsPerPageOptions="[10,20,50]"
              sortMode="multiple"
              filterDisplay="menu"
              v-model:filters="recipeFilters"
              :globalFilterFields="['title','caloriesStr','tagsStr','createdAtStr']"
              class="p-datatable-sm nice-table"
              responsiveLayout="scroll"
              aria-label="Recipes table"
              @page="onRecipesPage"
            >
              <template #caption>
                <span class="sr-only">Table of recipe items with title, calories, tags and created date.</span>
              </template>

              <template #empty> No recipes found. </template>
              <template #loading> Loading recipes... </template>

              <Column field="title" header="Title" sortable filter :showFilterMatchModes="false" />
              <Column field="calories" header="Calories" sortable filter :showFilterMatchModes="false">
                <template #body="{ data }">{{ data.calories }}</template>
              </Column>
              <Column field="tagsStr" header="Tags" sortable filter :showFilterMatchModes="false">
                <template #body="{ data }">
                  <span v-for="t in data.tags" :key="t" class="badge bg-secondary me-1">{{ t }}</span>
                </template>
              </Column>
              <Column field="createdAtStr" header="Created" sortable filter />
            </DataTable>

            <p class="mt-2 small text-muted" aria-live="polite">
              {{ recipesPageReport }}
            </p>
          </div>
        </div>
      </div>

      <!-- ========== Users Card ========== -->
      <div class="col-12 col-lg-6 d-flex">
        <div class="card shadow-sm w-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h2 class="card-title h5 mb-0">Users</h2>

              <!-- Toolbar: global search + CSV + PDF -->
              <div class="d-flex align-items-center gap-2 ms-2 flex-shrink-0">
                <label class="sr-only" for="users-search">Global search (Users)</label>
                <span class="p-input-icon-left search-wrap">
                  <i class="pi pi-search" aria-hidden="true" />
                  <InputText
                    id="users-search"
                    v-model="userGlobal"
                    placeholder="Global search (Users)"
                    aria-label="Global search users"
                  />
                </span>

                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  @click="exportUsersCSV"
                  title="Export users as CSV"
                >
                  Export CSV
                </button>

                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  @click="exportUsersPDF"
                  title="Export users as PDF"
                >
                  PDF (Users)
                </button>
              </div>
            </div>

            <DataTable
              :value="users"
              dataKey="id"
              :loading="loading.users"
              :paginator="true"
              v-model:first="usersFirst"
              :rows="usersRows"
              :rowsPerPageOptions="[10,20,50]"
              sortMode="multiple"
              filterDisplay="menu"
              v-model:filters="userFilters"
              :globalFilterFields="['displayName','email','role','uid','createdAtStr']"
              class="p-datatable-sm nice-table"
              responsiveLayout="scroll"
              aria-label="Users table"
              @page="onUsersPage"
            >
              <template #caption>
                <span class="sr-only">Table of users with name, email, role, UID and created date.</span>
              </template>

              <template #empty> No users found. </template>
              <template #loading> Loading users... </template>

              <Column field="displayName" header="Name" sortable filter :showFilterMatchModes="false" />
              <Column field="email" header="Email" sortable filter :showFilterMatchModes="false" />
              <Column field="role" header="Role" sortable filter :showFilterMatchModes="false" />
              <Column field="uid" header="UID" sortable filter :showFilterMatchModes="false" />
              <Column field="createdAtStr" header="Created" sortable filter />
            </DataTable>

            <p class="mt-2 small text-muted" aria-live="polite">
              {{ usersPageReport }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Tables + CSV & PDF export (jsPDF + autotable)
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { db } from '../firebase'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'

// PrimeVue
import { FilterMatchMode } from 'primevue/api'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'

// PDF
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const recipes = ref([])
const users = ref([])
const loading = ref({ recipes: true, users: true })

let unsubRecipes = null
let unsubUsers = null

/* ---------- Filters (Recipes) ---------- */
const recipeFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  title: { value: null, matchMode: FilterMatchMode.CONTAINS },
  caloriesStr: { value: null, matchMode: FilterMatchMode.CONTAINS },
  tagsStr: { value: null, matchMode: FilterMatchMode.CONTAINS },
  createdAtStr: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
})
const recipeGlobal = ref(null)
watch(recipeGlobal, v => (recipeFilters.value.global.value = v))

/* ---------- Filters (Users) ---------- */
const userFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  displayName: { value: null, matchMode: FilterMatchMode.CONTAINS },
  email: { value: null, matchMode: FilterMatchMode.CONTAINS },
  role: { value: null, matchMode: FilterMatchMode.CONTAINS },
  uid: { value: null, matchMode: FilterMatchMode.CONTAINS },
  createdAtStr: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
})
const userGlobal = ref(null)
watch(userGlobal, v => (userFilters.value.global.value = v))

/** Timestamp → YYYY-MM-DD */
function toDateStr(ts) {
  try {
    const d = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date(ts?.seconds ? ts.seconds * 1000 : ts))
    if (isNaN(d?.getTime?.())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  } catch { return '' }
}

/* ---------- Pagination live text ---------- */
const recipesRows = 10
const usersRows   = 10
const recipesFirst = ref(0)
const usersFirst   = ref(0)
const recipesPageReport = ref('')
const usersPageReport   = ref('')

function onRecipesPage(e) {
  recipesFirst.value = e.first
  const page = Math.floor(e.first / e.rows) + 1
  const totalPages = Math.max(1, Math.ceil(recipes.value.length / e.rows))
  recipesPageReport.value = `Page ${page} of ${totalPages}`
}
function onUsersPage(e) {
  usersFirst.value = e.first
  const page = Math.floor(e.first / e.rows) + 1
  const totalPages = Math.max(1, Math.ceil(users.value.length / e.rows))
  usersPageReport.value = `Page ${page} of ${totalPages}`
}

/* ---------- Live Firestore data ---------- */
onMounted(() => {
  const q1 = query(collection(db, 'recipes'), orderBy('title', 'asc'))
  unsubRecipes = onSnapshot(q1, snap => {
    recipes.value = snap.docs.map(d => {
      const data = d.data()
      const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
      const calories = typeof data.calories === 'number' ? data.calories : (data.calories ? Number(data.calories) : 0)
      return {
        id: d.id,
        title: data.title ?? '',
        calories,
        caloriesStr: String(calories),
        tags,
        tagsStr: tags.join(', '),
        createdAtStr: toDateStr(data.createdAt),
      }
    })
    loading.value.recipes = false
    onRecipesPage({ first: recipesFirst.value, rows: recipesRows })
  }, () => (loading.value.recipes = false))

  const q2 = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
  unsubUsers = onSnapshot(q2, snap => {
    users.value = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        uid: data.uid ?? d.id,
        displayName: data.displayName ?? '',
        email: data.email ?? '',
        role: data.role ?? 'user',
        createdAtStr: toDateStr(data.createdAt),
      }
    })
    loading.value.users = false
    onUsersPage({ first: usersFirst.value, rows: usersRows })
  }, () => (loading.value.users = false))
})

onUnmounted(() => {
  unsubRecipes && unsubRecipes()
  unsubUsers && unsubUsers()
})

/* ====================== CSV Export ====================== */
function toCSV(rows, headers) {
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    const needsQuote = /[",\n]/.test(s)
    const body = s.replace(/"/g, '""')
    return needsQuote ? `"${body}"` : body
  }
  const head = headers.map(h => esc(h.label)).join(',')
  const body = rows.map(r => headers.map(h => esc(r[h.key])).join(',')).join('\n')
  return '\uFEFF' + head + '\n' + body
}
function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
function exportRecipesCSV() {
  const headers = [
    { key: 'title',        label: 'Title' },
    { key: 'calories',     label: 'Calories' },
    { key: 'tagsStr',      label: 'Tags' },
    { key: 'createdAtStr', label: 'Created' },
  ]
  const rows = recipes.value.map(r => ({
    title: r.title ?? '',
    calories: r.calories ?? '',
    tagsStr: Array.isArray(r.tags) ? r.tags.join(', ') : (r.tagsStr ?? ''),
    createdAtStr: r.createdAtStr ?? '',
  }))
  const csv = toCSV(rows, headers)
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
  downloadTextFile(`recipes-${stamp}.csv`, csv)
}
function exportUsersCSV() {
  const headers = [
    { key: 'displayName',  label: 'Name' },
    { key: 'email',        label: 'Email' },
    { key: 'role',         label: 'Role' },
    { key: 'uid',          label: 'UID' },
    { key: 'createdAtStr', label: 'Created' },
  ]
  const rows = users.value.map(u => ({
    displayName: u.displayName ?? '',
    email: u.email ?? '',
    role: u.role ?? '',
    uid: u.uid ?? u.id ?? '',
    createdAtStr: u.createdAtStr ?? '',
  }))
  const csv = toCSV(rows, headers)
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
  downloadTextFile(`users-${stamp}.csv`, csv)
}

/* ====================== PDF Export ====================== */
/** Shared: add footer with page numbers and timestamp */
function addFooter(pdf) {
  const pageCount = pdf.internal.getNumberOfPages()
  const stamp = new Date().toLocaleString()
  pdf.setFontSize(9)
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    const w = pdf.internal.pageSize.getWidth()
    const h = pdf.internal.pageSize.getHeight()
    pdf.text(`Generated: ${stamp}`, 14, h - 8)
    pdf.text(`Page ${i} of ${pageCount}`, w - 14, h - 8, { align: 'right' })
  }
}

/** Recipes → PDF */
function exportRecipesPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text('Recipes', 40, 40)

  autoTable(doc, {
    startY: 60,
    head: [['Title', 'Calories', 'Tags', 'Created']],
    body: recipes.value.map(r => [
      r.title ?? '',
      (r.calories ?? '').toString(),
      Array.isArray(r.tags) ? r.tags.join(', ') : (r.tagsStr ?? ''),
      r.createdAtStr ?? ''
    ]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [33, 150, 243] },
    theme: 'striped',
    margin: { left: 40, right: 40 },
  })

  addFooter(doc)
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
  doc.save(`recipes-${stamp}.pdf`)
}

/** Users → PDF */
function exportUsersPDF() {
  // Wide columns (UID, Email) look better in landscape
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text('Users', 40, 40)

  autoTable(doc, {
    startY: 60,
    head: [['Name', 'Email', 'Role', 'UID', 'Created']],
    body: users.value.map(u => [
      u.displayName ?? '',
      u.email ?? '',
      u.role ?? '',
      u.uid ?? u.id ?? '',
      u.createdAtStr ?? ''
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [233, 30, 99] },
    theme: 'striped',
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      // Allow UID column to wrap instead of overflowing
      if (data.column.index === 3) data.cell.styles.cellWidth = 200
    },
  })

  addFooter(doc)
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
  doc.save(`users-${stamp}.pdf`)
}
</script>

<style scoped>
/* Small visual tweaks */
.nice-table :deep(.p-datatable-header) { padding: 0; }
.nice-table :deep(.p-datatable-wrapper) { border-radius: .5rem; }
.nice-table :deep(.p-paginator) { border: 0; padding-top: .5rem; }

.search-wrap { margin-left: 0.75rem; }

.p-input-icon-left { position: relative !important; display: inline-block !important; }
.p-input-icon-left > i {
  position: absolute !important;
  left: 0.9rem !important;
  transform: translateY(-50%) !important;
  top: 50%;
  color: #6c757d;
}
.p-input-icon-left > .p-inputtext { padding-left: 2.6rem !important; min-width: 220px; }

.nice-table :deep(.p-datatable-thead > tr > th),
.nice-table :deep(.p-datatable-tbody > tr > td) { padding: .6rem .75rem; }

.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden; clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
</style>