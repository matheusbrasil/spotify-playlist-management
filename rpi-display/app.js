const EFFECTS_ENDPOINT_CANDIDATES = ['effects.json', 'sample-chain.json'];
const CATALOG_ENDPOINT = 'effects-catalog.json';
const MAX_VISIBLE = 4;

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function renderEffects(effects, catalog) {
  const container = document.querySelector('#effects');
  container.innerHTML = '';

  if (!effects.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Chain is empty or not yet available.';
    empty.className = 'empty-state';
    container.appendChild(empty);
    return;
  }

  const template = document.querySelector('#effect-card-template');
  effects.forEach((effect, index) => {
    const view = template.content.firstElementChild.cloneNode(true);
    const meta = catalog[effect.id] || {};
    const name = meta.displayName || meta.name || effect.name || effect.id || 'Unknown FX';
    const imagePath = meta.image || effect.image;

    view.querySelector('.effect-name').textContent = name;
    view.querySelector('.effect-slot').textContent = `Slot ${effect.slot}`;

    const imageEl = view.querySelector('.effect-image');
    if (imagePath) {
      imageEl.style.backgroundImage = `url(${imagePath})`;
      imageEl.textContent = '';
    } else {
      imageEl.style.backgroundImage = 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,0,0,0.45))';
      imageEl.textContent = name;
    }

    container.appendChild(view);
  });
}

async function loadChainData() {
  for (const candidate of EFFECTS_ENDPOINT_CANDIDATES) {
    try {
      const data = await loadJson(candidate);
      return data;
    } catch (error) {
      // Continue trying the next candidate.
    }
  }
  throw new Error('No chain JSON found. Expected effects.json or sample-chain.json');
}

async function refresh() {
  try {
    const chain = await loadChainData();
    const catalog = await loadJson(CATALOG_ENDPOINT);

    const chainEntries = Array.isArray(chain?.effects)
      ? chain.effects
      : [];

    const sliced = chainEntries
      .slice(1, MAX_VISIBLE + 1)
      .map((effect, idx) => ({
        ...effect,
        slot: effect.slot ?? idx + 2,
      }));

    renderEffects(sliced, catalog);
  } catch (error) {
    console.error(error);
    const container = document.querySelector('#effects');
    container.innerHTML = '';
    const message = document.createElement('p');
    message.className = 'error-state';
    message.textContent = 'Unable to load effect data. Check the JSON exports.';
    container.appendChild(message);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#refresh').addEventListener('click', refresh);
  refresh();
});
