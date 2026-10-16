// Hash router. Feature modules call register(name, render). render(main) may return { cleanup }.
const routes = new Map();
let current = null;

export function register(name, render) { routes.set(name, render); }

export function currentRoute() {
  return location.hash.replace(/^#\//, '').split('?')[0] || 'dashboard';
}

export async function navigate() {
  const name = routes.has(currentRoute()) ? currentRoute() : 'dashboard';
  const main = document.getElementById('main');
  if (typeof current?.cleanup === 'function') current.cleanup();
  current = null;
  main.replaceChildren();
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try {
    current = (await routes.get(name)(main)) || null;
  } catch (err) {
    console.error(err);
    const div = document.createElement('div');
    div.className = 'card error-state';
    div.textContent = `Could not load this page: ${err.message}`;
    main.append(div);
  }
  main.focus({ preventScroll: true });
}

export function startRouter() {
  window.addEventListener('hashchange', navigate);
  if (!location.hash) location.hash = '#/dashboard';
  return navigate();
}
