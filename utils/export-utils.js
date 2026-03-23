/**
 * Consensus Engine — Markdown Export Utilities
 * Shared between sidepanel (via <script> tag) and background.js (via importScripts).
 */

function generateMarkdownExport(session) {
  const lines = [];
  lines.push(`# AIDIALECTIC Transcript`);
  lines.push('');
  lines.push(`**Session ID:** ${session.id}`);
  lines.push(`**Created:** ${new Date(session.createdAt).toLocaleString()}`);
  lines.push(`**Rounds:** ${session.round}`);
  lines.push(`**Consensus:** ${session.consensusReached ? 'Yes' : 'No'}`);
  lines.push('');

  if (session.initialContext) {
    lines.push('## Initial Context');
    lines.push('');
    lines.push(session.initialContext);
    lines.push('');
  }

  lines.push('## Conversation');
  lines.push('');

  let lastRound = 0;
  for (const msg of session.messages) {
    if (msg.round && msg.round !== lastRound) {
      lastRound = msg.round;
      lines.push(`---`);
      lines.push(`### Round ${msg.round}`);
      lines.push('');
    }

    const source = msg.source || 'unknown';
    const label =
      source === 'user' ? '[User Interjection]' : `[${source.charAt(0).toUpperCase() + source.slice(1)}]`;
    const time = new Date(msg.timestamp).toLocaleString();
    const consensusTag = msg.isConsensus ? ' **[CONSENSUS]**' : '';

    lines.push(`#### ${label} — ${time}${consensusTag}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  return lines.join('\n');
}

function formatDateForFilename(isoString) {
  const d = new Date(isoString);
  return d.toISOString().slice(0, 10);
}
