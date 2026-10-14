import DefaultTheme from 'vitepress/theme';
import { type Theme } from 'vitepress';

import '../../../src/styles/styles.css';
import './custom.css';
import DrawingDemo from './components/DrawingDemo.vue';
import Playground from './components/Playground.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DrawingDemo', DrawingDemo);
    app.component('Playground', Playground);
  },
} satisfies Theme;
