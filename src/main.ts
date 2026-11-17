import './style.css';
import { startApp } from './app/app.ts';

const container = document.getElementById('app');
if (!container) throw new Error('#app が見つかりません');
startApp(container);
