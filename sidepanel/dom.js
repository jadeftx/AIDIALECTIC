/**
 * Consensus Engine — Side Panel DOM
 * Element lookups and toast feedback shared by the side panel modules.
 */

const $ = (sel) => document.querySelector(sel);

const els = {
  roundCounter: $('#round-counter'),
  turnIndicator: $('#turn-indicator'),
  thread: $('#thread'),
  initialContextSection: $('#initial-context-section'),
  initialContext: $('#initial-context'),
  btnStartSession: $('#btn-start-session'),
  btnNewSession: $('#btn-new-session'),
  btnSessionsList: $('#btn-sessions-list'),
  btnSettings: $('#btn-settings'),
  actionBar: $('#action-bar'),
  btnPrepareHandoff: $('#btn-prepare-handoff'),
  handoffTarget: $('#handoff-target'),
  btnInterject: $('#btn-interject'),
  replyTarget: $('#reply-target'),
  consensusBar: $('#consensus-bar'),
  btnConsensus: $('#btn-consensus'),
  btnExportToggle: $('#btn-export-toggle'),
  exportDropdown: $('#export-dropdown'),
  btnExportMdHeader: $('#btn-export-md-header'),
  btnExportJsonHeader: $('#btn-export-json-header'),
  btnPushGithubHeader: $('#btn-push-github-header'),
  exportDropdownStatus: $('#export-dropdown-status'),
  interjectionSection: $('#interjection-section'),
  interjectionText: $('#interjection-text'),
  interjectionTarget: $('#interject-target'),
  interjectionTargetBtn: $('#interject-target-btn'),
  btnSubmitInterject: $('#btn-submit-interject'),
  btnCancelInterject: $('#btn-cancel-interject'),
  inlineInsertForm: $('#inline-insert-form'),
  inlineInsertSource: $('#inline-insert-source'),
  inlineInsertContent: $('#inline-insert-content'),
  btnSubmitInlineInsert: $('#btn-submit-inline-insert'),
  btnCancelInlineInsert: $('#btn-cancel-inline-insert'),
  viewConversation: $('#view-conversation'),
  viewSessions: $('#view-sessions'),
  sessionsList: $('#sessions-list'),
  btnBackConversation: $('#btn-back-conversation'),
  exportModal: $('#export-modal'),
  btnExportMd: $('#btn-export-md'),
  btnExportJson: $('#btn-export-json'),
  btnPushGithub: $('#btn-push-github'),
  btnCloseModal: $('#btn-close-modal'),
  btnCloseModalX: $('#btn-close-modal-x'),
  exportStatus: $('#export-status'),
  btnHelp: $('#btn-help'),
  helpModal: $('#help-modal'),
  btnCloseHelp: $('#btn-close-help'),
  btnThemeToggle: $('#btn-theme-toggle'),
  btnFontUp: $('#btn-font-up'),
  btnFontDown: $('#btn-font-down'),
  modLength: $('#mod-length'),
  modTone: $('#mod-tone'),
};

function showToast(text, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}
