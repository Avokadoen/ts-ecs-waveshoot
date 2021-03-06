import { fromEvent } from "rxjs";
import { WaveShooterGame } from './wave-shooter';

fromEvent(window, 'DOMContentLoaded').subscribe(() => {
  const canvas = document.getElementById('waveShootCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('failed to load canvas!');
    return;
  }

  const onResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  fromEvent(window, 'resize').subscribe(onResize);
  onResize();

  const waveShoot = new WaveShooterGame(canvas);
  waveShoot.initialize();
  
  const ctx = canvas.getContext('2d');

  let prevFrame = Date.now();
  const tick = () => {
    const thisFrame = Date.now();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    waveShoot.dispatch();

    prevFrame = thisFrame;
    window.requestAnimationFrame(tick);
  };
  
  window.requestAnimationFrame(tick);
});