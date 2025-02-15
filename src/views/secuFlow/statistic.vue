<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Options } from 'vis-network'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { useProjectVisualizationStore } from '@/store/modules/projectVisualizationStore'

interface MatrixData {
  [email: string]: {
    [email: string]: number
  }
}

interface NodeData {
  id: string
  title: string
  value: number
  group: string
  connections: number
  totalWeight: number
  connectionDetails: { [email: string]: number }
}

interface EdgeData {
  from: string
  to: string
  value: number
  title: string
  color: {
    color: string
    highlight: string
    hover: string
  }
}

const projectVisualizationStore = useProjectVisualizationStore()

const requirementsContainer = ref<HTMLElement | null>(null)
const activitiesContainer = ref<HTMLElement | null>(null)
const selectedNode = ref<NodeData | null>(null)
const selectedEdge = ref<EdgeData | null>(null)
const requirementsNodes = ref<DataSet<NodeData> | null>(null)
const requirementsEdges = ref<DataSet<EdgeData> | null>(null)
const activitiesNodes = ref<DataSet<NodeData> | null>(null)
const activitiesEdges = ref<DataSet<EdgeData> | null>(null)
let requirementsNetwork: Network | null = null
let activitiesNetwork: Network | null = null
const selectedNodes = ref<NodeData[]>([])
const searchQueries = ref({
  requirements: '',
  activities: '',
})

const isSidebarVisible = computed(() => selectedNode.value !== null || selectedEdge.value !== null)

const zoomControls = ref({
  requirements: {
    zoomIn: () => requirementsNetwork?.moveTo({ scale: requirementsNetwork.getScale() * 1.2 }),
    zoomOut: () => requirementsNetwork?.moveTo({ scale: requirementsNetwork.getScale() / 1.2 }),
    resetZoom: () => requirementsNetwork?.fit({ animation: true }),
  },
  activities: {
    zoomIn: () => activitiesNetwork?.moveTo({ scale: activitiesNetwork.getScale() * 1.2 }),
    zoomOut: () => activitiesNetwork?.moveTo({ scale: activitiesNetwork.getScale() / 1.2 }),
    resetZoom: () => activitiesNetwork?.fit({ animation: true }),
  },
})

const nodeGroups = {
  user: {
    color: { background: '#3498db', border: '#2980b9' },
    hover: { background: '#5faee3', border: '#2980b9' },
    highlight: { background: '#a6d0f3', border: '#2980b9' },
  },
  admin: {
    color: { background: '#e74c3c', border: '#c0392b' },
    hover: { background: '#ed7669', border: '#c0392b' },
    highlight: { background: '#f5b7b1', border: '#c0392b' },
  },
  guest: {
    color: { background: '#2ecc71', border: '#27ae60' },
    hover: { background: '#58d68d', border: '#27ae60' },
    highlight: { background: '#a9dfbf', border: '#27ae60' },
  },
}

const edgeColors = {
  'user-user': { color: '#bde0fe', highlight: '#3498db', hover: '#90caf9' },
  'user-admin': { color: '#ffcccb', highlight: '#e74c3c', hover: '#ef9a9a' },
  'user-guest': { color: '#c8e6c9', highlight: '#2ecc71', hover: '#a5d6a7' },
  'admin-admin': { color: '#e1bee7', highlight: '#9b59b6', hover: '#ce93d8' },
  'admin-guest': { color: '#fff9c4', highlight: '#f1c40f', hover: '#fff59d' },
  'guest-guest': { color: '#b2dfdb', highlight: '#1abc9c', hover: '#80cbc4' },
}

