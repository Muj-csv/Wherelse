import './styles.css';
import { Game } from './game/Game';

try {
  new Game(document.querySelector<HTMLCanvasElement>('#world')!);
} catch(error) {
  console.error('Unable to launch Little Elsewhere:',error);
  document.getElementById('loading')?.remove();
  document.getElementById('unsupported')?.classList.remove('hidden');
}
