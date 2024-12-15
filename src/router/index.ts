import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SendView from '../views/SendView.vue'
import ReceiveView from '@/views/ReceiveView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/send',
      name: 'send',
      component: SendView,
    },
    {
      path: '/receive',
      name: 'receive',
      component: ReceiveView,
    },
    // route level code-splitting
    // this generates a separate chunk (About.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
  ],
})

export default router