function formatDate(date: string | number): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function convertMatrixToGraph(matrix: MatrixData): { nodes: NodeData[], edges: EdgeData[] } {
  const nodes: NodeData[] = []
  const edges: EdgeData[] = []
  const nodeMap = new Map<string, NodeData>()
  const edgeSet = new Set<string>()

  Object.keys(matrix).forEach((email) => {
    const group = email.includes('zendesk') ? 'admin' : email.includes('gmail') ? 'guest' : 'user'
    const connectionDetails: { [email: string]: number } = {}
    let connections = 0
    let totalWeight = 0

    Object.entries(matrix[email]).forEach(([toEmail, weight]) => {
      if (email !== toEmail && weight > 0) {
        connections++
        totalWeight += weight
        connectionDetails[toEmail] = weight
      }
    })

    const node: NodeData = {
      id: email,
      title: email,
      value: Math.sqrt(connections),
      group,
      connections,
      totalWeight,
      connectionDetails,
    }
    nodes.push(node)
    nodeMap.set(email, node)
  })

  Object.entries(matrix).forEach(([fromEmail, connections]) => {
    Object.entries(connections).forEach(([toEmail, weight]) => {
      if (fromEmail !== toEmail && weight > 0) {
        const edgeId = [fromEmail, toEmail].sort().join('--')
        if (!edgeSet.has(edgeId)) {
          const fromGroup = nodeMap.get(fromEmail)?.group
          const toGroup = nodeMap.get(toEmail)?.group
          const colorKey = [fromGroup, toGroup].sort().join('-') as keyof typeof edgeColors
          edges.push({
            from: fromEmail,
            to: toEmail,
            value: Math.log(weight + 1),
            title: `Weight: ${weight}`,
            color: edgeColors[colorKey],
          })
          edgeSet.add(edgeId)
        }
      }
    })
  })

  return { nodes, edges }
}

function createNetwork(container: HTMLElement, data: { nodes: DataSet<NodeData>, edges: DataSet<EdgeData> }): Network {
  const nodeCount = data.nodes.length
  const baseSpringLength = Math.sqrt(nodeCount) * 10
  const options: Options = {
    nodes: {
      shape: 'dot',
      scaling: {
        min: 5,
        max: 30,
      },
      borderWidth: 2,
      shadow: true,
      color: {
        highlight: {
          border: '#ffa000',
          background: '#ffecb3',
        },
      },
    },
    edges: {
      width: 0.15,
      smooth: {
        type: 'continuous',
        forceDirection: 'none',
      },
    },
    groups: nodeGroups,
    physics: {
      stabilization: {
        iterations: 300,
        updateInterval: 25,
      },
      barnesHut: {
        gravitationalConstant: -2000 * Math.log(nodeCount),
        centralGravity: 0.1,
        springLength: baseSpringLength,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 0.5,
      },
    },
    layout: {
      improvedLayout: false,
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      hideEdgesOnDrag: true,
      multiselect: true,
      navigationButtons: true,
      keyboard: true,
      zoomView: true,
    },
  }

  const network = new Network(container, data, options)

  network.on('stabilizationIterationsDone', () => {
    network.setOptions({ physics: false })
  })

  return network
}

function searchNodes(networkType: 'requirements' | 'activities') {
  const nodes = networkType === 'requirements' ? requirementsNodes.value : activitiesNodes.value
  const network = networkType === 'requirements' ? requirementsNetwork : activitiesNetwork
  const query = searchQueries.value[networkType]

  if (!nodes || !network || !query) { return }

  const searchResults = nodes.get({
    filter: node => node.id.toLowerCase().includes(query.toLowerCase()),
  })

  if (searchResults.length > 0) {
    network.selectNodes(searchResults.map(node => node.id))
    network.focus(searchResults[0].id, {
      scale: 1.2,
      animation: true,
    })
  }
  else {
    alert('No nodes found matching the search query.')
  }
}

function handleNetworkClick(params: any, networkType: 'requirements' | 'activities') {
  const nodes = networkType === 'requirements' ? requirementsNodes.value : activitiesNodes.value
  const edges = networkType === 'requirements' ? requirementsEdges.value : activitiesEdges.value

  if (params.nodes.length > 0) {
    const nodeId = params.nodes[0]
    selectedNodes.value = [nodes?.get(nodeId)]
    selectedEdge.value = null
  }
  else if (params.edges.length > 0) {
    const edgeId = params.edges[0]
    const edge = edges?.get(edgeId)
    selectedEdge.value = edge
    if (edge) {
      selectedNodes.value = [nodes?.get(edge.from), nodes?.get(edge.to)].filter(Boolean) as NodeData[]
    }
  }
  else {
    selectedNodes.value = []
    selectedEdge.value = null
  }
}

