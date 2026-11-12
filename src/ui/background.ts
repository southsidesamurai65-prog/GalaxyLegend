interface MeteorConfig {
  top: number;
  left: number;
  width: number;
  color: string;
  duration: number;
  delay: number;
  travelX: number;
  travelY: number;
}

const METEOR_COLORS = ['#67e8f9', '#e0e7ff', '#c084fc', '#fbcfe8'];

export function initGalaxyBackground(container: HTMLElement | null): void {
  if (!container) return;
  container.innerHTML = '';

  const nebula = document.createElement('div');
  nebula.className = 'galaxy-nebula';
  container.appendChild(nebula);

  const band = document.createElement('div');
  band.className = 'galaxy-band';
  container.appendChild(band);

  const starLayer = document.createElement('div');
  starLayer.className = 'star-layer';
  container.appendChild(starLayer);

  const starCount = 190;
  for (let index = 0; index < starCount; index += 1) {
    const star = document.createElement('span');
    star.className = 'star';

    const size =
      Math.random() < 0.14
        ? 2.2 + Math.random() * 2.2
        : 0.8 + Math.random() * 1.4;

    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.setProperty('--star-opacity', `${0.35 + Math.random() * 0.65}`);
    star.style.setProperty(
      '--twinkle-duration',
      `${2.8 + Math.random() * 4.5}s`,
    );
    star.style.setProperty('--twinkle-delay', `${-Math.random() * 7}s`);

    if (Math.random() < 0.16) star.classList.add('bright');
    if (Math.random() < 0.18) star.classList.add('blue');
    else if (Math.random() < 0.1) star.classList.add('purple');

    starLayer.appendChild(star);
  }

  const meteorLayer = document.createElement('div');
  meteorLayer.className = 'meteor-layer';
  container.appendChild(meteorLayer);

  const meteors: MeteorConfig[] = [];
  for (let index = 0; index < 4; index += 1) {
    meteors.push({
      top: 2 + Math.random() * 32,
      left: 48 + Math.random() * 48,
      width: 120 + Math.random() * 100,
      color: METEOR_COLORS[index % METEOR_COLORS.length],
      duration: 6.5 + Math.random() * 4,
      delay: -Math.random() * 10,
      travelX: -(55 + Math.random() * 16),
      travelY: 55 + Math.random() * 16,
    });
  }

  for (const config of meteors) {
    const meteor = document.createElement('span');
    meteor.className = 'meteor';
    meteor.style.top = `${config.top}%`;
    meteor.style.left = `${config.left}%`;
    meteor.style.width = `${config.width}px`;
    meteor.style.setProperty('--meteor-color', config.color);
    meteor.style.setProperty('--meteor-duration', `${config.duration}s`);
    meteor.style.setProperty('--meteor-delay', `${config.delay}s`);
    meteor.style.setProperty('--meteor-travel-x', `${config.travelX}vw`);
    meteor.style.setProperty('--meteor-travel-y', `${config.travelY}vh`);
    meteorLayer.appendChild(meteor);
  }
}
