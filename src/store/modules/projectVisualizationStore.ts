// stores/projectVisualizationStore.ts
import { defineStore } from 'pinia'
import api from '@/api'

interface MatrixData {
  [email: string]: {
    [email: string]: number
  }
}

export const useProjectVisualizationStore = defineStore('projectVisualization', {
  state: () => ({
    projectId: '1',
    requirementsMatrix: {} as MatrixData,
    activitiesMatrix: {} as MatrixData,
    mcstcValue: 0,
    projectName: '',
    createTime: '',
  }),
  actions: {
    setProjectId(id: string) {
      this.projectId = id
    },
    async fetchProjectData() {
      try {
        const response = await api.get(`/projects/${this.projectId}`, {
          baseURL: '/mock/',
        })
        this.requirementsMatrix = response.cr_matrix
        this.activitiesMatrix = response.ca_matrix
        this.mcstcValue = response.mc_stc_value
        this.projectName = response.project_name
        this.createTime = response.create_time
      }
      catch (error) {
        console.error('Error fetching project data:', error)
      }
    },
  },
})
