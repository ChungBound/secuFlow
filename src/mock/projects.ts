import fs from 'node:fs'
import path from 'node:path'
import { defineFakeRoute } from 'vite-plugin-fake-server/client'

// 模拟从文件读取矩阵数据
function readMatrixFromFile(filename) {
  const filePath = path.join(__dirname, filename)
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(fileContent)
}

const caMatrix = readMatrixFromFile('mock-file/ca_matrix.json')
const crMatrix = readMatrixFromFile('mock-file/cr_matrix.json')

export default defineFakeRoute([
  {
    url: '/mock/overview/',
    method: 'get',
    response: () => {
      return {

        highRiskCount: 1,
        midRiskCount: 1,
        lowRiskCount: 1,
        totalRiskCount: 3,

      }
    },
  },
  {
    url: '/mock/projects',
    method: 'get',
    response: ({ query }) => {
      const { project_name, status } = query
      let projects = [
        {
          project_id: 1,
          project_name: 'test_repo',
          status: 'mid',
        },
        {
          project_id: 2,
          project_name: 'alpha_project',
          status: 'low',
        },
        {
          project_id: 3,
          project_name: 'beta_initiative',
          status: 'high',
        },
      ]

      if (project_name) {
        if (typeof project_name === 'string') {
          projects = projects.filter(p => p.project_name.includes(project_name))
        }
      }
      if (status) {
        // eslint-disable-next-line eqeqeq
        projects = projects.filter(p => p.status == status)
      }

      return {
        projects,
      }
    },
  },
  {
    url: '/mock/projects/:id',
    method: 'get',
    response: ({ params }) => {
      const id = Number.parseInt(<string>params.id)
      const projectNames = ['test_repo', 'alpha_project', 'beta_initiative']
      return {
        project_id: id,
        project_name: projectNames[id - 1] || `Project ${id}`,
        ca_matrix: caMatrix,
        cr_matrix: crMatrix,
        coordination_date: '2024-10-10T00:25:10.563021',
        create_time: '2024-10-10T00:25:10.563021',
        mc_stc_value: 0.28071433631923476,
      }
    },
  },
])
