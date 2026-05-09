import confetti from 'canvas-confetti';

const ACCENTS = ['#FAEEDA', '#FFD700'];

export function fireCornholeBurst(primaryHex = '#FFD700') {
  const colors = [primaryHex, ...ACCENTS];
  confetti({
    particleCount: 90,
    spread: 100,
    startVelocity: 55,
    ticks: 220,
    origin: { y: 0.65 },
    colors,
  });
  setTimeout(() => {
    confetti({
      particleCount: 35,
      spread: 60,
      startVelocity: 35,
      origin: { y: 0.55, x: 0.3 },
      colors,
    });
    confetti({
      particleCount: 35,
      spread: 60,
      startVelocity: 35,
      origin: { y: 0.55, x: 0.7 },
      colors,
    });
  }, 180);
}

export function fireWinnerConfetti(primaryHex = '#FFD700', durationMs = 3500) {
  const colors = [primaryHex, '#FAEEDA', '#FFD700', '#DC2127', '#3B82F6', '#22C55E'];
  const end = Date.now() + durationMs;

  confetti({
    particleCount: 160,
    spread: 130,
    startVelocity: 60,
    ticks: 280,
    origin: { y: 0.6 },
    colors,
  });

  function tick() {
    const remaining = end - Date.now();
    if (remaining <= 0) return;
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
      startVelocity: 55,
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
      startVelocity: 55,
    });
    setTimeout(tick, 320);
  }
  setTimeout(tick, 350);
}
