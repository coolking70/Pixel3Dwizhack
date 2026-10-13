import { createApp } from 'vue';
import Room from './Room.vue';
import './style.css';
createApp(Room, { dungeon: true }).mount('#app');
