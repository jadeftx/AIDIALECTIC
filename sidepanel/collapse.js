/**
 * Consensus Engine — Collapse/Expand for Long Messages
 */

function setupCollapse(messageEl, rawContent) {
  const allLines = rawContent.split('\n');
  const metaPattern =
    /^(#{1,3}\s*(Round|Response|DIALECTIC|Analysis)|={3,}|---\s*(DIALECTIC|ROUND|YOUR TASK|INITIAL))/i;
  let contentStart = 0;
  for (let i = 0; i < allLines.length; i++) {
    const trimmed = allLines[i].trim();
    if (trimmed && !metaPattern.test(trimmed)) {
      contentStart = i;
      break;
    }
  }

  const contentLines = allLines.slice(contentStart).filter((l) => l.trim());
  if (contentLines.length <= 3) return;

  const totalLines = contentLines.length;
  const body = messageEl.querySelector('.message-body');
  const fullHtml = body.innerHTML;
  const MAX_LINE = 200;

  function truncLines(lines) {
    return lines.map((l) => (l.length <= MAX_LINE ? l : l.slice(0, MAX_LINE) + '...')).join('\n');
  }

  let headCount = 1;
  let tailCount = 1;
  let headStep = 5;
  let tailStep = 5;

  const container = document.createElement('div');
  container.className = 'collapse-container';

  const headSection = document.createElement('span');
  headSection.className = 'collapse-preview';

  const expandDownBtn = document.createElement('button');
  expandDownBtn.className = 'collapse-toggle expand-down';

  const contractBtn = document.createElement('button');
  contractBtn.className = 'collapse-toggle contract-btn hidden';
  contractBtn.innerHTML = '<span class="collapse-toggle-icon">◀</span> Show less';

  const expandUpBtn = document.createElement('button');
  expandUpBtn.className = 'collapse-toggle expand-up';

  const tailSection = document.createElement('span');
  tailSection.className = 'collapse-preview';

  container.appendChild(headSection);
  container.appendChild(expandDownBtn);
  container.appendChild(contractBtn);
  container.appendChild(expandUpBtn);
  container.appendChild(tailSection);

  const fullDiv = document.createElement('div');
  fullDiv.className = 'message-expanded hidden';
  fullDiv.innerHTML = fullHtml;

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'collapse-toggle collapse-btn hidden';
  collapseBtn.innerHTML = '<span class="collapse-toggle-icon">\u25B2</span> Show less';

  body.innerHTML = '';
  body.appendChild(container);
  body.appendChild(fullDiv);
  body.appendChild(collapseBtn);
  messageEl.classList.add('is-collapsed');

  function renderCollapse() {
    const hiddenCount = totalLines - headCount - tailCount;

    if (hiddenCount <= 0) {
      container.classList.add('hidden');
      fullDiv.classList.remove('hidden');
      collapseBtn.classList.remove('hidden');
      messageEl.classList.remove('is-collapsed');
      return;
    }

    container.classList.remove('hidden');
    fullDiv.classList.add('hidden');
    collapseBtn.classList.add('hidden');
    messageEl.classList.add('is-collapsed');

    headSection.textContent = truncLines(contentLines.slice(0, headCount));
    tailSection.textContent = truncLines(contentLines.slice(totalLines - tailCount));

    const downAvail = Math.min(headStep, hiddenCount);
    expandDownBtn.innerHTML = `<span class="collapse-toggle-icon">▼</span> show ${downAvail} more lines of ${hiddenCount}`;

    if (headCount > 1 || tailCount > 1) {
      contractBtn.classList.remove('hidden');
    } else {
      contractBtn.classList.add('hidden');
    }

    const upAvail = Math.min(tailStep, hiddenCount);
    expandUpBtn.innerHTML = `<span class="collapse-toggle-icon">▲</span> show ${upAvail} more lines of ${hiddenCount}`;
  }

  expandDownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headCount = Math.min(headCount + headStep, totalLines - tailCount);
    headStep *= 2;
    renderCollapse();
  });

  expandUpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    tailCount = Math.min(tailCount + tailStep, totalLines - headCount);
    tailStep *= 2;
    renderCollapse();
  });

  contractBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headCount = 1;
    tailCount = 1;
    headStep = 5;
    tailStep = 5;
    renderCollapse();
  });

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headCount = 1;
    tailCount = 1;
    headStep = 5;
    tailStep = 5;
    renderCollapse();
  });

  renderCollapse();
}
