<template>
  <div class="container py-4">
    <h2 class="text-center mb-4">Interactive Tables</h2>

    <div class="row g-4 justify-content-center">
      <!-- ========== Recipes Card ========== -->
      <div class="col-12 col-lg-6 d-flex">
        <div class="card shadow-sm w-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h5 class="card-title mb-0">Recipes</h5>
              <div class="ms-2 flex-shrink-0">
                <span class="p-input-icon-left search-wrap">
                  <i class="pi pi-search" />
                  <InputText v-model="recipeGlobal" placeholder="Global search (Recipes)" />
                </span>
              </div>
            </div>

            <DataTable
              :value="recipes"
              dataKey="id"
              :loading="loading.recipes"
              :paginator="true"
              :rows="10"
              :rowsPerPageOptions="[10,20,50]"
              sortMode="multiple"
              filterDisplay="menu"
              v-model:filters="recipeFilters"
              :globalFilterFields="['title','caloriesStr','tagsStr','createdAtStr']"
              class="p-datatable-sm nice-table"
              responsiveLayout="scroll"
            >
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
          </div>
        </div>
      </div>

      <!-- ========== Users Card ========== -->
      <div class="col-12 col-lg-6 d-flex">
        <div class="card shadow-sm w-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h5 class="card-title mb-0">Users</h5>
              <div class="ms-2 flex-shrink-0">
                <span class="p-input-icon-left search-wrap">
                  <i class="pi pi-search" />
                  <InputText v-model="userGlobal" placeholder="Global search (Users)" />
                </span>
              </div>
            </div>

            <DataTable
              :value="users"
              dataKey="id"
              :loading="loading.users"
              :paginator="true"
              :rows="10"
              :rowsPerPageOptions="[10,20,50]"
              sortMode="multiple"
              filterDisplay="menu"
              v-model:filters="userFilters"
              :globalFilterFields="['displayName','email','role','uid','createdAtStr']"
              class="p-datatable-sm nice-table"
              responsiveLayout="scroll"
            >
              <template #empty> No users found. </template>
              <template #loading> Loading users... </template>

              <Column field="displayName" header="Name" sortable filter :showFilterMatchModes="false" />
              <Column field="email" header="Email" sortable filter :showFilterMatchModes="false" />
              <Column field="role" header="Role" sortable filter :showFilterMatchModes="false" />
              <Column field="uid" header="UID" sortable filter :showFilterMatchModes="false" />
              <Column field="createdAtStr" header="Created" sortable filter />
            </DataTable>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Firestore 集合
 *  - recipes: { title, calories, tags[], createdAt? }
 *  - users:   { displayName, email, role, uid, createdAt? }
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
  }, () => (loading.value.users = false))
})

onUnmounted(() => {
  unsubRecipes && unsubRecipes()
  unsubUsers && unsubUsers()
})
</script>

<style scoped>
/* 讓整體更乾淨、貼近你現有頁面的感覺 */
.nice-table :deep(.p-datatable-header) { padding: 0; }
.nice-table :deep(.p-datatable-wrapper) { border-radius: .5rem; }
.nice-table :deep(.p-paginator) { border: 0; padding-top: .5rem; }

/* 與卡片邊緣的距離（外層容器） */
.search-wrap {
  margin-left: 0.75rem;             /* 與卡片左邊緣保持距離 */
}

/* 強制使用 PrimeVue 標準的「內嵌 icon」定位，icon 一定在輸入框裡 */
.p-input-icon-left {
  position: relative !important;
  display: inline-block !important;
}
.p-input-icon-left > i {
  position: absolute !important;
  left: 0.9rem !important;          /* icon 與輸入框邊的距離 */
  top: 50% !important;
  transform: translateY(-50%) !important;
  color: #6c757d;
}
.p-input-icon-left > .p-inputtext {
  padding-left: 2.6rem !important;  /* 讓文字不會壓到 icon */
  min-width: 260px;
}

/* 手機再多留空間避免擠邊 */
@media (max-width: 576px) {
  .search-wrap { margin-left: 1rem; }
  .p-input-icon-left > .p-inputtext { min-width: 220px; }
}

/* PrimeVue 的表格字距稍調小一點 */
.nice-table :deep(.p-datatable-thead > tr > th),
.nice-table :deep(.p-datatable-tbody > tr > td) {
  padding: .6rem .75rem;
}

/* 卡片邊框/陰影更柔和 */
.card { border-color: #e9ecef; }
</style>