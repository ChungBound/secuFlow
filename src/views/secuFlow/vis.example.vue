<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { Network, Options, Node, Edge } from 'vis-network'
import { DataSet } from 'vis-data'
import api from '@/api'

interface MatrixData {
  [email: string]: {
    [email: string]: number
  }
}

interface NodeData extends Node {
  id: string
  title: string
  value: number
  group: string
  connections: number
  totalWeight: number
  connectionDetails: { [email: string]: number }
}

interface EdgeData extends Edge {
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

interface GraphData {
  nodes: NodeData[]
  edges: EdgeData[]
}

const networkContainer = ref<HTMLElement | null>(null)
const selectedNode = ref<NodeData | null>(null)
const searchQuery = ref('')
const nodes = ref<DataSet<NodeData> | null>(null)
const edges = ref<DataSet<EdgeData> | null>(null)
let network: Network | null = null

const isSidebarVisible = computed(() => selectedNode.value !== null)

const zoomControls = ref({
  zoomIn: () => {},
  zoomOut: () => {},
  resetZoom: () => {},
})

const nodeGroups = {
  user: {
    color: { background: '#3498db', border: '#2980b9' },
    hover: { background: '#5faee3', border: '#2980b9' },
    highlight: { background: '#a6d0f3', border: '#2980b9' }
  },
  admin: {
    color: { background: '#e74c3c', border: '#c0392b' },
    hover: { background: '#ed7669', border: '#c0392b' },
    highlight: { background: '#f5b7b1', border: '#c0392b' }
  },
  guest: {
    color: { background: '#2ecc71', border: '#27ae60' },
    hover: { background: '#58d68d', border: '#27ae60' },
    highlight: { background: '#a9dfbf', border: '#27ae60' }
  },
}

const edgeColors = {
  'user-user': { color: '#bde0fe', highlight: '#3498db', hover: '#90caf9' },
  'user-admin': { color: '#ffcccb', highlight: '#e74c3c', hover: '#ef9a9a' },
  'user-guest': { color: '#c8e6c9', highlight: '#2ecc71', hover: '#a5d6a7' },
  'admin-admin': { color: '#e1bee7', highlight: '#9b59b6', hover: '#ce93d8' },
  'admin-guest': { color: '#fff9c4', highlight: '#f1c40f', hover: '#fff59d' },
  'guest-guest': { color: '#b2dfdb', highlight: '#1abc9c', hover: '#80cbc4' }
}

function convertMatrixToGraph(matrix: MatrixData): GraphData {
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
      connectionDetails
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
            color: edgeColors[colorKey]
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
          background: '#ffecb3'
        }
      }
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

async function fetchDataAndCreateNetwork() {
  try {
    const response = await api.get('/projects/1')
    const matrix: MatrixData = response.ca_matrix

    const { nodes: nodesData, edges: edgesData } = convertMatrixToGraph(matrix)

    nodes.value = new DataSet<NodeData>(nodesData)
    edges.value = new DataSet<EdgeData>(edgesData)

    if (networkContainer.value) {
      network = createNetwork(networkContainer.value, { nodes: nodes.value, edges: edges.value })

      network.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0]
          selectedNode.value = nodes.value?.get(nodeId) || null
        }
        else {
          selectedNode.value = null
        }
      })

      zoomControls.value = {
        zoomIn: () => network?.moveTo({ scale: network.getScale() * 1.2 }),
        zoomOut: () => network?.moveTo({ scale: network.getScale() / 1.2 }),
        resetZoom: () => network?.fit({ animation: true }),
      }
    }
  }
  catch (error) {
    console.error('Error fetching or processing data:', error)
  }
}

onMounted(() => {
  fetchDataAndCreateNetwork()
})

function closeSidebar() {
  selectedNode.value = null
}

function searchNodes() {
  if (!nodes.value || !network) return

  const searchResults = nodes.value.get({
    filter: function (node) {
      return node.id.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        node.id.split('@')[0].toLowerCase().includes(searchQuery.value.toLowerCase())
    }
  })

  if (searchResults.length > 0) {
    network.selectNodes(searchResults.map(node => node.id))
    network.focus(searchResults[0].id, {
      scale: 1.2,
      animation: true
    })
  } else {
    alert('No nodes found matching the search query.')
  }
}
</script>

<template>
  <div class="network-container">
    <div ref="networkContainer" class="graph-area"></div>
    <div class="controls">
      <div class="zoom-controls">
        <button @click="zoomControls.zoomIn">+</button>
        <button @click="zoomControls.zoomOut">-</button>
        <button @click="zoomControls.resetZoom">Reset</button>
      </div>
      <div class="search-controls">
        <input v-model="searchQuery" placeholder="Search by name or email" @keyup.enter="searchNodes">
        <button @click="searchNodes">Search</button>
      </div>
    </div>
    <div class="legend">
      <h4>Legend</h4>
      <div class="node-types">
        <h5>Node Types:</h5>
        <div v-for="(group, type) in nodeGroups" :key="type" class="legend-item">
          <span class="color-dot" :style="{ backgroundColor: group.color.background }"></span>
          <span>{{ type }}</span>
        </div>
      </div>
      <div class="edge-types">
        <h5>Edge Types:</h5>
        <div v-for="(color, type) in edgeColors" :key="type" class="legend-item">
          <span class="color-line" :style="{ backgroundColor: color.color }"></span>
          <span>{{ type }}</span>
        </div>
      </div>
    </div>
    <transition name="slide">
      <div v-if="isSidebarVisible" class="sidebar">
        <button class="close-btn" @click="closeSidebar">&times;</button>
        <h3>Node Details</h3>
        <p><strong>Email:</strong> {{ selectedNode?.id }}</p>
        <p><strong>Connected Nodes:</strong> {{ selectedNode?.connections }}</p>
        <p><strong>Total Weight:</strong> {{ selectedNode?.totalWeight }}</p>
        <p><strong>Group:</strong> {{ selectedNode?.group }}</p>
        <h4>Connection Details:</h4>
        <ul>
          <li v-for="(weight, email) in selectedNode?.connectionDetails" :key="email">
            {{ email }}: {{ weight }}
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.network-container {
  display: flex;
  height: 80vh;
  position: relative;
}

.graph-area {
  flex-grow: 1;
  border: 1px solid lightgray;
}

.controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.zoom-controls, .search-controls {
  display: flex;
  gap: 5px;
}

.zoom-controls button, .search-controls button {
  padding: 5px 10px;
}

.search-controls input {
  padding: 5px;
  width: 200px;
}

.legend {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.legend h4, .legend h5 {
  margin: 5px 0;
}

.legend-item {
  display: flex;
  align-items: center;
  margin: 5px 0;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 5px;
}

.color-line {
  width: 20px;
  height: 3px;
  margin-right: 5px;
}

.sidebar {
  width: 300px;
  background-color: #f8f8f8;
  padding: 20px;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  overflow-y: auto;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
