<template>
  <div class="flex flex-col items-center mt-8 space-y-8">
    <h1 class="text-2xl font-bold">Interactive Tables</h1>

    <!-- Recipes Table -->
    <div class="w-11/12 md:w-4/5 border rounded-lg shadow-sm bg-white p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Recipes</h2>
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText v-model="recipeGlobal" placeholder="Global search (Recipes)" />
        </span>
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
        :globalFilterFields="['title','category','ownerId','avgRatingStr','createdAtStr']"
        class="p-datatable-sm"
        responsiveLayout="scroll"
      >
        <template #empty> No recipes found. </template>
        <template #loading> Loading recipes... </template>

        <Column field="title" header="Title" sortable filter />
        <Column field="category" header="Category" sortable filter />
        <Column field="ownerId" header="Owner" sortable filter />
        <Column field="avgRating" header="Avg Rating" sortable filter />
        <Column field="createdAtStr" header="Created" sortable filter />
      </DataTable>
    </div>

    <!-- Users Table -->
    <div class="w-11/12 md:w-4/5 border rounded-lg shadow-sm bg-white p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Users</h2>
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText v-model="userGlobal" placeholder="Global search (Users)" />
        </span>
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
        class="p-datatable-sm"
        responsiveLayout="scroll"
      >
        <template #empty> No users found. </template>
        <template #loading> Loading users... </template>

        <Column field="displayName" header="Name" sortable filter />
        <Column field="email" header="Email" sortable filter />
        <Column field="role" header="Role" sortable filter />
        <Column field="uid" header="UID" sortable filter />
        <Column field="createdAtStr" header="Created" sortable filter />
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { db } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { FilterMatchMode } from "primevue/api";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";

const recipes = ref([]);
const users = ref([]);
const loading = ref({ recipes: true, users: true });

let unsubRecipes = null;
let unsubUsers = null;

// Filters
const recipeFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});
const recipeGlobal = ref(null);
watch(recipeGlobal, (v) => (recipeFilters.value.global.value = v));

const userFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});
const userGlobal = ref(null);
watch(userGlobal, (v) => (userFilters.value.global.value = v));

function toDateStr(ts) {
  try {
    const d =
      ts?.toDate?.() ??
      (ts instanceof Date ? ts : new Date(ts?.seconds ? ts.seconds * 1000 : ts));
    return isNaN(d?.getTime?.())
      ? ""
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

onMounted(() => {
  unsubRecipes = onSnapshot(
    query(collection(db, "recipes"), orderBy("createdAt", "desc")),
    (snap) => {
      recipes.value = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAtStr: toDateStr(data.createdAt),
          avgRatingStr: String(Number(data.avgRating ?? 0).toFixed(1)),
        };
      });
      loading.value.recipes = false;
    }
  );

  unsubUsers = onSnapshot(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
    (snap) => {
      users.value = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAtStr: toDateStr(data.createdAt),
        };
      });
      loading.value.users = false;
    }
  );
});

onUnmounted(() => {
  unsubRecipes && unsubRecipes();
  unsubUsers && unsubUsers();
});
</script>