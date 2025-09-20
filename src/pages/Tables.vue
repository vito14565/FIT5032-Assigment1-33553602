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

              <!-- Global search with an accessible label -->
              <div class="ms-2 flex-shrink-0">
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
              </div>
            </div>

            <!-- Data table: add aria-label; keep PrimeVue sorting/filtering behavior -->
            <!-- Using v-model:first and @page to announce pagination changes -->
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
              <!-- Screen-reader-only caption to describe the table purpose -->
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

            <!-- Live region announcing current page for SR users -->
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

              <!-- Global search with an accessible label -->
              <div class="ms-2 flex-shrink-0">
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

            <!-- Live region announcing current page for SR users -->
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
 * Firestore-backed tables with accessible search labels and live pagination status.
 * PrimeVue provides good ARIA by default; we add clear names (aria-label) and live announcements.
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { db } from '../firebase'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'

// PrimeVue
import { FilterMatchMode } from 'primevue/api'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'

// data
const recipes = ref([])
const users = ref([])
const loading = ref({ recipes: true, users: true })

let unsubRecipes = null
let unsubUsers = null

// ===== Filters (Recipes) =====
const recipeFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  title: { value: null, matchMode: FilterMatchMode.CONTAINS },
  caloriesStr: { value: null, matchMode: FilterMatchMode.CONTAINS },
  tagsStr: { value: null, matchMode: FilterMatchMode.CONTAINS },
  createdAtStr: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
})
const recipeGlobal = ref(null)
watch(recipeGlobal, v => (recipeFilters.value.global.value = v))

// ===== Filters (Users) =====
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

/** Convert timestamps to YYYY-MM-DD for display/filtering */
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

/* ---------- Live pagination status (SR-friendly) ---------- */
/* We track the first row index and rows per page for each table, then announce a page report. */
const recipesRows = 10
const usersRows = 10
const recipesFirst = ref(0)
const usersFirst = ref(0)
const recipesPageReport = ref('')
const usersPageReport = ref('')

function onRecipesPage(e) {
  // e.first (start index), e.rows (page size)
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

onMounted(() => {
  // Recipes
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
    // Initialize page report when data arrives
    onRecipesPage({ first: recipesFirst.value, rows: recipesRows })
  }, () => (loading.value.recipes = false))

  // Users
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
</script>

<style scoped>
/* Keep PrimeVue visuals; add small tweaks */
.nice-table :deep(.p-datatable-header) { padding: 0; }
.nice-table :deep(.p-datatable-wrapper) { border-radius: .5rem; }
.nice-table :deep(.p-paginator) { border: 0; padding-top: .5rem; }

.search-wrap { margin-left: 0.75rem; }

/* Icon inside InputText */
.p-input-icon-left { position: relative !important; display: inline-block !important; }
.p-input-icon-left > i {
  position: absolute !important;
  left: 0.9rem !important;
  transform: translateY(-50%) !important;
  top: 50%;
  color: #6c757d;
}
.p-input-icon-left > .p-inputtext {
  padding-left: 2.6rem !important;
  min-width: 260px;
}

@media (max-width: 576px) {
  .search-wrap { margin-left: 1rem; }
  .p-input-icon-left > .p-inputtext { min-width: 220px; }
}

.nice-table :deep(.p-datatable-thead > tr > th),
.nice-table :deep(.p-datatable-tbody > tr > td) {
  padding: .6rem .75rem;
}

/* Screen reader only helper (in case global style isn't loaded) */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}

.card { border-color: #e9ecef; }
</style>