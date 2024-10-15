<route lang="yaml">
meta:
  title: SecuFlow Project List
</route>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '@/api'
import { useProjectStore } from '@/store/modules/projectStore.ts'
import { useProjectVisualizationStore } from '@/store/modules/projectVisualizationStore.ts'

defineOptions({
  name: 'SecuFlowProjectList',
})

const projectStore = useProjectStore()

// Define table data and search forms
const rawTableData = ref([])
const tableData = computed(() => {
  return rawTableData.value.map(item => ({
    ...item,
    displayStatus: transformStatus(item.status),
  }))
})
const searchForm = ref({
  projectName: projectStore.projectName,
  status: projectStore.selectedStatus,
})

// the back-end API
const apiUrl = 'projects/'

// Fetch data
async function fetchData(filters: any = {}) {
  try {
    // Send search criteria to the back end
    const response = await api.get(apiUrl, {
      params: filters,
      baseURL: '/mock/',
    })
    console.log(response)
    rawTableData.value = response.projects
  }
  catch (error) {
    console.error('Error fetching project data:', error)
  }
}

// Handler when the search button is clicked
function handleSearch() {
  projectStore.setSelectedStatus(searchForm.value.status)
  projectStore.setProjectName(searchForm.value.projectName)
  const filters = {
    project_name: searchForm.value.projectName,
    status: searchForm.value.status !== 'all' ? searchForm.value.status : undefined,
  }
  fetchData(filters)
}

// Reset Form
function handleReset() {
  projectStore.resetFilters()
  searchForm.value = {
    projectName: '',
    status: 'all',
  }
  fetchData() // Get all project data after reset
}

watch(() => projectStore.selectedStatus, (newStatus) => {
  searchForm.value.status = newStatus
  handleSearch()
})

watch(() => projectStore.projectName, (newName) => {
  searchForm.value.projectName = newName
  handleSearch()
})

// Get all data at initialization
onMounted(() => {
  fetchData({
    project_name: projectStore.projectName,
    status: projectStore.selectedStatus !== 'all' ? projectStore.selectedStatus : undefined,
  })
})

// Handle button clicks
const router = useRouter()
const projectVisualizationStore = useProjectVisualizationStore()
function handleView(row: any) {
  // ElMessage.success(`Viewing project id: ${row.project_id}`)
  projectVisualizationStore.setProjectId(row.project_id)
  router.push({ name: 'statistics' })
}

// Function to transform status
function transformStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    high: 'High Risk',
    mid: 'Medium Risk',
    low: 'Low Risk',
  }
  return statusMap[status] || status
}
</script>

<template>
  <div class="page-container">
    <!-- Search and filter Section -->
    <div class="search-container">
      <el-form :inline="true" :model="searchForm" class="form-content">
        <el-form-item label="Project Name">
          <el-input
            v-model="searchForm.projectName"
            placeholder="Please enter project name"
            style="width: 300px;"
            clearable
          />
        </el-form-item>
        <el-form-item label="Status">
          <el-select v-model="searchForm.status" placeholder="All" style="width: 150px;">
            <el-option label="All" value="all" />
            <el-option label="High Risk" value="high" />
            <el-option label="Medium Risk" value="mid" />
            <el-option label="Low Risk" value="low" />
          </el-select>
        </el-form-item>
      </el-form>

      <!-- Buttons -->
      <div class="buttons">
        <HButton style="justify-content: center;" @click="handleSearch">
          Search
        </HButton>
        <!--        <el-button type="primary" @click="handleSearch"> -->
        <!--          Search -->
        <!--        </el-button> -->
        <!--        <el-button style="margin-top: 10px;" @click="handleReset"> -->
        <!--          Reset -->
        <!--        </el-button> -->
        <HButton outline style=" justify-content: center;margin-top: 10px;" @click="handleReset">
          Reset
        </HButton>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-container">
      <el-table :data="tableData" class="table" height="300px" empty-text="Empty Data">
        <el-table-column prop="project_name" label="Project Name" align="center" width="300px" />
        <el-table-column prop="displayStatus" label="Status" align="center" width="450px" />
        <el-table-column fixed="right" label="Operations" align="center" width="400px">
          <template #default="scope">
            <h-button @click="handleView(scope.row)">
              View
            </h-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* 垂直居中 */
  min-height: 50vh;
  padding: 20px;
  //background-color: #f5f5f5;
}

.search-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 80%;
  margin-bottom: 20px;
}

.form-content {
  display: flex;
  flex-grow: 1;
  gap: 20px;
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.table-container {
  display: flex;
  justify-content: center;
  //width: 80%;
  margin-top: 10px;
  //background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.table {
  //justify-content: center;
  width: 100%;
  //max-width: 1200px;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.select-box:deep(.el-select) {
  width: 240px;
}
</style>
