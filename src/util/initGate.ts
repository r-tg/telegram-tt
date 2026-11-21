// A manual start gate shown before the app initializes. The real startup
// (`init()` in `index.tsx`) runs only after the user clicks the button.

const GATE_ID = 'init-gate';
const STYLE_ID = 'init-gate-style';

const GATE_STYLES = `
#${GATE_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: var(--color-background, #212121);
  color: var(--color-text, #fff);
  font-family: var(--font-family, "Roboto", -apple-system, sans-serif);
}

#${GATE_ID} .init-gate__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 24rem;
}

#${GATE_ID} .init-gate__logo {
  width: 7.5rem;
  height: 7.5rem;
  margin-bottom: 1.75rem;
  border-radius: 50%;
  background-image: linear-gradient(170deg, #2aabee, #229ed9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0.5rem 1.5rem rgba(34, 158, 217, 0.4);
}

#${GATE_ID} .init-gate__logo svg {
  width: 4rem;
  height: 4rem;
}

#${GATE_ID} .init-gate__title {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: var(--font-weight-medium, 500);
}

#${GATE_ID} .init-gate__subtitle {
  margin: 0 0 2rem;
  font-size: 1rem;
  color: var(--color-text-secondary, #aaa);
}

#${GATE_ID} .init-gate__button {
  min-width: 14rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  background-color: var(--color-primary, #3390ec);
  color: #fff;
  font-size: 1rem;
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

#${GATE_ID} .init-gate__button:hover {
  background-color: var(--color-primary-shade, #2b82e0);
}

#${GATE_ID} .init-gate__button:disabled {
  cursor: default;
  opacity: 0.7;
}
`;

const LOGO_SVG = `
<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
  <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.93c-.23.23-.42.42-.83.41z"/>
</svg>
`;

function renderGate(onStart: () => void) {
  if (document.getElementById(GATE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = GATE_STYLES;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.id = GATE_ID;
  gate.innerHTML = `
    <div class="init-gate__card">
      <div class="init-gate__logo">${LOGO_SVG}</div>
      <h1 class="init-gate__title">Telegram</h1>
      <p class="init-gate__subtitle">点击下方按钮进入</p>
      <button type="button" class="init-gate__button">进入 Telegram</button>
    </div>
  `;
  document.body.appendChild(gate);

  const button = gate.querySelector<HTMLButtonElement>('.init-gate__button')!;
  button.addEventListener(
    'click',
    () => {
      button.disabled = true;
      button.textContent = '正在进入…';
      onStart();
    },
    { once: true },
  );
}

// Shows the start gate and resolves when the user clicks the button
export function waitForManualStart() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => renderGate(resolve),
        { once: true },
      );
    } else {
      renderGate(resolve);
    }
  });
}

// Removes the gate once the app has mounted
export function removeInitGate() {
  document.getElementById(GATE_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}
