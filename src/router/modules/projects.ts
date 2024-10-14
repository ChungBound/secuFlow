import type { RouteRecordRaw } from 'vue-router'

function Layout() {
  return import('@/layouts/index.vue')
}

const routes: RouteRecordRaw = {
  path: '/projects',
  component: Layout,
  name: 'projectsLayout',
  meta: {
    title: 'projects',
    // icon: 'i-ri:database-2-line',
  },
  children: [
    {
      path: '',
      name: 'projects',
      component: () => import('@/views/secuFlow/project.list.vue'),
      meta: {
        title: 'projects',
      },
    },
  ],
}

export default routes