async function fetchDataAndCreateNetworks() {
  try {
    await projectVisualizationStore.fetchProjectData()

    const requirementsData = convertMatrixToGraph(projectVisualizationStore.requirementsMatrix)
    const activitiesData = convertMatrixToGraph(projectVisualizationStore.activitiesMatrix)

    requirementsNodes.value = new DataSet<NodeData>(requirementsData.nodes)
    requirementsEdges.value = new DataSet<EdgeData>(requirementsData.edges)
    activitiesNodes.value = new DataSet<NodeData>(activitiesData.nodes)
    activitiesEdges.value = new DataSet<EdgeData>(activitiesData.edges)

    if (requirementsContainer.value && activitiesContainer.value) {
      requirementsNetwork = createNetwork(requirementsContainer.value, { nodes: requirementsNodes.value, edges: requirementsEdges.value })
      activitiesNetwork = createNetwork(activitiesContainer.value, { nodes: activitiesNodes.value, edges: activitiesEdges.value })

      requirementsNetwork.on('click', params => handleNetworkClick(params, 'requirements'))
      activitiesNetwork.on('click', params => handleNetworkClick(params, 'activities'))

      requirementsNetwork.on('click', ({ nodes, edges }) => {
        if (nodes.length > 0) {
          selectedNode.value = requirementsNodes.value?.get(nodes[0])
        }
        else if (edges.length > 0) {
          selectedEdge.value = requirementsEdges.value?.get(edges[0])
        }
        else {
          selectedNode.value = null
          selectedEdge.value = null
        }
      })

      activitiesNetwork.on('click', ({ nodes, edges }) => {
        if (nodes.length > 0) {
          selectedNode.value = activitiesNodes.value?.get(nodes[0])
        }
        else if (edges.length > 0) {
          selectedEdge.value = activitiesEdges.value?.get(edges[0])
        }
        else {
          selectedNode.value = null
          selectedEdge.value = null
        }
      })
    }
  }
  catch (error) {
    console.error('Error fetching or processing data:', error)
  }
}

onMounted(() => {
  fetchDataAndCreateNetworks()
})
</script>

<template>
  <div class="network-container">
    <header class="project-header">
      <h1>{{ projectVisualizationStore.projectName }}</h1>
      <p>Created on: {{ formatDate(projectVisualizationStore.createTime) }}</p>
    </header>

    <div class="graphs-container">
      <div class="graph-wrapper">
        <h2>Coordination Requirements Graph</h2>
        <div class="graph-area">
          <div ref="requirementsContainer" class="network-graph" />
          <div class="graph-controls">
            <div class="zoom-controls">
              <HButton @click="zoomControls.requirements.zoomIn">
                +
              </HButton>
              <HButton @click="zoomControls.requirements.zoomOut">
                -
              </HButton>
              <HButton @click="zoomControls.requirements.resetZoom">
                Reset
              </HButton>
            </div>
            <div class="search-control">
              <input v-model="searchQueries.requirements" placeholder="Search nodes" @keyup.enter="searchNodes('requirements')">
              <HButton @click="searchNodes('requirements')">
                Search
              </HButton>
            </div>
          </div>
        </div>
      </div>

      <div class="legend-wrapper">
        <div class="legend">
          <h4>Legend</h4>
          <div class="node-types">
            <h5>Node Types:</h5>
            <div v-for="(group, type) in nodeGroups" :key="type" class="legend-item">
              <span class="color-dot" :style="{ backgroundColor: group.color.background }" />
              <span>{{ type }}</span>
            </div>
          </div>
          <div class="edge-types">
            <h5>Edge Types:</h5>
            <div v-for="(color, type) in edgeColors" :key="type" class="legend-item">
              <span class="color-line" :style="{ backgroundColor: color.color }" />
              <span>{{ type }}</span>
            </div>
          </div>
        </div>
        <div class="mc-stc-wrapper">
          <h3>MC-STC Value: {{ projectVisualizationStore.mcstcValue.toFixed(4) }}</h3>
          <div class="progress-bar">
            <div class="progress" :style="{ width: `${projectVisualizationStore.mcstcValue * 100}%` }" />
          </div>
        </div>
      </div>

      <div class="graph-wrapper">
        <h3>Coordination Activities Graph</h3>
        <div class="graph-area">
          <div ref="activitiesContainer" class="network-graph" />
          <div class="graph-controls">
            <div class="zoom-controls">
              <HButton @click="zoomControls.activities.zoomIn">
                +
              </HButton>
              <HButton @click="zoomControls.activities.zoomOut">
                -
              </HButton>
              <HButton @click="zoomControls.activities.resetZoom">
                Reset
              </HButton>
            </div>
            <div class="search-control">
              <input v-model="searchQueries.activities" placeholder="Search nodes" @keyup.enter="searchNodes('activities')">
              <HButton @click="searchNodes('activities')">
                Search
              </HButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <transition name="slide">
      <div v-if="selectedNodes.length > 0 || selectedEdge" class="sidebar">
        <button class="close-btn" @click="selectedNodes = []; selectedEdge = null">
          &times;
        </button>
        <template v-if="selectedNodes.length === 1">
          <h3>Node Details</h3>
          <p><strong>Email:</strong> {{ selectedNodes[0].id }}</p>
          <p><strong>Connected Nodes:</strong> {{ selectedNodes[0].connections }}</p>
          <p><strong>Total Weight:</strong> {{ selectedNodes[0].totalWeight }}</p>
          <p><strong>Group:</strong> {{ selectedNodes[0].group }}</p>
          <h4>Connection Details:</h4>
          <ul>
            <li v-for="(weight, email) in selectedNodes[0].connectionDetails" :key="email">
              {{ email }}: {{ weight }}
            </li>
          </ul>
        </template>
        <template v-else-if="selectedEdge && selectedNodes.length === 2">
          <h3>Edge Details</h3>
          <p><strong>Weight:</strong> {{ selectedEdge.title.split(': ')[1] }}</p>
          <h4>Connected Nodes:</h4>
          <div v-for="node in selectedNodes" :key="node.id">
            <h5>{{ node.id }}</h5>
            <p><strong>Group:</strong> {{ node.group }}</p>
            <p><strong>Connections:</strong> {{ node.connections }}</p>
            <p><strong>Total Weight:</strong> {{ node.totalWeight }}</p>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.network-container {
  display: flex;
  flex-direction: column;
  height: 82vh;
  padding: 20px;
  font-family: Arial, sans-serif;
  background-color: #f5f7fa;
}

.project-header {
  margin-bottom: 20px;
  text-align: center;
}

.project-header h1 {
  margin-bottom: 5px;
  font-size: 24px;
  color: #2c3e50;
}

.project-header p {
  font-size: 14px;
  color: #7f8c8d;
}

.graphs-container {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.graph-wrapper {
  width: 40%;
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
}

.legend-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
  justify-content: flex-start;
  width: 18%;
}

.legend,
 .mc-stc-wrapper {
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
}

.graph-area {
  position: relative;
  height: 500px;
}

.network-graph {
  width: 100%;
  height: 100%;
}

.graph-controls {
  position: absolute;
  top: -5vh;
  right: 5vh;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.zoom-controls,
 .search-control {
  display: flex;
  gap: 5px;
}

.zoom-controls button,
 .search-control button {
  padding: 5px 10px;
  //background-color: #3498db;
  //color: white;
  //border: none;
  //border-radius: 3px;
  //cursor: pointer;
  //font-size: 14px;
  transition: background-color 0.3s;
}

.zoom-controls button:hover,
 .search-control button:hover {
  background-color: #2980b9;
}

.search-control input {
  width: 150px;
  padding: 5px;
  font-size: 14px;
  border: 1px solid #bdc3c7;
  border-radius: 3px;
}

.legend h4,
 .mc-stc-wrapper h3 {
  margin-bottom: 10px;
  font-size: 16px;
  color: #34495e;
}

.legend h5 {
  margin-top: 10px;
  margin-bottom: 5px;
  font-size: 14px;
  color: #7f8c8d;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.color-dot {
  width: 12px;
  height: 12px;
  margin-right: 5px;
  border-radius: 50%;
}

.color-line {
  width: 20px;
  height: 3px;
  margin-right: 5px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  overflow: hidden;
  background-color: #ecf0f1;
  border-radius: 10px;
}

.progress {
  height: 100%;
  background-color: #2ecc71;
  transition: width 0.5s ease-in-out;
}

/* Sidebar styles remain unchanged */
.sidebar {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 11;
  width: 300px;
  height: 80vh;
  padding: 20px;
  overflow-y: auto;
  background-color: white;
  box-shadow: -2px 0 5px rgb(0 0 0 / 10%);
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 20px;
  color: #7f8c8d;
  cursor: pointer;
  background: none;
  border: none;
}
</style>
